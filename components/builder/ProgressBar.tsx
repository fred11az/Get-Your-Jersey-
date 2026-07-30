'use client';

import { useTranslations } from 'next-intl';

export const TOTAL_STEPS = 6;

export function ProgressBar({
  current,
  onJump,
}: {
  current: number;
  /** Retour en arrière uniquement : on ne saute pas une étape non remplie. */
  onJump?: (step: number) => void;
}) {
  const t = useTranslations('builder');

  return (
    <div className="mb-8">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {t('stepLabel', { current, total: TOTAL_STEPS })}
      </p>
      <ol className="flex gap-1.5" aria-label={t('stepLabel', { current, total: TOTAL_STEPS })}>
        {Array.from({ length: TOTAL_STEPS }, (_, index) => {
          const step = index + 1;
          const done = step < current;
          const active = step === current;
          const reachable = done && onJump;

          return (
            <li key={step} className="flex-1">
              <button
                type="button"
                disabled={!reachable}
                onClick={reachable ? () => onJump(step) : undefined}
                aria-current={active ? 'step' : undefined}
                className={`h-1.5 w-full rounded-full transition-colors ${
                  done || active ? 'bg-brand' : 'bg-hairline'
                } ${reachable ? 'cursor-pointer hover:bg-brand-dark' : 'cursor-default'}`}
              >
                <span className="sr-only">{step}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
