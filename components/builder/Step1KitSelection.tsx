'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { KitOption, KitSlug } from '@/lib/types';

export function Step1KitSelection({
  kits,
  selected,
  onSelect,
}: {
  kits: KitOption[];
  selected?: KitSlug;
  onSelect: (slug: KitSlug) => void;
}) {
  const t = useTranslations('builder.step1');
  const tKits = useTranslations('kits');

  return (
    <section>
      <h2 className="mb-1.5">{t('title')}</h2>
      <p className="mb-7 text-ink-soft">{t('subtitle')}</p>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kits.map((kit) => {
          const active = kit.slug === selected;
          return (
            <li key={kit.slug}>
              <button
                type="button"
                onClick={() => onSelect(kit.slug)}
                aria-pressed={active}
                className={`group w-full overflow-hidden rounded-[14px] border bg-white text-left transition-all ${
                  active
                    ? 'border-brand ring-2 ring-brand/25'
                    : 'border-hairline hover:border-brand hover:shadow-md'
                }`}
              >
                <div className="gyj-mockup-bg relative aspect-[3/4]">
                  <Image
                    src={`/kits/${kit.slug}/front.png`}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 12rem, 40vw"
                    className="object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex items-center gap-2 border-t border-hairline px-3 py-2.5">
                  <span
                    aria-hidden
                    className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                    style={{ background: kit.color_hex }}
                  />
                  <span className="truncate text-sm font-semibold">{tKits(kit.slug)}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
