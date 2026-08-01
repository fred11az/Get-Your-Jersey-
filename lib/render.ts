import sharp, { type OverlayOptions } from 'sharp';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fitTransform, textToPath, type BoundedPath } from './glyphs';
import { kitDir, loadKit } from './kits';
import { getScene, quadPlacement, sceneDir } from './scenes';
import { kitFabricBand, swapGarmentFabric } from './garment';
import { detectFace, type FaceBox } from './face';
import type { KitSlug, PrintZone, Tier } from './types';

/**
 * Pipeline de rendu, calqué sur le maillot de référence fourni par le client
 * (docs/reference/target-result.jpg) :
 *
 *   1. les photos sont empilées VERTICALEMENT, recadrées sur le visage détecté
 *      et calées sur la boîte réelle du chiffre, avec une cellule par chiffre ;
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
  /**
   * Identifiant d'une mise en situation (`public/scenes/<id>`) : le visuel est
   * alors composé sur le dos d'un mannequin humain au lieu du maillot à plat.
   * Ignoré si la scène n'existe pas — l'aperçu retombe sur le mockup.
   */
  sceneId?: string;
}

export interface RenderOutput {
  previewWebP: Buffer;
  /** Scène effectivement utilisée, `null` si rendu sur le maillot à plat. */
  sceneId: string | null;
  /**
   * Numéro seul, fond transparent : c'est LUI qui part à l'impression. Le nom
   * est floqué séparément par l'atelier, à sa propre taille.
   */
  artworkPng: Buffer;
  /**
   * Nom ET numéro réunis sur un seul fond transparent, tels qu'ils apparaissent
   * sur le dos. Sert à la superposition dans les scènes animées, où le lecteur
   * ne peut poser qu'une image par quadrilatère.
   */
  flockingPng: Buffer;
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
 * Fenêtre de recadrage d'une photo, centrée sur le visage.
 *
 * `alignX` dit où le visage doit tomber dans la cellule, en fraction de sa
 * largeur : c'est ce qui permet de le poser sur le plein du chiffre plutôt que
 * dans un vide.
 */
function faceCrop(
  source: { width: number; height: number },
  face: FaceBox,
  target: { width: number; height: number },
  alignX: number,
): { left: number; top: number; width: number; height: number } {
  // 1,9 fois la hauteur du visage : il occupe alors un peu plus de la moitié de
  // la cellule, comme sur le visuel de référence, où les visages sont grands.
  // Recadrer moins serré revient à imprimer un mur.
  const ZOOM = 1.9;
  const faceHeight = Math.max(1, face.height * source.height);
  const ratio = target.width / target.height;

  let height = Math.min(source.height, faceHeight * ZOOM);
  let width = height * ratio;
  if (width > source.width) {
    width = source.width;
    height = width / ratio;
  }

  const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));
  return {
    // Le visage est posé légèrement au-dessus du centre : c'est le cadrage
    // naturel d'un portrait, et cela laisse le buste plutôt que du plafond.
    left: Math.round(clamp(face.cx * source.width - width * alignX, source.width - width)),
    top: Math.round(clamp(face.cy * source.height - height * 0.45, source.height - height)),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Où poser le visage dans une cellule pour qu'il tombe sur le plein du chiffre.
 *
 * Un « 1 » n'occupe qu'une hampe étroite ; centrer le visage dans la cellule le
 * placerait à côté. On fait donc glisser une fenêtre de la largeur du visage sur
 * le profil de remplissage du masque et on retient la position la plus couverte.
 */
function bestAlignX(
  coverage: Int32Array,
  cellLeft: number,
  cellWidth: number,
  faceWidth: number,
): number {
  const window = Math.max(1, Math.min(cellWidth, Math.round(faceWidth)));
  let total = 0;
  for (let x = 0; x < cellWidth; x++) total += coverage[cellLeft + x] ?? 0;
  if (total === 0) return 0.5;

  let sum = 0;
  for (let x = 0; x < window; x++) sum += coverage[cellLeft + x] ?? 0;

  let best = sum;
  let bestStart = 0;
  for (let start = 1; start + window <= cellWidth; start++) {
    sum += (coverage[cellLeft + start + window - 1] ?? 0) - (coverage[cellLeft + start - 1] ?? 0);
    if (sum > best) {
      best = sum;
      bestStart = start;
    }
  }
  return (bestStart + window / 2) / cellWidth;
}

/**
 * Empile les photos verticalement pour remplir la zone, une CELLULE par chiffre.
 *
 * Deux choses distinguent ce découpage d'un simple `cover` centré :
 *
 *   - chaque chiffre reçoit sa propre copie de la photo, recadrée pour lui. Sur
 *     un « 11 », une bande unique étalée sur les deux chiffres ne montrait le
 *     visage dans aucun des deux : la hampe gauche tombait sur une épaule, la
 *     droite sur le mur. Avec une cellule par chiffre, le rapport d'une cellule
 *     (portrait) épouse celui d'une photo de téléphone, et chaque chiffre porte
 *     un visage ;
 *   - le recadrage vise le visage détecté et non le centre géométrique, puis se
 *     décale pour tomber sur le plein du chiffre.
 *
 * Sans visage détecté (photo de paysage, d'écusson), on retombe sur le
 * comportement d'origine.
 */
async function stackPhotos(
  photos: Buffer[],
  width: number,
  height: number,
  cells = 1,
  glyphMask?: Buffer,
): Promise<Buffer> {
  const count = Math.min(photos.length, MAX_PHOTOS);
  if (count === 0) {
    throw new RenderError('Au moins une photo est requise.', 'NO_PHOTO');
  }

  const bandHeight = Math.floor(height / count);
  const cellWidth = Math.floor(width / cells);

  // Profil de remplissage du chiffre, colonne par colonne et bande par bande.
  const coverage = glyphMask ? await columnCoverage(glyphMask, width, height) : null;

  const tiles: OverlayOptions[] = [];

  for (const [index, photo] of photos.slice(0, count).entries()) {
    // La dernière bande absorbe l'arrondi pour éviter une ligne vide en bas.
    const h = index === count - 1 ? height - bandHeight * (count - 1) : bandHeight;
    const top = index * bandHeight;

    const upright = await sharp(photo).rotate().png().toBuffer(); // orientation EXIF d'abord
    const meta = await sharp(upright).metadata();
    const face = await detectFace(upright);

    const rows = coverage
      ? sumRows(coverage, width, top, top + h)
      : null;

    for (let cell = 0; cell < cells; cell++) {
      const w = cell === cells - 1 ? width - cellWidth * (cells - 1) : cellWidth;
      const left = cell * cellWidth;

      let resized: Buffer;
      if (face && meta.width && meta.height) {
        const source = { width: meta.width, height: meta.height };
        const faceWidth = (face.height * source.height * 0.9 * w) /
          Math.max(1, faceCrop(source, face, { width: w, height: h }, 0.5).width);
        const alignX = rows ? bestAlignX(rows, left, w, faceWidth) : 0.5;
        const crop = faceCrop(source, face, { width: w, height: h }, alignX);
        resized = await sharp(upright)
          .extract(crop)
          .resize(w, h, { fit: 'fill' })
          .png()
          .toBuffer();
      } else {
        resized = await sharp(upright)
          .resize(w, h, { fit: 'cover', position: 'attention' })
          .png()
          .toBuffer();
      }

      tiles.push({ input: resized, left, top });
    }
  }

  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(tiles)
    .png()
    .toBuffer();
}

/** Opacité du masque, pixel par pixel, pour mesurer le plein du chiffre. */
async function columnCoverage(mask: Buffer, width: number, height: number): Promise<Buffer> {
  const { data } = await sharp(mask)
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .extractChannel('alpha')
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

/**
 * Boîte réellement occupée par le glyphe dans sa plaque.
 *
 * Un « 11 » est étroit et haut : ajusté à la boîte, il laisse de larges marges
 * verticales. Empiler les photos sur la boîte ENTIÈRE revient alors à ne montrer
 * dans le chiffre qu'une tranche décalée de chaque photo — le menton au lieu du
 * visage. Les bandes doivent se caler sur le chiffre, pas sur son cadre.
 */
async function maskBounds(
  mask: Buffer,
  width: number,
  height: number,
): Promise<{ left: number; top: number; width: number; height: number }> {
  const alpha = await columnCoverage(mask, width, height);
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((alpha[y * width + x] ?? 0) <= 127) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right < 0 || bottom < 0) return { left: 0, top: 0, width, height };
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Somme du remplissage par colonne, sur les lignes d'une bande. */
function sumRows(alpha: Buffer, width: number, from: number, to: number): Int32Array {
  const columns = new Int32Array(width);
  for (let y = from; y < to; y++) {
    for (let x = 0; x < width; x++) {
      if ((alpha[y * width + x] ?? 0) > 127) columns[x] = (columns[x] ?? 0) + 1;
    }
  }
  return columns;
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

  // Les photos se calent sur la boîte du CHIFFRE, pas sur celle de la plaque, et
  // reçoivent une cellule par chiffre : chaque chiffre porte alors son visage.
  const bounds = await maskBounds(mask, box.width, box.height);
  const cropped = await sharp(mask).extract(bounds).png().toBuffer();

  const collage = await stackPhotos(
    photos,
    bounds.width,
    bounds.height,
    Math.max(1, jerseyNumber.length),
    cropped,
  );

  const stacked = await sharp({
    create: {
      width: box.width,
      height: box.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: collage, left: bounds.left, top: bounds.top }])
    .png()
    .toBuffer();

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

/**
 * Réunit le nom et le numéro sur un seul fond transparent, dans leurs positions
 * relatives réelles.
 *
 * Utile pour les mises en situation : le lecteur animé ne pose qu'une image par
 * quadrilatère. Sans cette planche, le nom disparaîtrait de l'aperçu porté.
 * La zone annotée sur une scène couvre donc l'ensemble du flocage, nom compris.
 */
async function buildFlockingSheet({
  numberArtwork,
  nameArtwork,
  zone,
  nameWidth,
  nameHeight,
}: {
  numberArtwork: Buffer;
  nameArtwork: Buffer | null;
  zone: PrintZone;
  nameWidth: number;
  nameHeight: number;
}): Promise<Buffer> {
  if (!nameArtwork) return numberArtwork;

  const gap = Math.round(nameHeight * 0.35);
  const width = Math.max(zone.width, nameWidth);
  const height = nameHeight + gap + zone.height;

  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: nameArtwork, left: Math.round((width - nameWidth) / 2), top: 0 },
      {
        input: numberArtwork,
        left: Math.round((width - zone.width) / 2),
        top: nameHeight + gap,
      },
    ])
    .png()
    .toBuffer();
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

  // Mise en situation si demandée et disponible.
  const scene = input.sceneId ? await getScene(input.sceneId) : undefined;
  const placement = scene ? quadPlacement(scene.quad) : null;

  // Sur une scène, le mannequin doit porter le kit choisi, pas celui de la
  // prise de vue : on remplace la matière en conservant l'éclairage de la photo.
  let background: string | Buffer = scene
    ? path.join(sceneDir(scene.id), 'photo.jpg')
    : path.join(kitDir(input.kitSlug), `${side}.png`);

  if (scene?.garmentMask) {
    background = await swapGarmentFabric({
      photo: await sharp(background).png().toBuffer(),
      mask: await readFile(path.join(sceneDir(scene.id), scene.garmentMask)),
      fabric: await kitFabricBand(input.kitSlug),
      width: scene.photo.width,
      height: scene.photo.height,
    });
  }

  // Sur une scène, le visuel est redimensionné et incliné pour suivre le dos du
  // mannequin ; sur un mockup à plat il est posé tel quel dans la zone.
  const numberLayer: OverlayOptions = placement
    ? {
        input: await sharp(numberArtwork)
          .resize(placement.width, placement.height, { fit: 'fill' })
          .rotate(placement.rotationDeg, {
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer(),
        left: placement.left,
        top: placement.top,
      }
    : { input: numberArtwork, left: zone.x, top: zone.y };

  const layers: OverlayOptions[] = [numberLayer];

  if (nameArtwork) {
    // Le nom se place au-dessus de la zone, avec un interligne d'un tiers de sa
    // hauteur. Il est remonté vers le col sans jamais sortir de l'image.
    const gap = Math.round(nameHeight * 0.35);
    const anchor = placement ?? { left: zone.x, top: zone.y, width: zone.width };
    const scale = placement ? placement.width / zone.width : 1;
    const scaledNameWidth = Math.round(nameWidth * scale);
    const scaledNameHeight = Math.round(nameHeight * scale);

    layers.unshift({
      input: placement
        ? await sharp(nameArtwork)
            .resize(scaledNameWidth, scaledNameHeight, { fit: 'fill' })
            .rotate(placement.rotationDeg, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer()
        : nameArtwork,
      left: Math.max(0, anchor.left + Math.round((anchor.width - scaledNameWidth) / 2)),
      top: Math.max(0, anchor.top - scaledNameHeight - Math.round(gap * scale)),
    });
  }

  const previewWebP = await sharp(background)
    .composite(layers)
    .webp({ quality: 85 })
    .toBuffer();

  return {
    previewWebP,
    sceneId: scene?.id ?? null,
    artworkPng: numberArtwork,
    flockingPng: await buildFlockingSheet({
      numberArtwork,
      nameArtwork,
      zone,
      nameWidth,
      nameHeight,
    }),
    zone,
    generationTimeMs: Date.now() - startedAt,
  };
}
