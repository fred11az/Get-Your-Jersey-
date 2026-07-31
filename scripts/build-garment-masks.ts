/**
 * Détecte le maillot porté sur chaque photo de mannequin et écrit son masque.
 *   npx tsx scripts/build-garment-masks.ts [--debug]
 *
 * Le contour n'est pas dessiné à la main — une estimation à l'œil produit une
 * plaque décalée. Il n'est pas non plus déduit d'un simple seuil de clarté : les
 * bandes blanches d'un maillot se mesurent entre 233 et 255, le fond de studio
 * entre 246 et 253. Les deux intervalles se chevauchent, aucun seuil ne peut les
 * séparer. C'est ce qui a fait échouer les deux tentatives précédentes.
 *
 * La méthode retenue part de la seule chose qui distingue vraiment le fond du
 * vêtement : sa CONNEXITÉ. Le fond touche le bord de l'image, une bande blanche
 * de maillot non — elle est cernée par du tissu coloré.
 *
 *   1. remplissage du fond depuis les bords de l'image → silhouette de la
 *      personne, bandes blanches comprises ;
 *   2. retrait de la peau (bras, nuque) par signature colorimétrique ;
 *   3. retrait des cheveux, sombres et chauds — ce qui les sépare d'un col navy,
 *      sombre mais froid ;
 *   4. coupe au col et sous l'ourlet, mesurés l'un sur la largeur du plus long
 *      segment continu, l'autre sur la netteté de la rupture horizontale ;
 *   5. plus grande composante connexe, trous bouchés, bord adouci.
 *
 * `--debug` écrit dans tmp-render/ le masque superposé à la photo : c'est ce
 * qu'il faut REGARDER avant d'activer un masque dans un metadata.json.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { loadScenes, sceneDir } from '../lib/scenes';

/**
 * Signature de peau en RVB. Le plafond sur `r - g` est essentiel : sans lui, un
 * rouge de maillot passe pour de la peau. Mesuré sur les photos fournies, les
 * vagues rouges du maillot USA donnent r - g ≈ 190, la peau ≈ 60 à 110.
 */
function isSkin(r: number, g: number, b: number): boolean {
  return r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 15 && r - g < 125 && r - b > 25;
}

/**
 * Cheveux : sombres ET chauds (r ≥ g ≥ b). C'est ce qui les distingue d'un col
 * ou d'un panneau navy, tout aussi sombres mais franchement froids (b > r).
 */
function isHair(r: number, g: number, b: number): boolean {
  return Math.max(r, g, b) < 130 && r >= g && g >= b && r - b > 8;
}

interface Raster {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
}

/** Fond de la photo : médiane des pixels de bordure. */
function backdropColour({ data, width, height, channels }: Raster): [number, number, number] {
  const samples: number[][] = [];
  const at = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
  };
  for (let x = 0; x < width; x++) samples.push(at(x, 0), at(x, height - 1));
  for (let y = 0; y < height; y++) samples.push(at(0, y), at(width - 1, y));
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };
  return [0, 1, 2].map((c) => median(samples.map((s) => s[c] ?? 0))) as [number, number, number];
}

/**
 * Silhouette de la personne : tout ce que le fond n'atteint pas depuis le bord.
 *
 * Le remplissage s'arrête à l'ourlet, et n'est amorcé que depuis les bords
 * gauche, droit et haut. Ce n'est pas un détail :
 *
 *   une bande blanche verticale de maillot a exactement la couleur du fond
 *   (mesuré 249,247,250 contre 252,252,252) et rejoint le short blanc, lui-même
 *   collé au bord bas de l'image. Amorcé en bas, le remplissage remonte donc la
 *   bande et coupe le masque en deux — c'est ce qu'on observait : une moitié de
 *   maillot seulement.
 *
 * Sous l'ourlet il n'y a rien à masquer ; ne pas y amorcer le remplissage coûte
 * donc zéro et supprime le seul chemin de fuite.
 *
 * La pile est explicite et non récursive : 600×1024 déborderait la pile d'appels.
 */
function personSilhouette(raster: Raster, tolerance: number, hem: number): Uint8Array {
  const { data, width, height, channels } = raster;
  const bg = backdropColour(raster);
  const background = new Uint8Array(width * height);
  const stack: number[] = [];
  const floor = Math.min(height - 1, hem);

  const push = (x: number, y: number) => {
    if (y > floor) return;
    const i = y * width + x;
    if (background[i]) return;
    const p = i * channels;
    const distance =
      Math.abs((data[p] ?? 0) - bg[0]) +
      Math.abs((data[p + 1] ?? 0) - bg[1]) +
      Math.abs((data[p + 2] ?? 0) - bg[2]);
    if (distance >= tolerance) return;
    background[i] = 1;
    stack.push(i);
  };

  for (let x = 0; x < width; x++) push(x, 0);
  for (let y = 0; y <= floor; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < floor) push(x, y + 1);
  }

  const person = new Uint8Array(width * height);
  for (let y = 0; y <= floor; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      person[i] = background[i] ? 0 : 1;
    }
  }
  return person;
}

/**
 * Ourlet du maillot : la ligne où il s'arrête et où commencent le short ou le
 * jean. On la reconnaît à ce qu'elle est DROITE — une rupture de couleur qui se
 * produit au même y sur toute la largeur du corps.
 *
 * Ni la largeur de la silhouette ni l'écart moyen entre lignes ne conviennent :
 * les bras tombent le long des hanches, donc la silhouette ne se rétrécit pas à
 * l'ourlet ; et un maillot à vagues horizontales (USA) présente des écarts
 * moyens élevés partout. On compte donc la FRACTION de colonnes en rupture à un
 * y donné : une vague, courbe, l'étale sur des dizaines de lignes ; un ourlet la
 * concentre sur trois.
 *
 * La mesure ne dépend pas de la silhouette — elle la précède, puisque c'est elle
 * qui borne le remplissage.
 */
function hemLine(raster: Raster, quad: { y: number }[]): number {
  const { data, width, height, channels } = raster;
  const bg = backdropColour(raster);
  const quadBottom = Math.max(...quad.map((p) => p.y));
  const quadTop = Math.min(...quad.map((p) => p.y));
  const searchTo = Math.min(height - 5, Math.round(quadBottom + (quadBottom - quadTop) * 0.6));

  let hem = searchTo;
  let strongest = 0;
  for (let y = Math.max(4, quadBottom); y < searchTo; y++) {
    let broken = 0;
    let inside = 0;
    for (let x = 4; x < width - 4; x++) {
      const p = (y * width + x) * channels;
      const distance =
        Math.abs((data[p] ?? 0) - bg[0]) +
        Math.abs((data[p + 1] ?? 0) - bg[1]) +
        Math.abs((data[p + 2] ?? 0) - bg[2]);
      if (distance < 20) continue; // fond : hors du corps
      inside++;
      const above = ((y - 3) * width + x) * channels;
      const below = ((y + 3) * width + x) * channels;
      const delta =
        Math.abs((data[above] ?? 0) - (data[below] ?? 0)) +
        Math.abs((data[above + 1] ?? 0) - (data[below + 1] ?? 0)) +
        Math.abs((data[above + 2] ?? 0) - (data[below + 2] ?? 0));
      if (delta > 90) broken++;
    }
    const fraction = inside ? broken / inside : 0;
    if (fraction > strongest) {
      strongest = fraction;
      hem = y;
    }
  }
  return hem;
}

/**
 * Dilatation ou érosion morphologique, en croix séparable.
 *
 * Enchaînées en dilatation-puis-érosion (une « fermeture »), elles soudent les
 * fentes d'un ou deux pixels que le tri des couleurs laisse le long des coutures
 * et des bandes.
 *
 * Elle soude les fentes d'un ou deux pixels que le tri des couleurs laisse le
 * long des coutures et des bandes — l'ombre au bord d'une bande blanche est
 * sombre et chaude, donc lue comme une mèche de cheveux. Ces fentes courent sur
 * toute la hauteur du maillot : sans fermeture, elles le découpent en trois
 * composantes verticales, et l'étape suivante n'en garde qu'une. C'est
 * exactement ce qu'on observait — une moitié de maillot masquée.
 */
function morph(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
  dilate: boolean,
): Uint8Array {
  const pass = (source: Uint8Array, horizontal: boolean): Uint8Array => {
    const out = new Uint8Array(source.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let value = dilate ? 0 : 1;
        for (let d = -radius; d <= radius; d++) {
          const nx = horizontal ? x + d : x;
          const ny = horizontal ? y : y + d;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            // Hors cadre : neutre pour la dilatation, bloquant pour l'érosion.
            if (!dilate) value = 0;
            continue;
          }
          const v = source[ny * width + nx] ?? 0;
          value = dilate ? Math.max(value, v) : Math.min(value, v);
        }
        out[y * width + x] = value;
      }
    }
    return out;
  };
  return pass(pass(mask, true), false);
}

const dilate = (m: Uint8Array, w: number, h: number, r: number) => morph(m, w, h, r, true);
const erode = (m: Uint8Array, w: number, h: number, r: number) => morph(m, w, h, r, false);

/** Fermeture : dilatation puis érosion. Voir le commentaire ci-dessus. */
function close(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  return erode(dilate(mask, width, height, radius), width, height, radius);
}

/**
 * Première ligne où le masque présente un segment continu vraiment large.
 *
 * C'est la ligne du col. Au-dessus, ce qui subsiste du tri des couleurs n'est
 * qu'un liseré : le pourtour d'une chevelure, un élastique, quelques mèches dont
 * la teinte ne rentre ni dans la peau ni dans le brun. Ces restes sont FINS,
 * là où un col est large. Couper sur la largeur du plus long segment continu les
 * écarte sans toucher au vêtement, et sans imposer la coupe horizontale en
 * travers des épaules qu'une ligne d'épaules produirait — elle laisserait une
 * couture visible sur le rendu final.
 */
function collarLine(mask: Uint8Array, width: number, height: number): number {
  const minimum = width * 0.18;
  for (let y = 0; y < height; y++) {
    let run = 0;
    let longest = 0;
    for (let x = 0; x < width; x++) {
      run = mask[y * width + x] ? run + 1 : 0;
      if (run > longest) longest = run;
    }
    if (longest >= minimum) return y;
  }
  return 0;
}

/** Plus grande composante connexe, pour écarter une mèche ou un reflet isolé. */
function largestComponent(mask: Uint8Array, width: number, height: number): Uint8Array {
  const label = new Int32Array(width * height).fill(-1);
  let best: number[] = [];
  let current = 0;

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || (label[start] ?? 0) >= 0) continue;
    const stack = [start];
    const pixels: number[] = [];
    label[start] = current;
    while (stack.length) {
      const i = stack.pop() as number;
      pixels.push(i);
      const x = i % width;
      const y = (i - x) / width;
      const neighbours = [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1,
      ];
      for (const n of neighbours) {
        if (n < 0 || !mask[n] || (label[n] ?? 0) >= 0) continue;
        label[n] = current;
        stack.push(n);
      }
    }
    if (pixels.length > best.length) best = pixels;
    current++;
  }

  const out = new Uint8Array(width * height);
  for (const i of best) out[i] = 1;
  return out;
}

/** Bouche les trous internes : un logo sombre ou un pli ne doit pas percer. */
function fillHoles(mask: Uint8Array, width: number, height: number): Uint8Array {
  const outside = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const i = y * width + x;
    if (outside[i] || mask[i]) return;
    outside[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = mask[i] || !outside[i] ? 1 : 0;
  return out;
}

async function main() {
  const debug = process.argv.includes('--debug');
  const scenes = await loadScenes();
  if (scenes.length === 0) {
    console.error('Aucune scène. Lancer import-lifestyle-assets.ts avant.');
    process.exit(1);
  }

  for (const scene of scenes) {
    const file = path.join(sceneDir(scene.id), 'photo.jpg');
    const { data, info } = await sharp(await readFile(file))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    const raster: Raster = { data, width, height, channels };

    // L'ourlet se mesure d'abord : il borne le remplissage du fond.
    const hem = hemLine(raster, scene.quad);

    // Tolérance serrée : le fond de studio est uniforme à ±3 niveaux, alors que
    // le blanc d'un maillot s'en écarte d'une dizaine. Trop large, le
    // remplissage s'infiltrerait dans le vêtement par une bande claire.
    const person = personSilhouette(raster, 14, hem);

    let mask: Uint8Array = new Uint8Array(width * height);
    for (let y = 0; y <= hem; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!person[i]) continue;
        const p = i * channels;
        const r = data[p] ?? 0;
        const g = data[p + 1] ?? 0;
        const b = data[p + 2] ?? 0;
        if (isSkin(r, g, b) || isHair(r, g, b)) continue;
        mask[i] = 1;
      }
    }

    // Coupe au col : elle enlève le liseré qui subsiste autour de la chevelure
    // et l'élastique, sans raboter les épaules.
    const collar = collarLine(mask, width, height);
    for (let y = 0; y < collar; y++) {
      for (let x = 0; x < width; x++) mask[y * width + x] = 0;
    }

    // Fermer AVANT de choisir la composante : sinon on ne garde qu'un tiers du
    // maillot, séparé du reste par une fente d'un pixel.
    const closed = close(mask, width, height, 3);
    mask = fillHoles(largestComponent(closed, width, height), width, height);

    // `blur` adoucit la frontière pour que le tissu neuf ne s'arrête pas net sur
    // un escalier de pixels — mais il l'adoucit DES DEUX CÔTÉS. Posé tel quel,
    // le dégradé déborde d'une dizaine de pixels sur le décor et y laisse un
    // halo coloré, très visible sur les épaules. On érode donc le masque de la
    // portée du flou avant de l'appliquer : le fondu se fait alors vers
    // l'intérieur du vêtement, et l'alpha est déjà nul au bord réel.
    const feather = 4;
    const inset = erode(mask, width, height, feather);
    const grey = Buffer.alloc(width * height, 0);
    let kept = 0;
    for (let i = 0; i < inset.length; i++) {
      if (!inset[i]) continue;
      grey[i] = 255;
      kept++;
    }

    const smoothed = await sharp(grey, { raw: { width, height, channels: 1 } })
      .blur(feather / 2)
      .png()
      .toBuffer();

    await writeFile(path.join(sceneDir(scene.id), 'garment-mask.png'), smoothed);

    if (debug) {
      const out = path.join(process.cwd(), 'tmp-render');
      await mkdir(out, { recursive: true });
      // Le masque en aplat magenta sur la photo : c'est la seule façon de voir
      // un débordement de quelques pixels sur la peau ou le décor.
      const tint = Buffer.alloc(width * height * 4);
      for (let i = 0; i < mask.length; i++) {
        tint[i * 4] = 255;
        tint[i * 4 + 1] = 0;
        tint[i * 4 + 2] = 208;
        tint[i * 4 + 3] = mask[i] ? 110 : 0;
      }
      await sharp(await readFile(file))
        .composite([{ input: tint, raw: { width, height, channels: 4 }, top: 0, left: 0 }])
        .jpeg({ quality: 92 })
        .toFile(path.join(out, `mask-${scene.id}.jpg`));
    }

    const coverage = ((kept / (width * height)) * 100).toFixed(1);
    console.log(
      `✓ ${scene.id} — ${width}×${height}, col y=${collar}, ourlet y=${hem}, ${coverage} % de l'image`,
    );
  }

  console.log(
    '\nREGARDER tmp-render/mask-*.jpg (option --debug) avant d\'ajouter\n' +
      '"garmentMask": "garment-mask.png" au metadata.json d\'une scène : c\'est\n' +
      'cette ligne, et elle seule, qui active le remplacement de tissu.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
