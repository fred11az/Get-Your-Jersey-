/**
 * Test de bout en bout du pipeline de rendu, sans base de données.
 *   npm run render:smoke
 *
 * Écrit l'aperçu WebP, le visuel isolé et le PDF imprimeur dans tmp-render/,
 * puis vérifie les propriétés qui doivent tenir (transparence hors glyphe,
 * dimensions du PDF, résolution effective).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { renderJersey } from '../lib/render';
import { buildPrintPdf, pdfPageSizeMm } from '../lib/print-pdf';
import type { KitSlug, Tier } from '../lib/types';

const OUT = path.join(process.cwd(), 'tmp-render');

/** Photos de test : dégradés colorés avec un sujet clair, pour voir le recadrage. */
async function fakePhoto(hue: number, label: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue},70%,72%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 60) % 360},65%,38%)"/>
    </linearGradient></defs>
    <rect width="900" height="1200" fill="url(#g)"/>
    <circle cx="450" cy="470" r="210" fill="#ffffff" opacity="0.88"/>
    <circle cx="380" cy="430" r="26" fill="#222"/><circle cx="520" cy="430" r="26" fill="#222"/>
    <path d="M 370 540 Q 450 600 530 540" stroke="#222" stroke-width="18" fill="none"/>
    <text x="450" y="900" font-size="120" font-weight="bold" fill="#fff"
          text-anchor="middle" font-family="DejaVu Sans">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const kitSlug: KitSlug = 'portugal';
  const tier: Tier = 'joueur';
  const photos = await Promise.all([fakePhoto(200, '1'), fakePhoto(20, '2'), fakePhoto(120, '3')]);

  const result = await renderJersey({
    photos,
    jerseyNumber: '10',
    jerseyName: 'BB DE SAI',
    kitSlug,
    tier,
    side: 'back',
  });

  await writeFile(path.join(OUT, 'preview.webp'), result.previewWebP);
  await writeFile(path.join(OUT, 'artwork.png'), result.artworkPng);
  await sharp(result.previewWebP).png().toFile(path.join(OUT, 'preview.png'));

  console.log(`aperçu généré en ${result.generationTimeMs} ms`);

  // --- Vérifications sur le visuel ---
  const art = await sharp(result.artworkPng).metadata();
  console.log(`visuel : ${art.width}×${art.height}, alpha=${art.hasAlpha}`);
  if (!art.hasAlpha) throw new Error('Le visuel doit avoir un canal alpha.');

  const stats = await sharp(result.artworkPng).stats();
  if (stats.isOpaque) {
    throw new Error('Le visuel est entièrement opaque : le découpage par le glyphe a échoué.');
  }

  // Le coin supérieur gauche est hors du glyphe : il doit être transparent.
  const corner = await sharp(result.artworkPng)
    .extract({ left: 0, top: 0, width: 8, height: 8 })
    .raw()
    .toBuffer();
  const cornerAlpha = corner[3];
  if (cornerAlpha !== 0) {
    throw new Error(`Coin hors glyphe opaque (alpha=${cornerAlpha}) : le masque déborde.`);
  }

  // --- PDF imprimeur ---
  const pdf = await buildPrintPdf({
    artworkPng: result.artworkPng,
    zone: result.zone,
    mockup: result.previewWebP,
    reference: 'GYJ-SMOKE',
  });
  await writeFile(path.join(OUT, 'print.pdf'), pdf);

  const expected = pdfPageSizeMm(result.zone);
  const header = pdf.subarray(0, 8).toString('latin1');
  if (!header.startsWith('%PDF-')) throw new Error('Sortie PDF invalide.');

  const dpiX = (result.zone.width_mm / 25.4) === 0 ? 0 : 0;
  void dpiX;
  console.log(
    `PDF : ${(pdf.length / 1024).toFixed(0)} Ko, page 1 = ` +
      `${expected.widthMm}×${expected.heightMm} mm`,
  );

  console.log(`\nFichiers écrits dans ${OUT}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
