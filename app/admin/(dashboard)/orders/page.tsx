import Link from 'next/link';
import { isDbConfigured } from '@/lib/db';
import { listOrders } from '@/lib/orders';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/types';
import { OrdersTable } from '@/components/admin/OrdersTable';

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'En attente',
  PAID: 'Payées',
  SENT_TO_PRINTER: 'Chez l’imprimeur',
  SHIPPED: 'Expédiées',
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string }>;
}) {
  if (!isDbConfigured()) {
    return <p className="gyj-card p-7 text-sm text-ink-soft">DATABASE_URL non configurée.</p>;
  }

  const query = await searchParams;
  const status =
    query.status && (ORDER_STATUSES as readonly string[]).includes(query.status)
      ? (query.status as OrderStatus)
      : undefined;

  const orders = await listOrders({ status, from: query.from, to: query.to });

  /** Conserve les filtres de date en changeant de statut. */
  const href = (next?: OrderStatus) => {
    const params = new URLSearchParams();
    if (next) params.set('status', next);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    const qs = params.toString();
    return qs ? `/admin/orders?${qs}` : '/admin/orders';
  };

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold">Commandes</h1>

      <div className="mb-5 flex flex-wrap items-end gap-4">
        <nav className="flex flex-wrap gap-1.5">
          <Link
            href={href()}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              !status ? 'border-brand bg-brand text-white' : 'border-hairline hover:border-brand'
            }`}
          >
            Toutes
          </Link>
          {ORDER_STATUSES.map((value) => (
            <Link
              key={value}
              href={href(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                status === value
                  ? 'border-brand bg-brand text-white'
                  : 'border-hairline hover:border-brand'
              }`}
            >
              {STATUS_LABELS[value]}
            </Link>
          ))}
        </nav>

        {/* Filtre de dates en GET : l'URL reste partageable et copiable. */}
        <form method="get" className="flex flex-wrap items-end gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <div>
            <label className="gyj-label text-[0.7rem]" htmlFor="from">
              Du
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={query.from}
              className="gyj-field py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="gyj-label text-[0.7rem]" htmlFor="to">
              Au
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={query.to}
              className="gyj-field py-1.5 text-xs"
            />
          </div>
          <button
            type="submit"
            className="rounded-[8px] border border-hairline px-3 py-1.5 text-xs font-semibold hover:border-brand hover:text-brand"
          >
            Filtrer
          </button>
        </form>

        <p className="ml-auto text-sm text-ink-soft">
          {orders.length} commande{orders.length > 1 ? 's' : ''}
        </p>
      </div>

      <OrdersTable orders={orders} />
    </>
  );
}
