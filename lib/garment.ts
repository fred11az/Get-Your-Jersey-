import sharp from 'sharp';
import path from 'node:path';
import { kitDir } from './kits';
import type { KitSlug } from './types';
import type { ScenePoint } from './scenes';

/**
 * Remplacement du tissu porté par un mannequin.
 *
 * Le mannequin est photographié avec UN maillot donné, mais le client en choisit
 * un autre. On remplace donc la matière dans la zone du vêtement, en conservant
 * l'éclairage de la photo d'origine.
 *
 * Le principe tient en une idée : séparer la **couleur** de la **lumière**. La
 * photo d'origine fournit les plis, les ombres et les reflets ; le maillot choisi
 * fournit la couleur et le motif. On multiplie l'un par l'autre. Un simple
 * aplat de couleur donnerait un autocollant plat ; en réutilisant la carte de
 * luminance, le nouveau tissu épouse le corps.
 *
 * Limites assumées :
 *   - le col et les bas de manches gardent la teinte d'origine si le polygone les
 *     exclut, ce qui est préférable à un débordement sur la peau ;
 *   - un maillot d'origine très sombre laisse peu de dynamique à la carte
 *     d'ombres : le résultat est plus plat qu'avec une base claire ;
 *   - ce n'est pas une photo du vrai maillot porté. Pour un rendu exact, il faut
 *     photographier le mannequin dans chaque maillot (docs/ASSETS.md §2).
 */

/**
 * Bande de tissu représentative d'un kit, prélevée dans le torse de sa photo
 * produit — sous l'écusson et le sponsor, hors des bras de mannequin.
 * Même prélèvement que pour les mockups de dos, pour rester cohérent.
 */
export async function kitFabricBand(slug: KitSlug): Promise<Buffer> {
  const front = path.join(kitDir(slug), 'front.png');
  const { info } = await sharp(front).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });

  const meta = await sharp(front).metadata();
  const canvasWidth = meta.width ?? 0;
  const canvasHeight = meta.height ?? 0;
  const left = Math.round((canvasWidth - info.width) / 2);
  const top = Math.round((canvasHeight - info.height) / 2);

  return sharp(front)
    .extract({
      left: left + Math.round(info.width * 0.3),
      top: top + Math.round(info.height * 0.55),
      width: Math.round(info.width * 0.4),
      height: Math.round(info.height * 0.2),
    })
    .png()
    .toBuffer();
}

/**
 * Masque binaire du polygone, aux dimensions exactes de la photo.
 *
 * Le `resize` final n'est pas décoratif : librsvg rend un SVG à sa propre
 * échelle, et un masque aux dimensions nominales dépasse d'un pixel ou deux, ce
 * qui fait échouer le composite avec « must have same dimensions or smaller ».
 */
async function polygonMask(
  polygon: ScenePoint[],
  width: number,
  height: number,
  blurPx: number,
): Promise<Buffer> {
  const points = polygon.map((p) => `${p.x},${p.y}`).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"
       viewBox="0 0 ${width} ${height}">
       <polygon points="${points}" fill="#fff"/>
     </svg>`;

  let pipeline = sharp(Buffer.from(svg)).resize(width, height, { fit: 'fill' });
  // Bord adouci : une frontière franche trahit le montage sur les épaules.
  if (blurPx > 0) pipeline = pipeline.blur(blurPx);
  return pipeline.greyscale().png().toBuffer();
}

export interface SwapFabricInput {
  /** Photo du mannequin. */
  photo: Buffer;
  /** Zone du vêtement sur cette photo, en pixels. */
  garment: ScenePoint[];
  /** Bande de tissu du kit choisi. */
  fabric: Buffer;
  width: number;
  height: number;
}

export async function swapGarmentFabric({
  photo,
  garment,
  fabric,
  width,
  height,
}: SwapFabricInput): Promise<Buffer> {
  if (garment.length < 3) return photo;

  const mask = await polygonMask(garment, width, height, Math.max(1, Math.round(width * 0.004)));

  // Carte d'éclairage : la luminance de la photo d'origine. `normalise` étale
  // l'histogramme pour récupérer du contraste sur un maillot sombre, sans quoi
  // les plis disparaîtraient sous la nouvelle couleur.
  const shading = await sharp(photo)
    .greyscale()
    .normalise()
    .linear(0.85, 38) // remonte les noirs : évite un tissu neuf presque éteint
    .png()
    .toBuffer();

  // Le tissu est étiré verticalement, ce qui préserve les motifs verticaux
  // (rayures, bandes) au lieu de les écraser.
  const stretched = await sharp(fabric)
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();

  // Couleur × lumière : le nouveau tissu épouse les plis du corps.
  const lit = await sharp(stretched)
    .composite([{ input: shading, blend: 'multiply' }])
    .png()
    .toBuffer();

  // Découpe à la zone du vêtement, puis pose sur la photo.
  const patch = await sharp(lit)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  return sharp(photo).composite([{ input: patch, top: 0, left: 0 }]).png().toBuffer();
}
