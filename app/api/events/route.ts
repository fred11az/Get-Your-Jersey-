import { NextResponse } from 'next/server';
import { trackEvent } from '@/lib/analytics';
import { EVENT_TYPES } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * Enregistrement d'un événement d'analytics.
 *
 * Le type est validé contre la liste connue : cette route est publique, et sans
 * filtre n'importe qui pourrait remplir la table de types arbitraires. On répond
 * toujours 204, même en cas d'échec : le tracking ne doit jamais perturber le
 * parcours d'achat côté client.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { type?: unknown; metadata?: unknown };

    if (
      typeof body.type === 'string' &&
      (EVENT_TYPES as readonly string[]).includes(body.type)
    ) {
      const metadata =
        body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
          ? (body.metadata as Record<string, unknown>)
          : undefined;
      await trackEvent(body.type, { metadata });
    }
  } catch {
    // Silencieux par conception.
  }

  return new NextResponse(null, { status: 204 });
}
