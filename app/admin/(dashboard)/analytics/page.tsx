import { eventCountsByType, recentEvents } from '@/lib/analytics';
import { isDbConfigured } from '@/lib/db';
import { orderReference } from '@/lib/types';

export default async function AdminAnalyticsPage() {
  if (!isDbConfigured()) {
    return <p className="gyj-card p-7 text-sm text-ink-soft">DATABASE_URL non configurée.</p>;
  }

  const [counts, events] = await Promise.all([eventCountsByType(), recentEvents(60)]);
  const max = Math.max(1, ...counts.map((c) => c.count));

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold">Analytique</h1>

      <section className="gyj-card mb-8 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Événements par type
        </h2>

        {counts.length === 0 ? (
          <p className="text-sm text-ink-soft">Aucun événement enregistré.</p>
        ) : (
          <ul className="grid gap-2.5">
            {counts.map((row) => (
              <li key={row.type} className="grid grid-cols-[13rem_1fr_3rem] items-center gap-3">
                <span className="truncate font-mono text-xs">{row.type}</span>
                <span className="h-2 rounded-full bg-neutral-100">
                  <span
                    className="block h-2 rounded-full bg-brand"
                    style={{ width: `${(row.count / max) * 100}%` }}
                  />
                </span>
                <span className="text-right text-sm font-semibold">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">60 derniers événements</h2>

        <div className="gyj-card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-hairline bg-neutral-50 text-left">
              <tr className="text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Commande</th>
                <th className="px-4 py-3 font-semibold">Métadonnées</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-soft">
                    {new Date(event.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{event.type}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {event.order_id ? orderReference(event.order_id) : '—'}
                  </td>
                  <td className="max-w-md truncate px-4 py-2.5 font-mono text-[0.7rem] text-ink-soft">
                    {event.metadata ? JSON.stringify(event.metadata) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
