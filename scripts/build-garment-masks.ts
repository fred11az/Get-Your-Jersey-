/**
 * Détecte le maillot porté sur chaque photo de mannequin et écrit son masque.
 *   npx tsx scripts/build-garment-masks.ts
 *
 * Le contour n'est pas dessiné à la main — une estimation à l'œil produit une
 * plaque décalée. Il est déduit de l'image par élimination :
 *
 *   1. le fond est quasi blanc  → écarté par distance au blanc ;
 *   2. la peau (bras, nuque)    → écartée par la signature R > G > B ;
 *   3. le bas (short, jean)     → écarté sous l'ourlet, déduit de la zone de
 *      flocage qui est nécessairement sur le maillot.
 *
 * Ce qui reste est le vêtement. Le masque est ensuite lissé pour supprimer le
 * bruit et adoucir la frontière.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { loadScenes, sceneDir } from '../lib/scenes';

/** Signature classique d'un pixel de peau en RVB. */
function isSkin(r: number, g: number, b: number): boolean {
  return r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 15 && r - b > 25;
}

async function main() {
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

    // L'ourlet : sous la zone de flocage, plus une marge. La zone est par
    // construction sur le maillot, c'est donc une borne sûre.
    const quadBottom = Math.max(...scene.quad.map((p) => p.y));
    const quadTop = Math.min(...scene.quad.map((p) => p.y));
    const hem = Math.min(height, Math.round(quadBottom + (quadBottom - quadTop) * 0.32));

    const mask = Buffer.alloc(width * height, 0);
    let kept = 0;

    for (let y = 0; y < hem; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels;
        const r = data[i] ?? 255;
        const g = data[i + 1] ?? 255;
        const b = data[i + 2] ?? 255;

        const background = r > 228 && g > 228 && b > 228;
        if (background || isSkin(r, g, b)) continue;

        mask[y * width + x] = 255;
        kept++;
      }
    }

    // Lissage : ferme les trous du motif et adoucit la frontière. `median`
    // supprime les pixels isolés que le seuillage laisse dans les cheveux.
    const smoothed = await sharp(mask, { raw: { width, height, channels: 1 } })
      .median(9)
      .blur(3)
      .png()
      .toBuffer();

    await writeFile(path.join(sceneDir(scene.id), 'garment-mask.png'), smoothed);

    // Le masque n'est PAS déclaré automatiquement dans la scène. Le seuil de
    // fond actuel (>228 sur les trois canaux) ne reconnaît pas le gris clair
    // d'un fond studio : le masque déborde alors sur le décor et la peau, et le
    // tissu inonde toute l'image. Inspecter garment-mask.png, corriger les
    // seuils, et n'ajouter `"garmentMask": "garment-mask.png"` au metadata.json
    // qu'une fois le masque visuellement propre.

    const coverage = ((kept / (width * height)) * 100).toFixed(1);
    console.log(`✓ ${scene.id} — masque ${width}×${height}, ${coverage} % de l'image`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
