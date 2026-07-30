import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/routing';
import { loadAllKits } from '@/lib/kits';
import { formatPrice } from '@/lib/format';
import { ButtonLink } from '@/components/shared/Button';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const [t, tKits] = await Promise.all([getTranslations('home'), getTranslations('kits')]);
  const kits = await loadAllKits();

  // Prix d'appel : la finition la moins chère toutes équipes confondues.
  const from = Math.min(...kits.map((k) => k.tiers.supporter.price_eur));

  const features = [
    { title: t('feature1Title'), body: t('feature1Body') },
    { title: t('feature2Title'), body: t('feature2Body') },
    { title: t('feature3Title'), body: t('feature3Body') },
  ];

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand">
            <span aria-hidden>✈</span>
            {t('shipping')}
          </p>
          <h1 className="mb-5 text-balance">{t('title')}</h1>
          <p className="mb-8 max-w-xl text-lg leading-relaxed text-ink-soft">{t('subtitle')}</p>

          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href={`/${locale}/builder`} variant="accent" size="lg">
              {t('cta')}
            </ButtonLink>
            <span className="text-sm text-ink-soft">
              {t('priceFrom', { price: formatPrice(from, 'EUR', locale) })}
            </span>
          </div>
        </div>

        {/* Aperçu produit : le maillot de référence du client. */}
        <div className="gyj-card gyj-mockup-bg overflow-hidden p-4">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-sm">
            <Image
              src="/kits/france/back.png"
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 24rem, 80vw"
              className="object-contain"
            />
          </div>
        </div>
      </section>

      <section className="border-y border-hairline bg-brand-soft/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="mb-9">{t('howItWorks')}</h2>
          <ol className="grid gap-5 sm:grid-cols-3">
            {features.map((feature, index) => (
              <li key={feature.title} className="gyj-card p-6">
                <span
                  aria-hidden
                  className="mb-4 grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-bold text-white"
                >
                  {index + 1}
                </span>
                <h3 className="mb-2">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{feature.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="mb-9">{t('feature1Title')}</h2>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {kits.map((kit) => (
            <li key={kit.slug} className="gyj-card overflow-hidden">
              <div className="gyj-mockup-bg relative aspect-[3/4]">
                <Image
                  src={`/kits/${kit.slug}/front.png`}
                  alt={tKits(kit.slug)}
                  fill
                  sizes="(min-width: 1024px) 12rem, 40vw"
                  className="object-contain"
                />
              </div>
              <div className="border-t border-hairline px-3 py-2.5">
                <p className="truncate text-sm font-semibold">{tKits(kit.slug)}</p>
                <p className="text-xs text-ink-soft">
                  {t('priceFrom', { price: formatPrice(kit.tiers.supporter.price_eur, 'EUR', locale) })}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 text-center">
          <ButtonLink href={`/${locale}/builder`} variant="primary" size="lg">
            {t('cta')}
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
