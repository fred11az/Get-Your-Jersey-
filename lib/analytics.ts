import { isDbConfigured, query } from './db';
import type { AnalyticsEvent, EventType } from './types';

/**
 * Tracking best-effort : une erreur d'analytics ne doit jamais faire échouer un
 * parcours d'achat. On loggue et on continue.
 */
export async function trackEvent(
  type: EventType | string,
  options: { orderId?: string | null; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await query(
      'INSERT INTO events (type, order_id, metadata) VALUES ($1, $2, $3)',
      [type, options.orderId ?? null, options.metadata ? JSON.stringify(options.metadata) : null],
    );
  } catch (error) {
    console.error('[analytics] échec du tracking de', type, error);
  }
}

export async function eventCountsByType(): Promise<{ type: string; count: number }[]> {
  const rows = await query<{ type: string; count: string }>(
    'SELECT type, COUNT(*)::text AS count FROM events GROUP BY type ORDER BY COUNT(*) DESC',
  );
  return rows.map((r) => ({ type: r.type, count: Number(r.count) }));
}

export async function recentEvents(limit = 100): Promise<AnalyticsEvent[]> {
  return query<AnalyticsEvent>(
    'SELECT * FROM events ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
}
