/**
 * Prépare les déclinaisons du logo depuis le fichier source.
 *   npx tsx scripts/prepare-brand-assets.ts <logo-source.png>
 *
 * Le fond du logo est laissé BLANC et non rendu transparent : le maillot dessiné
 * à l'intérieur du logo est lui-même blanc, un détourage par proximité de
 * couleur le percerait. Le site ayant un fond blanc (charte, section 9), un logo
 * sur fond blanc s'y fond sans artefact.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT_BRAND = path.join(process.cwd(), 'public', 'brand');
const OUT_APP = path.join(process.cwd(), 'app');

async function main() {
  const source = process.argv[2];
  if (!source) {
    console.error('Usage : npx tsx scripts/prepare-brand-assets.ts <logo-source.png>');
    process.exit(1);
  }

  await mkdir(OUT_BRAND, { recursive: true });

  // --- Logo complet, marges retirées ---------------------------------------
  const trimmed = await sharp(source).trim({ threshold: 6 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  console.log(`logo détouré des marges : ${meta.width}×${meta.height}`);

  await writeFile(path.join(OUT_BRAND, 'logo.png'), trimmed);

  // Version large pour le partage social (OpenGraph attend du 1200×630).
  await sharp({
    create: { width: 1200, height: 630, channels: 4, background: '#ffffff' },
  })
    .composite([
      {
        input: await sharp(trimmed)
          .resize(560, 560, { fit: 'inside', withoutEnlargement: true })
          .toBuffer(),
        gravity: 'center',
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_BRAND, 'og.png'));

  // --- Favicon --------------------------------------------------------------
  // Le logo complet porte un texte et une accroche : illisibles à 32 px. On
  // recadre le seul dos de maillot avec son numéro, quasi carré, qui reste
  // identifiable à la taille d'un onglet. Le téléphone est écarté : deux objets
  // se chevauchant deviennent une tache à 32 px.
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const emblem = {
    left: Math.round(width * 0.22),
    top: Math.round(height * 0.03),
    width: Math.round(width * 0.4),
    height: Math.round(height * 0.4),
  };

  const square = await sharp(trimmed)
    .extract(emblem)
    .resize(512, 512, { fit: 'contain', background: '#ffffff' })
    .png()
    .toBuffer();

  // Conventions de fichiers Next.js : app/icon.png et app/apple-icon.png sont
  // repris automatiquement dans <head>, sans configuration.
  await sharp(square).resize(512, 512).png().toFile(path.join(OUT_APP, 'icon.png'));
  await sharp(square)
    .resize(180, 180)
    .flatten({ background: '#ffffff' })
    .png()
    .toFile(path.join(OUT_APP, 'apple-icon.png'));

  console.log('✓ public/brand/logo.png, public/brand/og.png');
  console.log('✓ app/icon.png (favicon), app/apple-icon.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
