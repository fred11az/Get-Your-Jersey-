import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { KIT_SLUGS, type KitMetadata, type KitSlug, type Tier } from './types';

const cache = new Map<KitSlug, KitMetadata>();

export function kitDir(slug: KitSlug): string {
  return path.join(process.cwd(), 'public', 'kits', slug);
}

export function isKitSlug(value: string): value is KitSlug {
  return (KIT_SLUGS as readonly string[]).includes(value);
}

export async function loadKit(slug: KitSlug): Promise<KitMetadata> {
  const cached = cache.get(slug);
  if (cached) return cached;

  const raw = await readFile(path.join(kitDir(slug), 'metadata.json'), 'utf8');
  const meta = JSON.parse(raw) as KitMetadata;
  cache.set(slug, meta);
  return meta;
}

export async function loadAllKits(): Promise<KitMetadata[]> {
  return Promise.all(KIT_SLUGS.map(loadKit));
}

export async function priceFor(
  slug: KitSlug,
  tier: Tier,
  currency: 'EUR' | 'USD',
): Promise<number> {
  const kit = await loadKit(slug);
  const meta = kit.tiers[tier];
  return currency === 'USD' ? meta.price_usd : meta.price_eur;
}

export function formatPrice(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
