/**
 * Importe les visuels professionnels : photos lifestyle et mannequins portés.
 *   npx tsx scripts/import-lifestyle-assets.ts <dossier-source>
 *
 * Deux familles distinctes :
 *
 *  - `public/lifestyle/` : photos de groupe et de studio, décoratives, utilisées
 *    en bandeau d'accueil et en pied de page ;
 *  - `public/scenes/` : mannequins photographiés de face ET de dos sur fond
 *    blanc. Les planches source sont des doubles vues côte à côte : on les coupe
 *    en deux pour obtenir une image par orientation.
 *
 * Les zones de flocage (`quad`) sont relevées à la main sur les vues de dos et
 * exprimées en fractions de l'image : elles restent donc valides si la photo est
 * redimensionnée.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { SceneMetadata } from '../lib/scenes';

const LIFESTYLE_OUT = path.join(process.cwd(), 'public', 'lifestyle');
const SCENES_OUT = path.join(process.cwd(), 'public', 'scenes');

/** Photos décoratives : recadrées en paysage, deux largeurs pour le responsive. */
const LIFESTYLE = [
  { marker: 'WA0091', slug: 'street-group', ratio: 16 / 9 },
  { marker: 'WA0090', slug: 'studio-lineup', ratio: 16 / 9 },
  { marker: 'WA0089', slug: 'studio-duo', ratio: 16 / 9 },
];

/**
 * Planches mannequin. `split` indique où couper entre la vue de face et la vue
 * de dos, en fraction de la largeur.
 *
 * `backQuad` : les quatre coins de la zone de flocage sur la vue de DOS, en
 * fractions de cette vue (haut-gauche, haut-droit, bas-droit, bas-gauche). La
 * zone couvre le nom et le numéro, comme attendu par le lecteur.
 */
const MODELS = [
  {
    marker: 'WA0087',
    id: 'man',
    label: 'man',
    gender: 'man' as const,
    kitSlug: null,
    split: 0.5,
    // Le nom est floqué AU-DESSUS du quad : son bord haut doit laisser la place
    // du bloc nom sous le col, sinon le texte retombe sur la nuque.
    backQuad: [
      { x: 0.35, y: 0.38 },
      { x: 0.66, y: 0.38 },
      { x: 0.66, y: 0.78 },
      { x: 0.35, y: 0.78 },
    ],
  },
  {
    marker: 'WA0088',
    id: 'woman',
    label: 'woman',
    gender: 'woman' as const,
    kitSlug: null,
    split: 0.5,
    backQuad: [
      { x: 0.37, y: 0.40 },
      { x: 0.65, y: 0.40 },
      { x: 0.65, y: 0.78 },
      { x: 0.37, y: 0.78 },
    ],
  },
];

async function findSource(dir: string, marker: string): Promise<string | null> {
  const { readdir } = await import('node:fs/promises');
  const files = await readdir(dir);
  const match = files.find((f) => f.includes(marker));
  return match ? path.join(dir, match) : null;
}

async function importLifestyle(dir: string) {
  await mkdir(LIFESTYLE_OUT, { recursive: true });

  for (const item of LIFESTYLE) {
    const source = await findSource(dir, item.marker);
    if (!source) {
      console.warn(`⚠ lifestyle ${item.slug} : ${item.marker} introuvable`);
      continue;
    }

    // Deux largeurs suffisent : `next/image` interpole entre elles via srcset.
    for (const width of [1600, 800]) {
      await sharp(source)
        .resize(width, Math.round(width / item.ratio), { fit: 'cover', position: 'north' })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(path.join(LIFESTYLE_OUT, `${item.slug}-${width}.jpg`));
    }
    console.log(`✓ lifestyle/${item.slug}`);
  }
}

async function importModels(dir: string) {
  for (const model of MODELS) {
    const source = await findSource(dir, model.marker);
    if (!source) {
      console.warn(`⚠ mannequin ${model.id} : ${model.marker} introuvable`);
      continue;
    }

    const meta = await sharp(source).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    const half = Math.round(width * model.split);

    const outDir = path.join(SCENES_OUT, model.id);
    await mkdir(outDir, { recursive: true });

    /**
     * Découpe une moitié de la planche.
     *
     * `extract` et `trim` ne peuvent pas cohabiter dans un même pipeline Sharp :
     * le rognage s'applique AVANT le découpage, l'image rétrécit, et la zone
     * demandée sort alors de ses bornes (« bad extract area »). On matérialise
     * donc le découpage dans un buffer avant de rogner.
     */
    const half_ = (left: number, w: number) =>
      sharp(source).extract({ left, top: 0, width: w, height }).png().toBuffer();

    const finish = (buffer: Buffer) =>
      sharp(buffer)
        .trim({ threshold: 8 })
        .resize(900, null, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();

    // Vue de face : illustrative, pas de flocage (il est au dos).
    const front = await finish(await half_(0, half));
    await writeFile(path.join(outDir, 'front.jpg'), front);

    // Vue de dos : c'est elle qui porte le flocage.
    const back = await finish(await half_(half, width - half));
    await writeFile(path.join(outDir, 'photo.jpg'), back);

    const backMeta = await sharp(back).metadata();
    const bw = backMeta.width ?? 0;
    const bh = backMeta.height ?? 0;

    const metadata: SceneMetadata = {
      id: model.id,
      label: model.label,
      gender: model.gender,
      photo: { width: bw, height: bh },
      quad: model.backQuad.map((p) => ({
        x: Math.round(p.x * bw),
        y: Math.round(p.y * bh),
      })) as SceneMetadata['quad'],
      kitSlug: model.kitSlug,
      blendOpacity: 0.95,
    };

    await writeFile(
      path.join(outDir, 'metadata.json'),
      `${JSON.stringify(metadata, null, 2)}\n`,
    );
    console.log(`✓ scenes/${model.id} — dos ${bw}×${bh}, quad relevé`);
  }
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage : npx tsx scripts/import-lifestyle-assets.ts <dossier-source>');
    process.exit(1);
  }
  await importLifestyle(dir);
  await importModels(dir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
