import { query, queryOne } from './db';
import type { DesignJson, KitSlug, Order, OrderStatus, Size, Tier } from './types';
import type { Locale } from '@/i18n/routing';

export interface CreateOrderInput {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  postal_code: string;
  city: string;
  language: Locale;
  kit_slug: KitSlug;
  kit_tier: Tier;
  size: Size;
  jersey_name: string;
  jersey_number: string;
  amount: number;
  currency: string;
  design_json: DesignJson;
  render_preview_url: string | null;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const rows = await query<Order>(
    `INSERT INTO orders (
       first_name, last_name, email, phone, country, address, postal_code, city,
       language, kit_slug, kit_tier, size, jersey_name, jersey_number,
       amount, currency, design_json, render_preview_url
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
     ) RETURNING *`,
    [
      input.first_name,
      input.last_name,
      input.email,
      input.phone,
      input.country,
      input.address,
      input.postal_code,
      input.city,
      input.language,
      input.kit_slug,
      input.kit_tier,
      input.size,
      input.jersey_name,
      input.jersey_number,
      input.amount,
      input.currency,
      JSON.stringify(input.design_json),
      input.render_preview_url,
    ],
  );
  return rows[0] as Order;
}

export async function getOrder(id: string): Promise<Order | null> {
  return queryOne<Order>('SELECT * FROM orders WHERE id = $1', [id]);
}

export interface OrderFilters {
  status?: OrderStatus;
  from?: string;
  to?: string;
  limit?: number;
}

export async function listOrders(filters: OrderFilters = {}): Promise<Order[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    // Borne haute inclusive sur la journée entière.
    conditions.push(`created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  params.push(filters.limit ?? 200);

  return query<Order>(
    `SELECT * FROM orders
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY created_at DESC
      LIMIT $${params.length}`,
    params,
  );
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null> {
  const rows = await query<Order>(
    `UPDATE orders
        SET status = $1,
            paid_at = CASE WHEN $1 = 'PAID' AND paid_at IS NULL THEN NOW() ELSE paid_at END,
            updated_at = NOW()
      WHERE id = $2
      RETURNING *`,
    [status, id],
  );
  return rows[0] ?? null;
}

export async function setRenderUrls(
  id: string,
  urls: { preview?: string; pdf?: string },
): Promise<void> {
  await query(
    `UPDATE orders
        SET render_preview_url = COALESCE($1, render_preview_url),
            render_pdf_url = COALESCE($2, render_pdf_url),
            updated_at = NOW()
      WHERE id = $3`,
    [urls.preview ?? null, urls.pdf ?? null, id],
  );
}

export async function markWhatsappSent(id: string): Promise<void> {
  await query('UPDATE orders SET whatsapp_sent_at = NOW(), updated_at = NOW() WHERE id = $1', [id]);
}

export async function deleteOrder(id: string): Promise<void> {
  // events.order_id référence orders(id) : on détache avant de supprimer.
  await query('UPDATE events SET order_id = NULL WHERE order_id = $1', [id]);
  await query('DELETE FROM orders WHERE id = $1', [id]);
}

export interface DashboardStats {
  total: number;
  pending: number;
  paid: number;
  revenue: number;
  currency: string;
}

export async function dashboardStats(): Promise<DashboardStats> {
  const row = await queryOne<{
    total: string;
    pending: string;
    paid: string;
    revenue: string | null;
  }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE status = 'PENDING')::text AS pending,
            COUNT(*) FILTER (WHERE status <> 'PENDING')::text AS paid,
            COALESCE(SUM(amount) FILTER (WHERE status <> 'PENDING'), 0)::text AS revenue
       FROM orders`,
  );

  return {
    total: Number(row?.total ?? 0),
    pending: Number(row?.pending ?? 0),
    paid: Number(row?.paid ?? 0),
    revenue: Number(row?.revenue ?? 0),
    currency: 'EUR',
  };
}

/** Commandes par jour sur les 30 derniers jours, jours vides inclus. */
export async function ordersPerDay(days = 30): Promise<{ day: string; count: number }[]> {
  const rows = await query<{ day: string; count: string }>(
    `SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COUNT(o.id)::text AS count
       FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, INTERVAL '1 day') AS d(day)
       LEFT JOIN orders o ON o.created_at::date = d.day
      GROUP BY d.day
      ORDER BY d.day`,
    [days],
  );
  return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
}
