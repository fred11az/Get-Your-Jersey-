import type { DashboardStats as Stats } from '@/lib/orders';

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DashboardStats({ stats }: { stats: Stats }) {
  const cards = [
    { label: 'Commandes totales', value: String(stats.total) },
    { label: 'En attente', value: String(stats.pending), tone: 'text-accent' },
    { label: 'Confirmées', value: String(stats.paid), tone: 'text-brand' },
    { label: 'Revenu encaissé', value: formatEur(stats.revenue) },
  ];

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <li key={card.label} className="gyj-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            {card.label}
          </p>
          <p className={`mt-2 text-3xl font-extrabold ${card.tone ?? ''}`}>{card.value}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Histogramme des commandes par jour. Rendu en HTML/CSS plutôt qu'avec une
 * bibliothèque de graphiques : trente barres ne justifient pas une dépendance,
 * et cela reste un composant serveur, donc zéro JavaScript envoyé au client.
 */
export function OrdersChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="gyj-card p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Commandes par jour — 30 derniers jours
      </p>

      <div className="flex h-40 items-end gap-1" role="img" aria-label="Commandes par jour">
        {data.map((point) => (
          <div key={point.day} className="group relative flex-1">
            <div
              className="w-full rounded-t-[3px] bg-brand transition-colors group-hover:bg-accent"
              style={{ height: `${Math.max(2, (point.count / max) * 100)}%` }}
            />
            <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[0.65rem] text-white opacity-0 transition-opacity group-hover:opacity-100">
              {point.day} · {point.count}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[0.65rem] text-ink-soft">
        <span>{data[0]?.day}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </div>
  );
}
