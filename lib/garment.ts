import sharp from 'sharp';
import path from 'node:path';
import { kitDir } from './kits';
import type { KitSlug } from './types';

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

export interface SwapFabricInput {
  /** Photo du mannequin. */
  photo: Buffer;
  /**
   * Masque du vêtement, en niveaux de gris aux dimensions de la photo (blanc =
   * tissu). Détecté sur l'image par `scripts/build-garment-masks.ts` : un
   * contour dessiné à la main produit une plaque décalée.
   */
  mask: Buffer;
  /** Bande de tissu du kit choisi. */
  fabric: Buffer;
  width: number;
  height: number;
}

export async function swapGarmentFabric({
  photo,
  mask,
  fabric,
  width,
  height,
}: SwapFabricInput): Promise<Buffer> {
  // Carte d'éclairage : la luminance de la photo d'origine, RELATIVE à la
  // luminance moyenne du vêtement porté.
  //
  // Multiplier par la luminance brute donnerait la couleur du maillot choisi
  // teintée par celle du maillot photographié : le jaune Brésil vire à l'olive
  // sur un mannequin en maillot bleu marine, et le blanc Real Madrid au gris.
  // On divise donc par la moyenne mesurée SOUS LE MASQUE : un pli plus sombre
  // que la moyenne assombrit, un reflet éclaircit, et un vêtement uniformément
  // sombre ne change plus rien.
  //
  // Le facteur `RELIEF` comprime ensuite cet écart. À 1 on garderait tout le
  // contraste de l'image d'origine, y compris l'imprimé du maillot photographié
  // — les vagues du maillot USA resteraient lisibles sous les couleurs du kit
  // choisi. À 0,45 les plis et les ombres du corps subsistent, l'imprimé
  // s'efface.
  const RELIEF = 0.45;
  const luminance = await sharp(photo)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const maskGrey = await sharp(mask)
    .resize(width, height, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();

  let sum = 0;
  let weight = 0;
  for (let i = 0; i < maskGrey.length; i++) {
    const w = (maskGrey[i] ?? 0) / 255;
    if (w < 0.5) continue;
    sum += (luminance.data[i] ?? 0) * w;
    weight += w;
  }
  // Sans masque exploitable, on retombe sur une carte neutre plutôt que sur une
  // division par zéro.
  const mean = weight > 0 ? sum / weight : 128;

  const relit = Buffer.alloc(luminance.data.length);
  for (let i = 0; i < relit.length; i++) {
    // 255 = tissu inchangé, en dessous = assombri. Le `multiply` de sharp ne
    // sait pas éclaircir ; les reflets au-delà de la moyenne sont donc écrêtés,
    // ce qui est sans conséquence visible sur un tissu mat.
    const ratio = (luminance.data[i] ?? 0) / (mean || 1);
    const value = 255 * (1 + RELIEF * (ratio - 1));
    relit[i] = Math.max(0, Math.min(255, Math.round(value)));
  }

  const shading = await sharp(relit, {
    raw: { width: luminance.info.width, height: luminance.info.height, channels: 1 },
  })
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
    .removeAlpha()
    .png()
    .toBuffer();

  // Découpe à la zone du vêtement.
  //
  // Le masque devient le canal ALPHA du tissu ; il n'est pas composé en
  // `dest-in`. La nuance décide de tout : `dest-in` multiplie les alphas, or un
  // PNG en niveaux de gris n'a pas de canal alpha — le sien vaut 1 partout. La
  // découpe était donc silencieusement sans effet, et le tissu recouvrait la
  // photo entière, décor, peau et cheveux compris. Les niveaux intermédiaires du
  // masque (bord adouci) deviennent ici une transparence partielle, ce qui fond
  // la frontière au lieu de la découper en escalier.
  const patch = await sharp(lit)
    .joinChannel(maskGrey, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();

  return sharp(photo).composite([{ input: patch, top: 0, left: 0 }]).png().toBuffer();
}
