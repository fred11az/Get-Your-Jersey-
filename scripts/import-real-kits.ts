/**
 * Importe les photos de maillots réelles en assets de kit normalisés.
 *   npx tsx scripts/import-real-kits.ts <dossier-source>
 *
 * Chaque photo est recadrée sur le vêtement détecté, posée sur un canevas blanc
 * 1200×1600, et sa zone d'impression est dérivée de la boîte englobante du
 * vêtement plutôt que codée en dur : une photo remplacée par une autre prise de
 * plus loin ou de plus près garde une zone correcte.
 *
 * La détection compare chaque pixel à la couleur dominante des bords. Elle est
 * fiable sur fond uni (Portugal, Espagne) et approximative sur fond chargé
 * (mannequin sur grille, parquet) : le rapport final indique le taux de
 * confiance, et `ZONE_OVERRIDES` permet de corriger un kit à la main.
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { REAL_KITS, type RealKitDefinition } from '../lib/kit-catalog';
import type { KitMetadata, Tier } from '../lib/types';

const CANVAS = { width: 1200, height: 1600 };

/** Prix par finition, communs à tous les kits au MVP. */
const TIER_PRICING: Record<Tier, { price_eur: number; price_usd: number }> = {
  supporter: { price_eur: 35, price_usd: 38 },
  authentique: { price_eur: 59, price_usd: 65 },
  joueur: { price_eur: 89, price_usd: 97 },
};

/**
 * Géométrie de la zone d'impression, en fraction de la boîte du vêtement.
 * Le flocage occupe le haut du dos : centré horizontalement, démarrant sous les
 * épaules. Rapport d'aspect 3:4 imposé pour rester cohérent avec les mm.
 */
const ZONE_GEOMETRY: Record<Tier, { widthFrac: number; topFrac: number }> = {
  supporter: { widthFrac: 0.34, topFrac: 0.32 },
  authentique: { widthFrac: 0.4, topFrac: 0.3 },
  joueur: { widthFrac: 0.46, topFrac: 0.28 },
};

const ZONE_MM: Record<Tier, { width_mm: number; height_mm: number }> = {
  supporter: { width_mm: 180, height_mm: 240 },
  authentique: { width_mm: 198, height_mm: 264 },
  joueur: { width_mm: 216, height_mm: 288 },
};

/** Une photo source : chemin de fichier ou image déjà en mémoire. */
type Source = string | Buffer;

interface Bbox {
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
}

/**
 * Ramène un fond de studio légèrement gris ou crème au blanc pur.
 *
 * Les photos prises contre un mur ne sortent pas sur du blanc franc (mesuré à
 * 239,235,231 sur la photo Argentine extérieur) : posées telles quelles à côté
 * des visuels produit sur fond blanc, elles trahissent une vignette grise dans
 * la grille du catalogue.
 *
 * Le test porte sur la SATURATION autant que sur la clarté : un pixel clair mais
 * coloré (jaune Brésil, crème Espagne extérieur) est conservé. C'est ce qui
 * empêche l'opération de manger le vêtement lui-même — raison pour laquelle elle
 * reste malgré tout opt-in par kit.
 */
async function whitenBackdrop(file: Source): Promise<Buffer> {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.from(data);

  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    const r = data[p] ?? 0;
    const g = data[p + 1] ?? 0;
    const b = data[p + 2] ?? 0;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (min > 196 && max - min < 28) {
      out[p] = 255;
      out[p + 1] = 255;
      out[p + 2] = 255;
    }
  }

  return sharp(out, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * Boîte englobante du vêtement. On échantillonne la couleur des quatre bords
 * pour estimer le fond, puis on retient les pixels qui s'en écartent nettement.
 */
async function detectGarment(file: Source): Promise<Bbox> {
  const SAMPLE = 200;
  const { data, info } = await sharp(file)
    .resize(SAMPLE, SAMPLE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const at = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0] as const;
  };

  // Couleur de fond = médiane des pixels de bordure.
  const edge: number[][] = [];
  for (let x = 0; x < width; x++) {
    edge.push([...at(x, 0)], [...at(x, height - 1)]);
  }
  for (let y = 0; y < height; y++) {
    edge.push([...at(0, y)], [...at(width - 1, y)]);
  }
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };
  const bg = [0, 1, 2].map((c) => median(edge.map((p) => p[c] ?? 0)));

  const THRESHOLD = 46;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let hits = 0;

  // On ignore une marge de 4 % : vignettage et bords d'étagère faussent la mesure.
  const inset = Math.round(SAMPLE * 0.04);
  for (let y = inset; y < height - inset; y++) {
    for (let x = inset; x < width - inset; x++) {
      const [r, g, b] = at(x, y);
      const distance =
        Math.abs(r - (bg[0] ?? 0)) + Math.abs(g - (bg[1] ?? 0)) + Math.abs(b - (bg[2] ?? 0));
      if (distance > THRESHOLD) {
        hits++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const meta = await sharp(file).metadata();
  const srcW = meta.width ?? SAMPLE;
  const srcH = meta.height ?? SAMPLE;

  if (maxX < 0 || maxY < 0) {
    return { left: 0, top: 0, width: srcW, height: srcH, confidence: 0 };
  }

  const scaleX = srcW / width;
  const scaleY = srcH / height;
  return {
    left: Math.round(minX * scaleX),
    top: Math.round(minY * scaleY),
    width: Math.round((maxX - minX + 1) * scaleX),
    height: Math.round((maxY - minY + 1) * scaleY),
    confidence: hits / (width * height),
  };
}

/**
 * Corrections manuelles, en fraction du canevas final, quand la détection
 * dérape. Deux maillots sont photographiés de biais : la boîte englobante
 * inclut le portant, ce qui décale le centre du vêtement.
 */
const ZONE_OVERRIDES: Partial<
  Record<string, { cxFrac: number; topFrac: number; widthFrac?: number }>
> = {
  'portugal-away': { cxFrac: 0.53, topFrac: 0.3 },
  france: { cxFrac: 0.46, topFrac: 0.32 },
};

/** Efface un flocage en étirant une bande de tissu propre sur sa zone. */
async function erasePrint(
  sourceFile: Source,
  crop: { left: number; top: number; width: number; height: number },
  zone: { x: number; y: number; w: number; h: number },
): Promise<Buffer> {
  const base = await sharp(sourceFile).rotate().extract(crop).png().toBuffer();

  const target = {
    left: Math.round(crop.width * zone.x),
    top: Math.round(crop.height * zone.y),
    width: Math.round(crop.width * zone.w),
    height: Math.round(crop.height * zone.h),
  };

  // Bande propre prélevée juste au-dessus de la zone, sur toute sa largeur.
  const bandHeight = Math.max(8, Math.round(target.height * 0.16));
  const band = await sharp(base)
    .extract({
      left: target.left,
      top: Math.max(0, target.top - bandHeight - 4),
      width: target.width,
      height: bandHeight,
    })
    .png()
    .toBuffer();

  // Étirement vertical : conserve les motifs verticaux du maillot.
  const patch = await sharp(band)
    .resize(target.width, target.height, { fit: 'fill' })
    .blur(0.6)
    .png()
    .toBuffer();

  return sharp(base)
    .composite([{ input: patch, left: target.left, top: target.top }])
    .png()
    .toBuffer();
}

/**
 * Boîte du vêtement sur le canevas blanc, cintre exclu.
 *
 * Un simple `trim()` prend tout ce qui n'est pas blanc, donc aussi le crochet du
 * cintre, une ficelle ou une ombre portée : la boîte démarre alors au sommet de
 * l'image et la zone d'impression, calculée en fraction de sa hauteur, remonte
 * dans le col. On raisonne donc par profil de lignes — une ligne ne compte que
 * si elle est large, ce qu'un crochet n'est jamais.
 */
function garmentBox(
  data: Buffer,
  info: { width: number; height: number; channels: number },
): { left: number; top: number; width: number; height: number } | null {
  const { width, height, channels } = info;
  const perRow = new Int32Array(height);
  const minXRow = new Int32Array(height).fill(width);
  const maxXRow = new Int32Array(height).fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      // Le canevas est blanc par construction (`contain` sur fond blanc).
      if ((data[i] ?? 255) > 240 && (data[i + 1] ?? 255) > 240 && (data[i + 2] ?? 255) > 240) {
        continue;
      }
      perRow[y] = (perRow[y] ?? 0) + 1;
      if (x < (minXRow[y] ?? width)) minXRow[y] = x;
      if (x > (maxXRow[y] ?? -1)) maxXRow[y] = x;
    }
  }

  const widest = Math.max(...perRow);
  if (widest === 0) return null;
  // Un quart de la ligne la plus large : au-dessus, c'est du vêtement ; en
  // dessous, un accessoire ou du bruit.
  const floor = widest * 0.25;

  let top = -1;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let y = 0; y < height; y++) {
    if ((perRow[y] ?? 0) < floor) continue;
    if (top < 0) top = y;
    bottom = y;
    if ((minXRow[y] ?? width) < left) left = minXRow[y] ?? width;
    if ((maxXRow[y] ?? -1) > right) right = maxXRow[y] ?? -1;
  }

  if (top < 0 || right < 0) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Vêtement recadré et posé sur le canevas blanc, avec sa boîte finale. */
interface Normalized {
  png: Buffer;
  garment: { width: number; height: number };
  offsetX: number;
  offsetY: number;
  confidence: number;
}

/**
 * Recadre une photo sur le vêtement détecté et la pose sur le canevas blanc.
 * Renvoie aussi où le vêtement a atterri : c'est de cette boîte que dérive la
 * zone d'impression, jamais de constantes en dur.
 */
async function normalizePhoto(
  file: string,
  eraseZone: RealKitDefinition['eraseZone'],
  whiten = false,
): Promise<Normalized> {
  // Le blanchiment passe en premier : la détection du vêtement compare au fond,
  // elle est d'autant plus nette que le fond est franc.
  const sourceFile: Source = whiten ? await whitenBackdrop(file) : file;

  const box = await detectGarment(sourceFile);

  // Recadrage sur le vêtement avec 6 % de respiration, puis mise sur canevas blanc.
  const pad = Math.round(Math.max(box.width, box.height) * 0.06);
  const meta = await sharp(sourceFile).metadata();
  const crop = {
    left: Math.max(0, box.left - pad),
    top: Math.max(0, box.top - pad),
    width: Math.min((meta.width ?? 0) - Math.max(0, box.left - pad), box.width + pad * 2),
    height: Math.min((meta.height ?? 0) - Math.max(0, box.top - pad), box.height + pad * 2),
  };

  // Effacement d'un flocage déjà présent, AVANT normalisation.
  //
  // La reconstitution exploite une propriété du produit : les motifs d'un
  // maillot sont verticaux (rayures, bandes, dégradés). Une bande de tissu
  // propre prélevée au-dessus de la zone, puis étirée verticalement, restitue
  // donc le motif exact sous le numéro effacé. Un simple aplat de couleur
  // laisserait une tache visible sur un maillot rayé.
  const cleaned = eraseZone ? await erasePrint(sourceFile, crop, eraseZone) : sourceFile;

  const png = await sharp(cleaned)
    .rotate()
    .extract(eraseZone ? { ...crop, left: 0, top: 0 } : crop)
    .resize(CANVAS.width, CANVAS.height, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  // `contain` laisse des bandes blanches : on recalcule où le vêtement a atterri.
  //
  // La mesure se fait sur les PIXELS du canevas, pas sur un pipeline en attente.
  // `sharp(x).trim().metadata()` décrit l'image d'entrée et ignore les opérations
  // en attente : il renverrait 1200×1600, soit le canevas entier, et la zone
  // d'impression dégénérerait en une fraction constante du canevas, identique
  // pour tous les kits. Même piège que `.stats()`, documenté dans
  // docs/DIVERGENCES.md §4.
  const raster = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const measured = garmentBox(raster.data, raster.info);

  const box2 = measured ?? {
    left: 0,
    top: 0,
    width: CANVAS.width,
    height: CANVAS.height,
  };
  if (!measured) {
    console.warn(`⚠ ${sourceFile} : vêtement non mesurable sur le canevas, zone par défaut`);
  }

  return {
    png,
    garment: { width: box2.width, height: box2.height },
    offsetX: box2.left,
    offsetY: box2.top,
    confidence: box.confidence,
  };
}

async function processKit(
  definition: RealKitDefinition,
  sourceFile: string,
  backFile?: string,
): Promise<{ slug: string; confidence: number; realBack: boolean }> {
  const dir = path.join(process.cwd(), 'public', 'kits', definition.slug);
  await mkdir(dir, { recursive: true });

  const front = await normalizePhoto(sourceFile, definition.eraseZone, definition.whitenBackdrop);
  // Le flocage à effacer est repéré sur la face ; sur une vraie photo de dos le
  // maillot est vierge, on n'y touche pas.
  const back = backFile
    ? await normalizePhoto(backFile, undefined, definition.whitenBackdrop)
    : null;

  await writeFile(path.join(dir, 'front.png'), front.png);
  // Sans photo de dos, le mockup dos reprend la face — voir docs/DIVERGENCES.md §4.
  await writeFile(path.join(dir, 'back.png'), (back ?? front).png);

  // La zone d'impression se mesure sur l'image où le flocage sera posé : le dos
  // dès qu'il est réel. Front et dos ne se recadrent pas identiquement (les
  // manches ne tombent pas au même endroit), une zone calée sur la face
  // dériverait de quelques dizaines de pixels sur le dos.
  const { garment, offsetX, offsetY } = back ?? front;

  const tiers = {} as KitMetadata['tiers'];
  for (const tier of Object.keys(TIER_PRICING) as Tier[]) {
    const geometry = ZONE_GEOMETRY[tier];
    const override = ZONE_OVERRIDES[definition.slug];

    const widthFrac = override?.widthFrac ?? geometry.widthFrac;
    const topFrac = override?.topFrac ?? geometry.topFrac;

    const width = Math.round(garment.width * widthFrac);
    const height = Math.round((width * 4) / 3);
    const centerX = override
      ? Math.round(CANVAS.width * override.cxFrac)
      : offsetX + Math.round(garment.width / 2);

    tiers[tier] = {
      print_zone: {
        x: centerX - Math.round(width / 2),
        y: offsetY + Math.round(garment.height * topFrac),
        width,
        height,
        ...ZONE_MM[tier],
      },
      ...TIER_PRICING[tier],
    };
  }

  const metadata: KitMetadata = {
    slug: definition.slug as KitMetadata['slug'],
    name: definition.name,
    flocking: definition.flocking,
    color_hex: definition.colorHex,
    mockup: CANVAS,
    tiers,
  };

  await writeFile(path.join(dir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  return {
    slug: definition.slug,
    confidence: (back ?? front).confidence,
    realBack: back !== null,
  };
}

async function main() {
  const sourceDir = process.argv[2];
  if (!sourceDir) {
    console.error('Usage : npx tsx scripts/import-real-kits.ts <dossier-source>');
    process.exit(1);
  }

  const available = await readdir(sourceDir);
  const report: { slug: string; confidence: number; realBack: boolean }[] = [];

  for (const definition of REAL_KITS) {
    const match = available.find((f) => f.includes(definition.sourceMarker));
    if (!match) {
      console.warn(`⚠ ${definition.slug} : aucune photo contenant « ${definition.sourceMarker} »`);
      continue;
    }

    const backMatch = definition.backMarker
      ? available.find((f) => f.includes(definition.backMarker as string))
      : undefined;
    if (definition.backMarker && !backMatch) {
      console.warn(
        `⚠ ${definition.slug} : dos « ${definition.backMarker} » introuvable, mockup dérivé de la face`,
      );
    }

    report.push(
      await processKit(
        definition,
        path.join(sourceDir, match),
        backMatch ? path.join(sourceDir, backMatch) : undefined,
      ),
    );
    console.log(
      `✓ ${definition.slug.padEnd(18)} ← ${match}${backMatch ? ` + ${backMatch} (dos réel)` : ''}`,
    );
  }

  console.log('\nConfiance de détection du vêtement :');
  for (const row of [...report].sort((a, b) => a.confidence - b.confidence)) {
    const flag = row.confidence < 0.25 || row.confidence > 0.9 ? ' ← à vérifier' : '';
    const back = row.realBack ? 'dos réel' : 'dos dérivé';
    console.log(`  ${row.slug.padEnd(18)} ${(row.confidence * 100).toFixed(0)}%  ${back}${flag}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
