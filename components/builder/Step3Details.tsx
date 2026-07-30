'use client';

import { useTranslations } from 'next-intl';
import { SIZES, type Size } from '@/lib/types';

export interface DetailsValue {
  size?: Size;
  jerseyName: string;
  jerseyNumber: string;
}

export const MAX_NAME_LENGTH = 15;

export function validateDetails(value: DetailsValue): {
  size?: string;
  name?: string;
  number?: string;
} {
  const errors: { size?: string; name?: string; number?: string } = {};
  if (!value.size) errors.size = 'required';
  if (value.jerseyName.trim().length === 0) errors.name = 'required';
  else if (value.jerseyName.trim().length > MAX_NAME_LENGTH) errors.name = 'tooLong';
  // 0 à 99 : au-delà, le glyphe ne tient pas dans la zone d'impression.
  if (!/^\d{1,2}$/.test(value.jerseyNumber.trim())) errors.number = 'invalid';
  return errors;
}

export function Step3Details({
  value,
  errors,
  onChange,
}: {
  value: DetailsValue;
  errors: { size?: string; name?: string; number?: string };
  onChange: (patch: Partial<DetailsValue>) => void;
}) {
  const t = useTranslations('builder.step3');
  const tCommon = useTranslations('common');
  const tSizes = useTranslations('sizes');

  const nameError =
    errors.name === 'required' ? tCommon('required') : errors.name ? t('nameTooLong') : undefined;

  return (
    <section>
      <h2 className="mb-1.5">{t('title')}</h2>
      <p className="mb-7 text-ink-soft">{t('subtitle')}</p>

      <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="gyj-label" htmlFor="gyj-size">
            {t('size')}
          </label>
          <select
            id="gyj-size"
            className="gyj-field"
            value={value.size ?? ''}
            aria-invalid={Boolean(errors.size)}
            onChange={(e) => onChange({ size: (e.target.value || undefined) as Size | undefined })}
          >
            <option value="">{t('sizePlaceholder')}</option>
            {SIZES.map((size) => (
              <option key={size} value={size}>
                {tSizes(size)}
              </option>
            ))}
          </select>
          {errors.size && <p className="mt-1.5 text-xs text-red-600">{tCommon('required')}</p>}
        </div>

        <div>
          <label className="gyj-label" htmlFor="gyj-name">
            {t('name')}
          </label>
          <input
            id="gyj-name"
            className="gyj-field uppercase"
            value={value.jerseyName}
            maxLength={MAX_NAME_LENGTH}
            placeholder={t('namePlaceholder')}
            aria-invalid={Boolean(errors.name)}
            aria-describedby="gyj-name-help"
            // Le flocage est en capitales : l'aperçu doit refléter l'impression.
            onChange={(e) => onChange({ jerseyName: e.target.value.toUpperCase() })}
          />
          <p id="gyj-name-help" className="mt-1.5 text-xs text-ink-soft">
            {nameError ? (
              <span className="text-red-600">{nameError}</span>
            ) : (
              `${t('nameHelp')} — ${value.jerseyName.length}/${MAX_NAME_LENGTH}`
            )}
          </p>
        </div>

        <div>
          <label className="gyj-label" htmlFor="gyj-number">
            {t('number')}
          </label>
          <input
            id="gyj-number"
            className="gyj-field"
            inputMode="numeric"
            value={value.jerseyNumber}
            placeholder={t('numberPlaceholder')}
            aria-invalid={Boolean(errors.number)}
            aria-describedby="gyj-number-help"
            onChange={(e) => onChange({ jerseyNumber: e.target.value.replace(/\D/g, '').slice(0, 2) })}
          />
          <p id="gyj-number-help" className="mt-1.5 text-xs text-ink-soft">
            {errors.number ? (
              <span className="text-red-600">{t('numberInvalid')}</span>
            ) : (
              t('numberHelp')
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
