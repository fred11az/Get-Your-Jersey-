/** Planche de rendus finis, pour contrôle visuel. npx tsx scripts/preview-board.ts */
import sharp from 'sharp';
import { renderJersey } from '../lib/render';
import type { KitSlug } from '../lib/types';

async function photo(hue: number): Promise<Buffer> {
  return sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
      <rect width="900" height="1200" fill="hsl(${hue},58%,54%)"/>
      <circle cx="450" cy="520" r="230" fill="#f6e7d8"/>
      <circle cx="375" cy="480" r="24" fill="#2b2b2b"/><circle cx="525" cy="480" r="24" fill="#2b2b2b"/>
      <path d="M 370 600 Q 450 660 530 600" stroke="#2b2b2b" stroke-width="16" fill="none"/>
      <rect y="1020" width="900" height="180" fill="hsl(${(hue + 40) % 360},50%,34%)"/>
    </svg>`),
  ).jpeg().toBuffer();
}

// Les dix-neuf kits : c'est la planche qui prouve que le flocage n'est pas
// générique — chaque maillot a sa paire de couleurs, lisible sur SON tissu.
const CASES: { kit: KitSlug; number: string; name: string }[] = [
  { kit: 'portugal', number: '7', name: 'RONALDO' },
  { kit: 'portugal-away', number: '8', name: 'BRUNO' },
  { kit: 'spain', number: '9', name: 'MORATA' },
  { kit: 'spain-away', number: '6', name: 'RODRI' },
  { kit: 'france', number: '10', name: 'BB DE SAI' },
  { kit: 'france-away', number: '7', name: 'GRIEZMANN' },
  { kit: 'england', number: '9', name: 'KANE' },
  { kit: 'england-away', number: '10', name: 'BELLINGHAM' },
  { kit: 'brazil', number: '11', name: 'RAPHINHA' },
  { kit: 'brazil-away', number: '20', name: 'VINICIUS' },
  { kit: 'argentina', number: '10', name: 'MESSI' },
  { kit: 'argentina-away', number: '22', name: 'LAUTARO' },
  { kit: 'usa', number: '10', name: 'PULISIC' },
  { kit: 'usa-away', number: '8', name: 'MCKENNIE' },
  { kit: 'barcelona', number: '19', name: 'LAMINE' },
  { kit: 'real-madrid', number: '5', name: 'BELLINGHAM' },
  { kit: 'real-madrid-away', number: '7', name: 'VINI JR' },
  { kit: 'psg', number: '10', name: 'DEMBELE' },
  { kit: 'psg-away', number: '5', name: 'MARQUINHOS' },
];

async function main() {
  const photos = await Promise.all([photo(20), photo(200), photo(120)]);
  const W = 300;
  const COLS = 5;
  const tiles = await Promise.all(
    CASES.map(async (c, i) => {
      const r = await renderJersey({
        photos,
        jerseyNumber: c.number,
        jerseyName: c.name,
        kitSlug: c.kit,
        tier: 'joueur',
        side: 'back',
      });
      const img = await sharp(r.previewWebP).resize(W).png().toBuffer();
      return { input: img, left: (i % COLS) * W, top: Math.floor(i / COLS) * Math.round((W * 1600) / 1200) };
    }),
  );
  const h = Math.round((W * 1600) / 1200);
  const rows = Math.ceil(CASES.length / COLS);
  await sharp({ create: { width: W * COLS, height: h * rows, channels: 4, background: '#ffffff' } })
    .composite(tiles)
    .jpeg({ quality: 90 })
    .toFile('tmp-render/board.jpg');
  console.log('tmp-render/board.jpg');

}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
