/** Contrôle visuel du remplacement de tissu. npx tsx scripts/fabric-check.ts */
import sharp from 'sharp';
import { renderJersey } from '../lib/render';
import type { KitSlug } from '../lib/types';

async function photo(hue: number) {
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="hsl(${hue},60%,55%)"/><circle cx="400" cy="420" r="190" fill="#f6e7d8"/></svg>`)).jpeg().toBuffer();
}

async function main() {
  const photos = await Promise.all([photo(20), photo(200), photo(120)]);
  const cases: { kit: KitSlug; scene: string }[] = [
    { kit: 'brazil', scene: 'man' },
    { kit: 'spain', scene: 'man' },
    { kit: 'barcelona', scene: 'woman' },
    { kit: 'real-madrid', scene: 'woman' },
  ];
  const tiles = [];
  let x = 0;
  for (const c of cases) {
    const r = await renderJersey({
      photos, jerseyNumber: '10', jerseyName: 'MARTIN',
      kitSlug: c.kit, tier: 'joueur', side: 'back', sceneId: c.scene,
    });
    const img = await sharp(r.previewWebP).resize(300).png().toBuffer();
    tiles.push({ input: img, left: x, top: 0 });
    x += (await sharp(img).metadata()).width + 8;
    console.log(`${c.kit} sur ${c.scene} : ${r.generationTimeMs} ms`);
  }
  await sharp({ create: { width: x, height: 620, channels: 4, background: '#eef1f4' } })
    .composite(tiles).jpeg({ quality: 90 }).toFile('tmp-render/fabric.jpg');
  console.log('tmp-render/fabric.jpg');
}
main().catch((e) => { console.error(e); process.exit(1); });
