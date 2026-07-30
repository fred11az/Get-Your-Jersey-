'use client';

import { useTranslations, useLocale } from 'next-intl';
import { COUNTRIES } from '@/lib/countries';
import { formatPrice } from '@/lib/format';
import { PAYMENT_METHODS, type PaymentMethod, type Size, type Tier } from '@/lib/types';
import { Button } from '@/components/shared/Button';

export interface ShippingValue {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  postal_code: string;
  city: string;
}

export const EMPTY_SHIPPING: ShippingValue = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  country: '',
  address: '',
  postal_code: '',
  city: '',
};

export type ShippingErrors = Partial<Record<keyof ShippingValue, 'required' | 'email'>>;

export function validateShipping(value: ShippingValue): ShippingErrors {
  const errors: ShippingErrors = {};
  for (const key of Object.keys(EMPTY_SHIPPING) as (keyof ShippingValue)[]) {
    if (value[key].trim().length === 0) errors[key] = 'required';
  }
  // Validation volontairement permissive : on vérifie la forme, pas l'existence.
  if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.email.trim())) {
    errors.email = 'email';
  }
  return errors;
}

interface Summary {
  kitName: string;
  tier: Tier;
  size?: Size;
  jerseyName: string;
  jerseyNumber: string;
  amount: number;
  currency: 'EUR' | 'USD';
  previewUrl?: string;
}

export function Step6Checkout({
  value,
  errors,
  summary,
  payment,
  iban,
  ibanBic,
  ibanHolder,
  submitting,
  submitError,
  onChange,
  onPaymentChange,
  onSubmit,
}: {
  value: ShippingValue;
  errors: ShippingErrors;
  summary: Summary;
  payment: PaymentMethod;
  iban: string;
  ibanBic: string | null;
  ibanHolder: string | null;
  submitting: boolean;
  submitError?: string;
  onChange: (patch: Partial<ShippingValue>) => void;
  onPaymentChange: (method: PaymentMethod) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations('builder.step6');
  const tCommon = useTranslations('common');
  const tTier = useTranslations('builder.step2');
  const locale = useLocale();

  const tierLabel: Record<Tier, string> = {
    supporter: tTier('supporterName'),
    authentique: tTier('authentiqueName'),
    joueur: tTier('joueurName'),
  };

  const amount = formatPrice(summary.amount, summary.currency, locale);

  const field = (
    key: keyof ShippingValue,
    label: string,
    extra: { type?: string; autoComplete?: string; span?: boolean } = {},
  ) => (
    <div className={extra.span ? 'sm:col-span-2' : undefined}>
      <label className="gyj-label" htmlFor={`gyj-${key}`}>
        {label}
      </label>
      <input
        id={`gyj-${key}`}
        className="gyj-field"
        type={extra.type ?? 'text'}
        autoComplete={extra.autoComplete}
        value={value[key]}
        aria-invalid={Boolean(errors[key])}
        onChange={(e) => onChange({ [key]: e.target.value } as Partial<ShippingValue>)}
      />
      {errors[key] && (
        <p className="mt-1.5 text-xs text-red-600">
          {errors[key] === 'email' ? t('emailInvalid') : tCommon('required')}
        </p>
      )}
    </div>
  );

  return (
    <section>
      <h2 className="mb-7">{t('title')}</h2>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div>
          <h3 className="mb-4">{t('shippingSection')}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('first_name', t('firstName'), { autoComplete: 'given-name' })}
            {field('last_name', t('lastName'), { autoComplete: 'family-name' })}
            {field('email', t('email'), { type: 'email', autoComplete: 'email' })}
            {field('phone', t('phone'), { type: 'tel', autoComplete: 'tel' })}

            <div className="sm:col-span-2">
              <label className="gyj-label" htmlFor="gyj-country">
                {t('country')}
              </label>
              <select
                id="gyj-country"
                className="gyj-field"
                value={value.country}
                autoComplete="country"
                aria-invalid={Boolean(errors.country)}
                onChange={(e) => onChange({ country: e.target.value })}
              >
                <option value="">{t('countryPlaceholder')}</option>
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
              {errors.country && (
                <p className="mt-1.5 text-xs text-red-600">{tCommon('required')}</p>
              )}
            </div>

            {field('address', t('address'), { autoComplete: 'street-address', span: true })}
            {field('postal_code', t('postalCode'), { autoComplete: 'postal-code' })}
            {field('city', t('city'), { autoComplete: 'address-level2' })}
          </div>

          <h3 className="mb-2 mt-9">{t('paymentSection')}</h3>
          <p className="mb-4 text-sm text-ink-soft">{t('paymentIntro')}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => onPaymentChange(method)}
                aria-pressed={payment === method}
                className={`rounded-[14px] border p-4 text-left transition-all ${
                  payment === method
                    ? 'border-brand ring-2 ring-brand/25'
                    : 'border-hairline hover:border-brand'
                }`}
              >
                <span className="block text-sm font-bold">
                  {method === 'iban' ? t('ibanOption') : t('whatsappOption')}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-ink-soft">
                  {method === 'iban'
                    ? t('ibanInstruction', { amount })
                    : t('whatsappInstruction')}
                </span>
              </button>
            ))}
          </div>

          {payment === 'iban' && (
            <dl className="mt-4 rounded-[14px] bg-brand-soft p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2 py-1">
                <dt className="text-ink-soft">IBAN</dt>
                <dd className="font-mono font-semibold">{iban}</dd>
              </div>
              {ibanBic && (
                <div className="flex flex-wrap justify-between gap-2 py-1">
                  <dt className="text-ink-soft">{t('ibanBic')}</dt>
                  <dd className="font-mono font-semibold">{ibanBic}</dd>
                </div>
              )}
              {ibanHolder && (
                <div className="flex flex-wrap justify-between gap-2 py-1">
                  <dt className="text-ink-soft">{t('ibanHolder')}</dt>
                  <dd className="font-semibold">{ibanHolder}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <aside className="gyj-card h-fit p-5 lg:sticky lg:top-24">
          <h3 className="mb-4">{t('summarySection')}</h3>

          {summary.previewUrl && (
            <div className="gyj-mockup-bg mb-4 aspect-[3/4] overflow-hidden rounded-[10px]">
              {/* eslint-disable-next-line @next/next/no-img-element -- rendu dynamique */}
              <img src={summary.previewUrl} alt="" className="h-full w-full object-contain" />
            </div>
          )}

          <dl className="space-y-2 text-sm">
            {[
              [t('summaryKit'), summary.kitName],
              [t('summaryTier'), tierLabel[summary.tier]],
              [t('summarySize'), summary.size ?? '—'],
              [t('summaryName'), summary.jerseyName],
              [t('summaryNumber'), summary.jerseyNumber],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-ink-soft">{label}</dt>
                <dd className="text-right font-semibold">{val}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-hairline pt-3">
              <dt className="font-semibold">{t('summaryAmount')}</dt>
              <dd className="text-lg font-extrabold text-brand">{amount}</dd>
            </div>
          </dl>

          {submitError && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {submitError}
            </p>
          )}

          <Button
            variant="accent"
            size="lg"
            full
            className="mt-5"
            onClick={onSubmit}
            disabled={submitting}
          >
            {submitting
              ? t('submitting')
              : payment === 'whatsapp'
                ? t('whatsappButton')
                : t('submit')}
          </Button>
        </aside>
      </div>
    </section>
  );
}
