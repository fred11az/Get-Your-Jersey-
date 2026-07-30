'use client';

import { useTranslations, useLocale } from 'next-intl';
import { TIERS, type KitOption, type Tier } from '@/lib/types';
import { formatPrice } from '@/lib/format';

export function Step2TierSelection({
  kit,
  currency,
  selected,
  onSelect,
}: {
  kit: KitOption;
  currency: 'EUR' | 'USD';
  selected?: Tier;
  onSelect: (tier: Tier) => void;
}) {
  const t = useTranslations('builder.step2');
  const locale = useLocale();

  // Les clés de traduction suivent les identifiants de la spec (supporter,
  // authentique, joueur) pour rester alignées avec la colonne `kit_tier`.
  const labels: Record<Tier, { name: string; desc: string }> = {
    supporter: { name: t('supporterName'), desc: t('supporterDesc') },
    authentique: { name: t('authentiqueName'), desc: t('authentiqueDesc') },
    joueur: { name: t('joueurName'), desc: t('joueurDesc') },
  };

  return (
    <section>
      <h2 className="mb-1.5">{t('title')}</h2>
      <p className="mb-7 text-ink-soft">{t('subtitle')}</p>

      <ul className="grid gap-4 sm:grid-cols-3">
        {TIERS.map((tier) => {
          const active = tier === selected;
          const price = currency === 'USD' ? kit.tiers[tier].price_usd : kit.tiers[tier].price_eur;

          return (
            <li key={tier}>
              <button
                type="button"
                onClick={() => onSelect(tier)}
                aria-pressed={active}
                className={`flex h-full w-full flex-col rounded-[14px] border bg-white p-5 text-left transition-all ${
                  active
                    ? 'border-brand ring-2 ring-brand/25'
                    : 'border-hairline hover:border-brand hover:shadow-md'
                }`}
              >
                <span className="text-base font-bold">{labels[tier].name}</span>
                <span className="mt-1.5 text-2xl font-extrabold text-brand">
                  {formatPrice(price, currency, locale)}
                </span>
                <span className="mt-3 text-sm leading-relaxed text-ink-soft">
                  {labels[tier].desc}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
