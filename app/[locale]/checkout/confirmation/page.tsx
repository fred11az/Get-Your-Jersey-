import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/i18n/routing';
import { getOrder } from '@/lib/orders';
import { isDbConfigured } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { loadKit } from '@/lib/kits';
import { formatPrice } from '@/lib/format';
import { buildWhatsappLink, whatsappContextFromOrder } from '@/lib/whatsapp';
import { orderReference } from '@/lib/types';
import { ButtonLink } from '@/components/shared/Button';

export const dynamic = 'force-dynamic';

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string; method?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('confirmation');

  if (!query.order || !isDbConfigured()) notFound();

  const order = await getOrder(query.order);
  if (!order) notFound();

  const reference = orderReference(order.id);
  const amount = formatPrice(Number(order.amount), order.currency, locale);
  const viaWhatsapp = query.method === 'whatsapp';

  let whatsappUrl: string | undefined;
  if (viaWhatsapp) {
    const [settings, kit] = await Promise.all([getSettings(), loadKit(order.kit_slug)]);
    whatsappUrl = buildWhatsappLink(
      settings.whatsapp_number,
      settings.whatsapp_template,
      whatsappContextFromOrder(order, kit.name, process.env.NEXT_PUBLIC_SITE_URL ?? ''),
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="gyj-card p-8 text-center">
        <span
          aria-hidden
          className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-2xl"
        >
          ✓
        </span>

        <h1 className="mb-3 text-3xl">{t('title')}</h1>
        <p className="mb-8 text-ink-soft">{t('subtitle', { reference })}</p>

        {order.render_preview_url && (
          <div className="gyj-mockup-bg mx-auto mb-8 aspect-[3/4] w-full max-w-56 overflow-hidden rounded-[10px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- rendu dynamique */}
            <img
              src={order.render_preview_url}
              alt=""
              className="h-full w-full object-contain"
            />
          </div>
        )}

        <div className="rounded-[14px] bg-brand-soft p-5 text-left">
          <h2 className="mb-2 text-base font-bold">{t('nextStepsTitle')}</h2>
          <p className="text-sm leading-relaxed text-ink">
            {viaWhatsapp ? t('whatsappNext') : t('ibanNext', { amount, reference })}
          </p>
        </div>

        <p className="mt-5 text-xs text-ink-soft">{t('emailNote', { email: order.email })}</p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-accent px-6 py-3.5 text-base font-semibold text-white transition-all hover:bg-accent-dark hover:shadow-lg"
            >
              {t('openWhatsapp')}
            </a>
          )}
          <ButtonLink href={`/${locale}`} variant="ghost" size="lg">
            {t('backHome')}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
