import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { fetchStored, putFile } from '@/lib/blob';
import { isKitSlug } from '@/lib/kits';
import { renderJersey, RenderError } from '@/lib/render';
import { GlyphCoverageError, isValidJerseyNumber, normalizeJerseyName } from '@/lib/glyphs';
import { TIERS, type Tier } from '@/lib/types';

// Sharp est un module natif : il ne fonctionne pas sur l'Edge Runtime.
export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_PHOTOS = 3;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Cache mémoire de 5 min (section 6 de docs/SPEC.md). Il est local à l'instance :
 * sur Vercel, plusieurs instances ne le partagent pas. C'est acceptable — il sert
 * à absorber les allers-retours d'un même visiteur qui revient à l'étape 5, pas à
 * mutualiser entre visiteurs.
 */
const cache = new Map<string, { url: string; at: number }>();

function cacheKey(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32);
}

interface Body {
  photoUrls?: unknown;
  jerseyNumber?: unknown;
  jerseyName?: unknown;
  kitSlug?: unknown;
  jerseyTier?: unknown;
  sceneId?: unknown;
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const photoUrls = Array.isArray(body.photoUrls)
    ? body.photoUrls.filter((u): u is string => typeof u === 'string')
    : [];
  const jerseyNumber = typeof body.jerseyNumber === 'string' ? body.jerseyNumber.trim() : '';
  const jerseyName =
    typeof body.jerseyName === 'string' ? normalizeJerseyName(body.jerseyName) : '';
  const kitSlug = typeof body.kitSlug === 'string' ? body.kitSlug : '';
  const jerseyTier = typeof body.jerseyTier === 'string' ? body.jerseyTier : '';
  // Une scène inconnue est ignorée par le pipeline, qui retombe sur le mockup.
  const sceneId = typeof body.sceneId === 'string' && body.sceneId ? body.sceneId : undefined;

  if (photoUrls.length === 0 || photoUrls.length > MAX_PHOTOS) {
    return NextResponse.json({ error: 'INVALID_PHOTO_COUNT' }, { status: 400 });
  }
  if (!isValidJerseyNumber(jerseyNumber)) {
    return NextResponse.json({ error: 'INVALID_NUMBER' }, { status: 400 });
  }
  if (!isKitSlug(kitSlug)) {
    return NextResponse.json({ error: 'UNKNOWN_KIT' }, { status: 400 });
  }
  if (!(TIERS as readonly string[]).includes(jerseyTier)) {
    return NextResponse.json({ error: 'UNKNOWN_TIER' }, { status: 400 });
  }

  const key = cacheKey({ photoUrls, jerseyNumber, jerseyName, kitSlug, jerseyTier, sceneId });
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({
      previewUrl: hit.url,
      generationTime: Date.now() - startedAt,
      cached: true,
    });
  }

  try {
    const photos = await Promise.all(photoUrls.map(fetchStored));

    const result = await renderJersey({
      photos,
      jerseyNumber,
      jerseyName,
      kitSlug,
      tier: jerseyTier as Tier,
      side: 'back',
      sceneId,
    });

    const stored = await putFile(`previews/${key}.webp`, result.previewWebP, 'image/webp');
    cache.set(key, { url: stored.url, at: Date.now() });

    // Purge paresseuse : évite que le cache grossisse indéfiniment.
    if (cache.size > 200) {
      for (const [k, v] of cache) {
        if (Date.now() - v.at > CACHE_TTL_MS) cache.delete(k);
      }
    }

    return NextResponse.json({
      previewUrl: stored.url,
      sceneId: result.sceneId,
      generationTime: Date.now() - startedAt,
      renderTime: result.generationTimeMs,
    });
  } catch (error) {
    if (error instanceof GlyphCoverageError) {
      return NextResponse.json(
        { error: 'UNSUPPORTED_CHARACTERS', characters: error.missing },
        { status: 422 },
      );
    }
    if (error instanceof RenderError) {
      return NextResponse.json({ error: error.code }, { status: 422 });
    }
    console.error('[render/preview] échec', error);
    return NextResponse.json({ error: 'RENDER_FAILED' }, { status: 500 });
  }
}
