/**
 * Génère une scène animée de DÉMONSTRATION, pour valider le mécanisme sans
 * attendre les photos du mannequin.
 *   npx tsx scripts/generate-demo-scene.ts
 *
 * Les images sont dérivées d'un mockup de dos, animées par un léger balancement
 * et un pas de marche simulés. Ce n'est évidemment pas un humain : cela sert à
 * (a) vérifier que le lecteur canvas suit bien le quad image par image, et
 * (b) montrer le résultat attendu.
 *
 * À remplacer par une vraie séquence photographiée — voir docs/ASSETS.md §2.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { kitDir } from '../lib/kits';
import type { SceneMetadata } from '../lib/scenes';

const FRAMES = 12;
const SIZE = { width: 480, height: 640 };
const SCENE_ID = 'demo-walk';

/**
 * Zone de flocage sur le mockup source, en fraction de l'image. Elle couvre le
 * nom ET le numéro : le lecteur animé ne pose qu'une image par quadrilatère, et
 * l'API lui fournit les deux réunis.
 */
const ZONE = { x: 0.30, y: 0.275, w: 0.34, h: 0.53 };

async function main() {
  const dir = path.join(process.cwd(), 'public', 'scenes', SCENE_ID);
  await mkdir(dir, { recursive: true });

  const source = path.join(kitDir('portugal'), 'back.png');
  const frames: SceneMetadata['sequence'] = { fps: 12, frames: [] };

  for (let i = 0; i < FRAMES; i++) {
    const phase = (i / FRAMES) * Math.PI * 2;

    // Balancement des épaules et léger pas de côté : les deux suffisent à
    // donner l'illusion d'une marche, et surtout à faire bouger le quad d'une
    // image à l'autre — ce qu'il s'agit de vérifier.
    const swayDeg = Math.sin(phase) * 4;
    const shiftX = Math.sin(phase) * 0.012 * SIZE.width;
    const bobY = Math.abs(Math.cos(phase)) * 0.008 * SIZE.height;

    const frame = await sharp(source)
      .resize(SIZE.width, SIZE.height, { fit: 'contain', background: '#f2f4f7' })
      .rotate(swayDeg, { background: '#f2f4f7' })
      .resize(SIZE.width, SIZE.height, { fit: 'cover' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    const file = `frame-${String(i).padStart(2, '0')}.jpg`;
    await writeFile(path.join(dir, file), frame);

    // Le quad suit le même balancement que l'image : c'est ce couplage que le
    // lecteur doit respecter pour que le visuel reste collé au dos.
    const rad = (swayDeg * Math.PI) / 180;
    const cx = SIZE.width * (ZONE.x + ZONE.w / 2) + shiftX;
    const cy = SIZE.height * (ZONE.y + ZONE.h / 2) + bobY;
    const hw = (SIZE.width * ZONE.w) / 2;
    const hh = (SIZE.height * ZONE.h) / 2;

    const corner = (dx: number, dy: number) => ({
      x: Math.round(cx + dx * hw * Math.cos(rad) - dy * hh * Math.sin(rad)),
      y: Math.round(cy + dx * hw * Math.sin(rad) + dy * hh * Math.cos(rad)),
    });

    frames.frames.push({
      file,
      quad: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)],
    });
  }

  // Image fixe de repli, utilisée si le lecteur animé échoue.
  await sharp(source)
    .resize(SIZE.width, SIZE.height, { fit: 'contain', background: '#f2f4f7' })
    .jpeg({ quality: 85 })
    .toFile(path.join(dir, 'photo.jpg'));

  const metadata: SceneMetadata = {
    id: SCENE_ID,
    label: 'Démonstration — marche',
    gender: 'man',
    photo: SIZE,
    quad: frames.frames[0]!.quad,
    kitSlug: null,
    sequence: frames,
  };

  await writeFile(
    path.join(dir, 'metadata.json'),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );

  console.log(`✓ scène ${SCENE_ID} : ${FRAMES} images à ${frames.fps} i/s`);
  console.log('  À remplacer par une séquence photographiée (docs/ASSETS.md §2).');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
