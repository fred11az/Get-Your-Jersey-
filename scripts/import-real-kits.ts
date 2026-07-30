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

interface Bbox {
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
}

/**
 * Boîte englobante du vêtement. On échantillonne la couleur des quatre bords
 * pour estimer le fond, puis on retient les pixels qui s'en écartent nettement.
 */
async function detectGarment(file: string): Promise<Bbox> {
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

async function processKit(
  definition: RealKitDefinition,
  sourceFile: string,
): Promise<{ slug: string; confidence: number }> {
  const dir = path.join(process.cwd(), 'public', 'kits', definition.slug);
  await mkdir(dir, { recursive: true });

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

  const normalized = await sharp(sourceFile)
    .rotate()
    .extract(crop)
    .resize(CANVAS.width, CANVAS.height, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  // `contain` laisse des bandes blanches : on recalcule où le vêtement a atterri.
  const contained = await sharp(normalized).trim({ threshold: 12 }).metadata();
  const garment = {
    width: contained.width ?? CANVAS.width,
    height: contained.height ?? CANVAS.height,
  };
  const offsetX = Math.round((CANVAS.width - garment.width) / 2);
  const offsetY = Math.round((CANVAS.height - garment.height) / 2);

  await writeFile(path.join(dir, 'front.png'), normalized);
  // Faute de photo de dos, le mockup dos reprend la face — voir docs/DIVERGENCES.md.
  await writeFile(path.join(dir, 'back.png'), normalized);

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
    color_hex: definition.colorHex,
    mockup: CANVAS,
    tiers,
  };

  await writeFile(path.join(dir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  return { slug: definition.slug, confidence: box.confidence };
}

async function main() {
  const sourceDir = process.argv[2];
  if (!sourceDir) {
    console.error('Usage : npx tsx scripts/import-real-kits.ts <dossier-source>');
    process.exit(1);
  }

  const available = await readdir(sourceDir);
  const report: { slug: string; confidence: number }[] = [];

  for (const definition of REAL_KITS) {
    const match = available.find((f) => f.includes(definition.sourceMarker));
    if (!match) {
      console.warn(`⚠ ${definition.slug} : aucune photo contenant « ${definition.sourceMarker} »`);
      continue;
    }
    report.push(await processKit(definition, path.join(sourceDir, match)));
    console.log(`✓ ${definition.slug.padEnd(16)} ← ${match}`);
  }

  console.log('\nConfiance de détection du vêtement :');
  for (const row of [...report].sort((a, b) => a.confidence - b.confidence)) {
    const flag = row.confidence < 0.25 || row.confidence > 0.9 ? ' ← à vérifier' : '';
    console.log(`  ${row.slug.padEnd(16)} ${(row.confidence * 100).toFixed(0)}%${flag}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
