import sharp, { type OverlayOptions } from 'sharp';
import path from 'node:path';
import { fitTransform, textToPath, type BoundedPath } from './glyphs';
import { kitDir, loadKit } from './kits';
import type { KitSlug, PrintZone, Tier } from './types';

/**
 * Pipeline de rendu, calqué sur le maillot de référence fourni par le client
 * (docs/reference/target-result.jpg) :
 *
 *   1. les photos sont empilées VERTICALEMENT, chacune recadrée en `cover` ;
 *   2. la pile est découpée par la silhouette du numéro ;
 *   3. le numéro reçoit une bordure blanche épaisse, puis un trait rouge fin,
 *      concentriques vers l'extérieur ;
 *   4. le nom est floqué au-dessus, en blanc cerné de rouge ;
 *   5. le tout est composé sur le mockup du maillot.
 *
 * Les photos ne sont PAS détourées : la référence utilise des photos
 * rectangulaires entières, et le fond de chaque photo fait partie du visuel.
 * Détourer laisserait des trous transparents dans le chiffre. Voir
 * docs/DIVERGENCES.md.
 */

export interface RenderStyle {
  /** Épaisseur de la bordure extérieure, en % de la plus petite dimension. */
  borderRatio: number;
  /** Épaisseur du liseré intérieur, en % de la plus petite dimension. */
  accentRatio: number;
  /** Remplissage du nom et bordure extérieure du numéro. */
  borderColor: string;
  /** Cerne du nom et liseré intérieur du numéro. */
  accentColor: string;
  /** Trame demi-teinte. `size: 0` la désactive. */
  halftone: { angle: number; size: number };
  /** Hauteur du bloc nom, en % de la hauteur de la zone. */
  nameHeightRatio: number;
  /**
   * Largeur du bloc nom, en multiple de la largeur de la zone du numéro. Sur un
   * vrai maillot le nom court d'une épaule à l'autre, donc plus large que le
   * numéro : sans ça, un nom de dix lettres devient illisible.
   */
  nameWidthFactor: number;
}

/**
 * Géométrie par défaut. Les **couleurs** ne sont volontairement pas génériques :
 * elles proviennent de `metadata.flocking` du kit choisi (voir `renderJersey`).
 * Celles-ci ne servent que de repli si un kit n'en déclare pas.
 */
export const DEFAULT_STYLE: RenderStyle = {
  borderRatio: 0.035,
  accentRatio: 0.014,
  borderColor: '#FFFFFF',
  accentColor: '#D2202F',
  halftone: { angle: 45, size: 0 },
  nameHeightRatio: 0.17,
  nameWidthFactor: 1.6,
};

export interface RenderInput {
  photos: Buffer[];
  jerseyNumber: string;
  jerseyName: string;
  kitSlug: KitSlug;
  tier: Tier;
  side?: 'front' | 'back';
  style?: Partial<RenderStyle>;
}

export interface RenderOutput {
  previewWebP: Buffer;
  /** Visuel imprimable seul, fond transparent, à la résolution de la zone. */
  artworkPng: Buffer;
  zone: PrintZone;
  generationTimeMs: number;
}

const MAX_PHOTOS = 3;

export class RenderError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'RenderError';
  }
}

/**
 * Empile les photos verticalement pour remplir la zone. Chaque photo occupe une
 * bande de hauteur égale et est recadrée en `cover` : elle remplit toute la
 * largeur sans déformation, comme sur la référence.
 */
async function stackPhotos(photos: Buffer[], width: number, height: number): Promise<Buffer> {
  const count = Math.min(photos.length, MAX_PHOTOS);
  if (count === 0) {
    throw new RenderError('Au moins une photo est requise.', 'NO_PHOTO');
  }

  const bandHeight = Math.floor(height / count);
  const bands = await Promise.all(
    photos.slice(0, count).map(async (photo, index) => {
      // La dernière bande absorbe l'arrondi pour éviter une ligne vide en bas.
      const h = index === count - 1 ? height - bandHeight * (count - 1) : bandHeight;
      const resized = await sharp(photo)
        .rotate() // applique l'orientation EXIF avant tout recadrage
        .resize(width, h, { fit: 'cover', position: 'attention' })
        .png()
        .toBuffer();
      return { input: resized, left: 0, top: index * bandHeight };
    }),
  );

  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(bands)
    .png()
    .toBuffer();
}

/**
 * Trame demi-teinte : Sharp n'a pas de filtre halftone, on applique une grille
 * de points en `dest-in`. Pas fixe, non modulé par la luminance (voir la limite
 * documentée en section 6 de docs/SPEC.md).
 */
async function applyHalftone(
  input: Buffer,
  width: number,
  height: number,
  options: { angle: number; size: number },
): Promise<Buffer> {
  if (options.size <= 0) return input;

  const { angle, size } = options;
  const screen = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <pattern id="dots" width="${size * 2}" height="${size * 2}"
               patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">
        <circle cx="${size}" cy="${size}" r="${size * 0.62}" fill="#fff"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dots)"/>
  </svg>`;

  return sharp(input)
    .composite([{ input: Buffer.from(screen), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

interface Plate {
  /** Bordure blanche + trait rouge, sans le remplissage photo. */
  outline: Buffer;
  /** Silhouette pleine du glyphe : sert de masque au collage photo. */
  mask: Buffer;
}

/**
 * Construit les deux calques d'un glyphe.
 *
 * Un `stroke` SVG s'étend de part et d'autre du contour : une épaisseur de
 * `2 * n` dilate donc la forme de `n` vers l'extérieur. En dessinant le même
 * chemin trois fois avec des épaisseurs décroissantes, on obtient des bandes
 * concentriques — blanc à l'extérieur, rouge, puis la photo — sans calcul
 * d'offset de contour.
 */
async function buildPlate(
  glyph: BoundedPath,
  box: { width: number; height: number },
  style: RenderStyle,
  order: 'border-outside' | 'accent-outside',
  minCondense = 1,
): Promise<Plate> {
  // L'épaisseur suit la plus petite dimension du bloc : indexée sur la largeur,
  // la bordure d'un bloc nom (large et bas) deviendrait plus épaisse que
  // l'espace entre deux lettres, qui se souderaient.
  const reference = Math.min(box.width, box.height);
  const border = reference * style.borderRatio;
  const accent = reference * style.accentRatio;
  const padding = border + accent;
  const { transform, scale } = fitTransform(glyph, box, { padding, minCondense });

  // Les épaisseurs sont exprimées dans l'espace du glyphe : on divise par
  // l'échelle pour que la bande garde la largeur voulue après mise à l'échelle.
  const outerWidth = ((border + accent) * 2) / scale;
  const innerWidth = (accent * 2) / scale;

  const outerColor = order === 'border-outside' ? style.borderColor : style.accentColor;
  const innerColor = order === 'border-outside' ? style.accentColor : style.borderColor;

  const shared = 'stroke-linejoin="round" stroke-linecap="round"';
  const svg = (body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}">
       <g transform="${transform}">${body}</g>
     </svg>`;

  const outline = await sharp(
    Buffer.from(
      svg(`
        <path d="${glyph.d}" fill="${outerColor}" stroke="${outerColor}"
              stroke-width="${outerWidth.toFixed(3)}" ${shared}/>
        <path d="${glyph.d}" fill="${innerColor}" stroke="${innerColor}"
              stroke-width="${innerWidth.toFixed(3)}" ${shared}/>`),
    ),
  )
    .png()
    .toBuffer();

  const mask = await sharp(Buffer.from(svg(`<path d="${glyph.d}" fill="#fff"/>`)))
    .png()
    .toBuffer();

  return { outline, mask };
}

/** Visuel du numéro : photos empilées, découpées par le chiffre, puis cerclées. */
async function renderNumberArtwork(
  photos: Buffer[],
  jerseyNumber: string,
  box: { width: number; height: number },
  style: RenderStyle,
): Promise<Buffer> {
  const glyph = await textToPath(jerseyNumber);
  const { outline, mask } = await buildPlate(glyph, box, style, 'border-outside');

  const stacked = await stackPhotos(photos, box.width, box.height);
  const textured = await applyHalftone(stacked, box.width, box.height, style.halftone);

  // Le collage est découpé par la silhouette, puis posé sur les bandes.
  const filled = await sharp(textured)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  return sharp(outline).composite([{ input: filled }]).png().toBuffer();
}

/** Flocage du nom : blanc cerné de rouge, au-dessus du numéro. */
async function renderNameArtwork(
  jerseyName: string,
  box: { width: number; height: number },
  style: RenderStyle,
): Promise<Buffer | null> {
  if (!jerseyName) return null;
  const glyph = await textToPath(jerseyName);
  // Hauteur de lettre constante, nom condensé jusqu'à 38 % s'il est long.
  const { outline } = await buildPlate(glyph, box, style, 'accent-outside', 0.62);
  return outline;
}

export async function renderJersey(input: RenderInput): Promise<RenderOutput> {
  const startedAt = Date.now();
  const side = input.side ?? 'back';

  const kit = await loadKit(input.kitSlug);

  // Les couleurs de flocage sont propres au maillot, jamais génériques : une
  // bordure blanche disparaîtrait sur un Real Madrid. Ordre de priorité :
  // surcharge explicite de l'appelant > couleurs du kit > repli.
  const style: RenderStyle = {
    ...DEFAULT_STYLE,
    ...(kit.flocking && {
      borderColor: kit.flocking.primary,
      accentColor: kit.flocking.secondary,
    }),
    ...input.style,
  };

  const tierMeta = kit.tiers[input.tier];
  if (!tierMeta) {
    throw new RenderError(`Finition inconnue : ${input.tier}`, 'UNKNOWN_TIER');
  }
  const zone = tierMeta.print_zone;

  const numberArtwork = await renderNumberArtwork(
    input.photos,
    input.jerseyNumber,
    { width: zone.width, height: zone.height },
    style,
  );

  const nameHeight = Math.round(zone.height * style.nameHeightRatio);
  // Le bloc nom est plus large que le numéro et reste centré sur lui, sans
  // jamais déborder du mockup.
  const nameWidth = Math.min(
    Math.round(zone.width * style.nameWidthFactor),
    kit.mockup.width - 2 * Math.max(0, Math.min(zone.x, kit.mockup.width - zone.x - zone.width)),
  );
  const nameArtwork = await renderNameArtwork(
    input.jerseyName,
    { width: nameWidth, height: nameHeight },
    style,
  );

  const mockupPath = path.join(kitDir(input.kitSlug), `${side}.png`);
  const layers: OverlayOptions[] = [{ input: numberArtwork, left: zone.x, top: zone.y }];

  if (nameArtwork) {
    // Le nom se place au-dessus de la zone, avec un interligne d'un tiers de sa
    // hauteur. Il est remonté vers le col sans jamais sortir de l'image.
    const gap = Math.round(nameHeight * 0.35);
    layers.unshift({
      input: nameArtwork,
      left: Math.max(0, zone.x + Math.round((zone.width - nameWidth) / 2)),
      top: Math.max(0, zone.y - nameHeight - gap),
    });
  }

  const previewWebP = await sharp(mockupPath)
    .composite(layers)
    .webp({ quality: 85 })
    .toBuffer();

  return {
    previewWebP,
    artworkPng: numberArtwork,
    zone,
    generationTimeMs: Date.now() - startedAt,
  };
}
