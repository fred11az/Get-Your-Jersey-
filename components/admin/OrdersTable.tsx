'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ORDER_STATUSES, orderReference, type Order, type OrderStatus } from '@/lib/types';

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SENT_TO_PRINTER: 'bg-blue-50 text-blue-700 border-blue-200',
  SHIPPED: 'bg-neutral-100 text-neutral-700 border-neutral-200',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'En attente',
  PAID: 'Payée',
  SENT_TO_PRINTER: 'Chez l’imprimeur',
  SHIPPED: 'Expédiée',
};

export function OrdersTable({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  async function call(id: string, init: RequestInit) {
    setBusyId(id);
    setError(undefined);
    const response = await fetch(`/api/orders/${id}/status`, init).catch(() => null);
    setBusyId(undefined);

    if (!response?.ok) {
      setError('Opération refusée. Recharger la page et réessayer.');
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  function changeStatus(id: string, status: OrderStatus) {
    void call(id, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  async function remove(id: string) {
    // Suppression définitive : on demande confirmation explicite.
    if (!window.confirm(`Supprimer définitivement la commande ${orderReference(id)} ?`)) return;
    await call(id, { method: 'DELETE' });
  }

  async function generatePdf(id: string) {
    setBusyId(id);
    setError(undefined);
    const response = await fetch('/api/render/pdf', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: id }),
    }).catch(() => null);
    setBusyId(undefined);

    if (!response?.ok) {
      setError('Génération du PDF impossible.');
      return;
    }
    const body = (await response.json()) as { pdfUrl: string };
    window.open(body.pdfUrl, '_blank', 'noopener');
    startTransition(() => router.refresh());
  }

  if (orders.length === 0) {
    return <p className="gyj-card p-8 text-center text-sm text-ink-soft">Aucune commande.</p>;
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-[8px] bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="gyj-card overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="border-b border-hairline bg-neutral-50 text-left">
            <tr className="text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-4 py-3 font-semibold">Réf.</th>
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 font-semibold">Maillot</th>
              <th className="px-4 py-3 font-semibold">Flocage</th>
              <th className="px-4 py-3 font-semibold">Aperçu</th>
              <th className="px-4 py-3 font-semibold">Montant</th>
              <th className="px-4 py-3 font-semibold">Statut</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {orders.map((order) => {
              const busy = busyId === order.id || pending;
              return (
                <tr key={order.id} className={busy ? 'opacity-50' : undefined}>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    {orderReference(order.id)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-medium">
                      {order.first_name} {order.last_name}
                    </span>
                    <span className="block text-xs text-ink-soft">{order.email}</span>
                    <span className="block text-xs text-ink-soft">
                      {order.city}, {order.country}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block">{order.kit_slug}</span>
                    <span className="block text-xs text-ink-soft">
                      {order.kit_tier} · {order.size}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-semibold">{order.jersey_name}</span>
                    <span className="block text-xs text-ink-soft">#{order.jersey_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    {order.render_preview_url ? (
                      <a href={order.render_preview_url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- miniature dynamique */}
                        <img
                          src={order.render_preview_url}
                          alt=""
                          className="h-16 w-12 rounded border border-hairline object-contain"
                        />
                      </a>
                    ) : (
                      <span className="text-xs text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">
                    {order.amount} {order.currency}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={order.status}
                      disabled={busy}
                      onChange={(e) => changeStatus(order.id, e.target.value as OrderStatus)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        STATUS_STYLES[order.status]
                      }`}
                    >
                      {ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 text-xs">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => generatePdf(order.id)}
                        className="text-left font-semibold text-brand hover:underline disabled:opacity-50"
                      >
                        PDF imprimeur
                      </button>
                      <a
                        href={`/api/orders/${order.id}/export`}
                        className="font-semibold text-brand hover:underline"
                      >
                        Design JSON
                      </a>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(order.id)}
                        className="text-left font-semibold text-red-600 hover:underline disabled:opacity-50"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
