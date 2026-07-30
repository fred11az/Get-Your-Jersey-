/** Vérifie que la hauteur de lettre du flocage reste constante. */
import { fitTransform, textToPath } from '../lib/glyphs';

async function main() {
  const box = { width: Math.round(378 * 1.6), height: Math.round(504 * 0.17) };
  const padding = Math.min(box.width, box.height) * (0.035 + 0.014);
  console.log(`bloc nom : ${box.width}×${box.height}, padding ${padding.toFixed(1)}\n`);
  console.log('nom            hauteur  largeur  condensation');
  for (const name of ['RODRI', 'MESSI', 'RONALDO', 'GRIEZMANN', 'BELLINGHAM', 'ABCDEFGHIJKLMNO']) {
    const glyph = await textToPath(name);
    const fit = fitTransform(glyph, box, { padding, minCondense: 0.62 });
    console.log(
      name.padEnd(15),
      fit.renderedHeight.toFixed(1).padStart(6),
      fit.renderedWidth.toFixed(1).padStart(8),
      `  ${(fit.scaleX / fit.scaleY).toFixed(3)}`,
    );
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
