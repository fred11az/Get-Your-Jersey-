/**
 * Génère un mockup de DOS pour chaque kit, à partir de sa photo de face.
 *   npx tsx scripts/generate-back-mockups.ts
 *
 * Pourquoi : le flocage (nom + numéro) se place au dos du maillot, mais les
 * photos produit fournies sont des vues de face. Faute de photo de dos, on en
 * fabrique une qui reste fidèle au maillot réel :
 *
 *   1. on prélève une bande horizontale dans le torse de la photo, sous les
 *      logos et l'écusson — elle porte la vraie couleur ET le vrai motif
 *      (vagues du Portugal, rayures du Barça, dégradés…) ;
 *   2. cette bande est étirée verticalement dans une silhouette de dos. Étirer
 *      verticalement préserve les motifs verticaux : les rayures restent des
 *      rayures ;
 *   3. col et bas de manches reprennent les couleurs prélevées à leur endroit
 *      réel sur la photo.
 *
 * Le résultat n'est pas une photo du dos, c'est un mockup dérivé du maillot
 * réel : il en garde la colorimétrie et le motif, et la géométrie de la zone
 * d'impression est exactement connue — ce qu'aucune photo trouvée ailleurs ne
 * garantirait.
 *
 * Dès qu'une vraie photo de dos est disponible, la déposer et relancer
 * `scripts/import-real-kits.ts` : ce script devient inutile pour ce kit.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { KIT_SLUGS, type KitMetadata, type KitSlug, type Tier } from '../lib/types';
import { kitDir } from '../lib/kits';

const CANVAS = { width: 1200, height: 1600 };

/** Silhouette de dos : corps + manches + col fermé. */
const JERSEY_PATH = [
  'M 512 200',
  'C 458 204 424 216 390 232',
  'L 168 338',
  'C 146 348 137 370 144 392',
  'L 196 552',
  'C 203 572 226 582 246 574',
  'L 348 536',
  'L 348 1158',
  'C 348 1182 366 1200 390 1200',
  'L 810 1200',
  'C 834 1200 852 1182 852 1158',
  'L 852 536',
  'L 954 574',
  'C 974 582 997 572 1004 552',
  'L 1056 392',
  'C 1063 370 1054 348 1032 338',
  'L 810 232',
  'C 776 216 742 204 688 200',
  // Col vu de dos : légère courbe descendante, sans échancrure.
  'C 676 236 524 236 512 200',
  'Z',
].join(' ');

/** Bornes du torse dans la silhouette, pour cadrer les zones d'impression. */
const TORSO = { left: 348, right: 852, top: 536, bottom: 1200 };

const TIER_PRICING: Record<Tier, { price_eur: number; price_usd: number }> = {
  supporter: { price_eur: 35, price_usd: 38 },
  authentique: { price_eur: 59, price_usd: 65 },
  joueur: { price_eur: 89, price_usd: 97 },
};

/** Zones centrées sur le dos, rapport 3:4 strict, cohérent avec les mm. */
const TIER_ZONES: Record<Tier, { width: number; y: number; width_mm: number; height_mm: number }> = {
  supporter: { width: 300, y: 620, width_mm: 180, height_mm: 240 },
  authentique: { width: 339, y: 600, width_mm: 198, height_mm: 264 },
  joueur: { width: 378, y: 580, width_mm: 216, height_mm: 288 },
};

type Rgb = { r: number; g: number; b: number };

const hex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/**
 * Couleur moyenne d'une région de l'image.
 *
 * Attention : `sharp().stats()` analyse l'image d'ENTRÉE et ignore les
 * opérations en attente dans le pipeline. Un `.extract().stats()` renvoie donc
 * les statistiques de l'image entière, fond blanc compris. Il faut matérialiser
 * l'extrait dans un buffer avant de l'analyser.
 */
async function averageColor(
  image: Buffer,
  region: { left: number; top: number; width: number; height: number },
): Promise<Rgb> {
  const cropped = await sharp(image).extract(region).removeAlpha().png().toBuffer();
  const { channels } = await sharp(cropped).stats();
  return {
    r: channels[0]?.mean ?? 0,
    g: channels[1]?.mean ?? 0,
    b: channels[2]?.mean ?? 0,
  };
}

interface Garment {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Boîte du vêtement sur le canevas blanc produit par l'import. */
async function garmentBox(image: Buffer): Promise<Garment> {
  const { info } = await sharp(image).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  return {
    left: Math.round((CANVAS.width - width) / 2),
    top: Math.round((CANVAS.height - height) / 2),
    width,
    height,
  };
}

async function buildBack(slug: KitSlug): Promise<{ collar: string; fabric: string }> {
  const dir = kitDir(slug);
  const front = await readFile(path.join(dir, 'front.png'));
  const box = await garmentBox(front);

  // Bande de torse : sous l'écusson et le sponsor, au-dessus de l'ourlet.
  // On garde toute la largeur centrale pour préserver les motifs verticaux.
  // 30–70 % de la largeur : au-delà, les photos sur mannequin captent les bras
  // sombres, qui se retrouvaient étirés dans les manches du mockup.
  const strip = {
    left: box.left + Math.round(box.width * 0.3),
    top: box.top + Math.round(box.height * 0.55),
    width: Math.round(box.width * 0.4),
    height: Math.round(box.height * 0.2),
  };

  const fabricColor = await averageColor(front, strip);
  // Col : prélevé au ras du haut du vêtement, là où se trouve la bordure.
  const collarColor = await averageColor(front, {
    left: box.left + Math.round(box.width * 0.42),
    top: box.top + Math.round(box.height * 0.03),
    width: Math.round(box.width * 0.16),
    height: Math.round(box.height * 0.04),
  });

  // La bande est étirée à la taille du canevas : étirer verticalement conserve
  // les rayures et motifs verticaux, qui sont l'essentiel de l'identité visuelle.
  const fabric = await sharp(front)
    .extract(strip)
    .resize(CANVAS.width, CANVAS.height, { fit: 'fill' })
    .png()
    .toBuffer();

  const silhouette = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}">
       <path d="${JERSEY_PATH}" fill="#fff"/>
     </svg>`,
  );

  const body = await sharp(fabric)
    .composite([{ input: silhouette, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Ombrage latéral + col + ourlet, par-dessus le tissu.
  const details = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}">
       <defs>
         <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
           <stop offset="0%" stop-color="#000" stop-opacity="0.22"/>
           <stop offset="20%" stop-color="#000" stop-opacity="0"/>
           <stop offset="80%" stop-color="#000" stop-opacity="0"/>
           <stop offset="100%" stop-color="#000" stop-opacity="0.22"/>
         </linearGradient>
         <clipPath id="body"><path d="${JERSEY_PATH}"/></clipPath>
       </defs>
       <g clip-path="url(#body)">
         <rect width="${CANVAS.width}" height="${CANVAS.height}" fill="url(#shade)"/>
         <path d="M 512 200 C 524 236 676 236 688 200 L 706 206
                  C 692 252 508 252 494 206 Z" fill="${hex(collarColor)}"/>
         <rect x="348" y="1168" width="504" height="14" fill="#000" opacity="0.12"/>
       </g>
       <path d="${JERSEY_PATH}" fill="none" stroke="#0f172a" stroke-opacity="0.22" stroke-width="3"/>
     </svg>`,
  );

  const back = await sharp({
    create: {
      width: CANVAS.width,
      height: CANVAS.height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: body }, { input: details }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(path.join(dir, 'back.png'), back);
  return { collar: hex(collarColor), fabric: hex(fabricColor) };
}

/** Réécrit les zones d'impression pour qu'elles visent le dos, pas la face. */
async function updateZones(slug: KitSlug): Promise<void> {
  const file = path.join(kitDir(slug), 'metadata.json');
  const meta = JSON.parse(await readFile(file, 'utf8')) as KitMetadata;

  const centerX = Math.round((TORSO.left + TORSO.right) / 2);
  for (const tier of Object.keys(TIER_ZONES) as Tier[]) {
    const spec = TIER_ZONES[tier];
    const height = Math.round((spec.width * 4) / 3);

    if (spec.y + height > TORSO.bottom) {
      throw new Error(`Zone ${tier} de ${slug} dépasse l'ourlet du maillot.`);
    }

    meta.tiers[tier] = {
      print_zone: {
        x: centerX - Math.round(spec.width / 2),
        y: spec.y,
        width: spec.width,
        height,
        width_mm: spec.width_mm,
        height_mm: spec.height_mm,
      },
      ...TIER_PRICING[tier],
    };
  }

  await writeFile(file, `${JSON.stringify(meta, null, 2)}\n`);
}

async function main() {
  for (const slug of KIT_SLUGS) {
    const colors = await buildBack(slug);
    await updateZones(slug);
    console.log(`✓ ${slug.padEnd(16)} tissu ${colors.fabric}  col ${colors.collar}`);
  }
  console.log(`\n${KIT_SLUGS.length} mockups de dos générés, zones d'impression recentrées.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
