import Link from 'next/link';
import { isDbConfigured } from '@/lib/db';
import { dashboardStats, listOrders, ordersPerDay } from '@/lib/orders';
import { DashboardStats, OrdersChart } from '@/components/admin/DashboardStats';
import { OrdersTable } from '@/components/admin/OrdersTable';

export default async function AdminDashboardPage() {
  if (!isDbConfigured()) {
    return (
      <div className="gyj-card p-7">
        <h1 className="mb-2 text-xl font-extrabold">Base de données non configurée</h1>
        <p className="text-sm leading-relaxed text-ink-soft">
          Renseigner <code className="font-mono">DATABASE_URL</code> puis lancer{' '}
          <code className="font-mono">npm run db:seed</code>.
        </p>
      </div>
    );
  }

  const [stats, perDay, recent] = await Promise.all([
    dashboardStats(),
    ordersPerDay(30),
    listOrders({ limit: 10 }),
  ]);

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold">Tableau de bord</h1>

      <DashboardStats stats={stats} />

      <div className="mt-6">
        <OrdersChart data={perDay} />
      </div>

      <div className="mt-8 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">10 dernières commandes</h2>
        <Link href="/admin/orders" className="text-sm font-semibold text-brand hover:underline">
          Toutes les commandes →
        </Link>
      </div>

      <OrdersTable orders={recent} />
    </>
  );
}
