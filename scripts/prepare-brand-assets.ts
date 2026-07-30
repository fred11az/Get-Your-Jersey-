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

interface Band {
  top: number;
  height: number;
}

/** Bandes de lignes de texte, détectées par densité d'encre. */
async function inkBands(png: Buffer): Promise<Band[]> {
  const { data, info } = await sharp(png)
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const bands: Band[] = [];
  let start: number | null = null;

  for (let y = 0; y <= height; y++) {
    let ink = 0;
    if (y < height) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels;
        if ((data[i] ?? 255) < 235 || (data[i + 1] ?? 255) < 235 || (data[i + 2] ?? 255) < 235) {
          ink++;
        }
      }
    }
    const dense = y < height && ink / width > 0.12;
    if (dense && start === null) start = y;
    if (!dense && start !== null) {
      if (y - start > 12) bands.push({ top: start, height: y - start });
      start = null;
    }
  }
  return bands;
}

/**
 * Les deux lignes du nom, parmi les bandes détectées.
 *
 * Deux critères, et le second est indispensable : deux lignes d'un même bloc
 * typographique ont des hauteurs de casse *comparables*. Sans cette contrainte,
 * l'illustration du maillot — la bande la plus haute de toutes — se retrouve
 * appariée avec « GET YOUR » et le recadrage part sur le dessin.
 */
function pickWordmark(bands: Band[]): Band {
  const MAX_HEIGHT_RATIO = 2;

  let best = { top: 0, height: 0, score: -1 };
  for (let i = 0; i < bands.length - 1; i++) {
    const a = bands[i] as Band;
    const b = bands[i + 1] as Band;

    // Lignes voisines : un écart supérieur à la hauteur d'une ligne sépare deux
    // éléments distincts du logo, pas deux lignes d'un même mot.
    if (b.top - (a.top + a.height) > Math.min(a.height, b.height)) continue;

    // Hauteurs comparables : écarte l'illustration, bien plus haute qu'une ligne.
    const ratio = Math.max(a.height, b.height) / Math.min(a.height, b.height);
    if (ratio > MAX_HEIGHT_RATIO) continue;

    const score = a.height + b.height;
    if (score > best.score) {
      best = { top: a.top, height: b.top + b.height - a.top, score };
    }
  }

  if (best.score < 0) {
    throw new Error(
      'Bloc de marque introuvable : aucune paire de lignes de hauteurs comparables. ' +
        'Le logo source a-t-il changé ?',
    );
  }
  return { top: best.top, height: best.height };
}

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
  // Recadrage sur le bloc de marque « GET YOUR / JERSEY ».
  //
  // Les bornes ne sont pas codées en dur mais mesurées : on calcule la densité
  // d'encre par ligne, ce qui isole les bandes de texte, puis on retient les
  // deux plus hautes bandes consécutives — les deux lignes du nom. L'accroche
  // « UPLOAD. PERSONALIZE. WEAR IT. » est ainsi exclue d'elle-même : trop fine
  // pour survivre à une réduction en 32 px, elle ne donnerait qu'une bavure.
  // Un logo retouché reste donc correctement recadré sans réajustement manuel.
  const bands = await inkBands(trimmed);
  const wordmark = pickWordmark(bands);
  console.log(`bloc de marque détecté : y ${wordmark.top}→${wordmark.top + wordmark.height}`);

  // Recadrage horizontal serré sur l'encre réelle de ces deux lignes.
  const strip = await sharp(trimmed)
    .extract({ left: 0, top: wordmark.top, width: meta.width ?? 0, height: wordmark.height })
    .trim({ threshold: 10 })
    .png()
    .toBuffer();

  // Le nom est un bloc large : contenu dans un carré, il laisse des bandes
  // blanches. On les réduit en ajoutant seulement une marge minimale.
  const square = await sharp({
    create: { width: 512, height: 512, channels: 4, background: '#ffffff' },
  })
    .composite([
      {
        input: await sharp(strip).resize(486, 486, { fit: 'inside' }).toBuffer(),
        gravity: 'center',
      },
    ])
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
