import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isLocale, locales } from '@/i18n/routing';
import { isKitSlug, loadKit } from '@/lib/kits';
import { formatPrice } from '@/lib/format';
import { breadcrumbJsonLd, faqJsonLd, productJsonLd, siteUrl } from '@/lib/seo';
import { KIT_SLUGS, TIERS } from '@/lib/types';
import { ButtonLink } from '@/components/shared/Button';

export function generateStaticParams() {
  return locales.flatMap((locale) => KIT_SLUGS.map((kit) => ({ locale, kit })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; kit: string }>;
}): Promise<Metadata> {
  const { locale, kit } = await params;
  if (!isLocale(locale) || !isKitSlug(kit)) return {};

  const [t, tKits] = await Promise.all([
    getTranslations({ locale, namespace: 'kitPage' }),
    getTranslations({ locale, namespace: 'kits' }),
  ]);
  const name = tKits(kit);

  return {
    title: t('metaTitle', { kit: name }),
    description: t('metaDescription', { kit: name }),
    alternates: {
      canonical: `/${locale}/maillot/${kit}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/maillot/${kit}`])),
    },
    openGraph: {
      title: t('metaTitle', { kit: name }),
      description: t('metaDescription', { kit: name }),
      images: [{ url: `/kits/${kit}/back.png` }],
    },
  };
}

export default async function KitPage({
  params,
}: {
  params: Promise<{ locale: string; kit: string }>;
}) {
  const { locale, kit: slug } = await params;
  if (!isLocale(locale) || !isKitSlug(slug)) notFound();
  setRequestLocale(locale);

  const [t, tKits, tTier, kit] = await Promise.all([
    getTranslations('kitPage'),
    getTranslations('kits'),
    getTranslations('builder.step2'),
    loadKit(slug),
  ]);

  const name = tKits(slug);
  const tierLabels: Record<string, string> = {
    supporter: tTier('supporterName'),
    authentique: tTier('authentiqueName'),
    joueur: tTier('joueurName'),
  };

  const faq = [
    { question: t('faq1Q', { kit: name }), answer: t('faq1A') },
    { question: t('faq2Q'), answer: t('faq2A') },
    { question: t('faq3Q'), answer: t('faq3A') },
  ];

  return (
    <>
      {/* Données structurées : fiche produit, fil d'Ariane et FAQ. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            productJsonLd({
              name: t('metaTitle', { kit: name }),
              description: t('metaDescription', { kit: name }),
              image: `/kits/${slug}/back.png`,
              priceEur: kit.tiers.supporter.price_eur,
              url: `/${locale}/maillot/${slug}`,
            }),
            breadcrumbJsonLd([
              { name: 'GetYourJersey', url: `/${locale}` },
              { name, url: `/${locale}/maillot/${slug}` },
            ]),
            faqJsonLd(faq),
          ]),
        }}
      />

      <article className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-xs text-ink-soft">
          <a href={`/${locale}`} className="hover:text-brand">
            GetYourJersey
          </a>
          <span aria-hidden> / </span>
          <span className="font-semibold text-ink">{name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          <div className="gyj-card gyj-mockup-bg overflow-hidden p-4">
            <div className="relative mx-auto aspect-[3/4] w-full max-w-sm">
              <Image
                src={`/kits/${slug}/back.png`}
                alt={t('imageAlt', { kit: name })}
                fill
                priority
                sizes="(min-width: 1024px) 24rem, 90vw"
                className="object-contain"
              />
            </div>
          </div>

          <div>
            <h1 className="mb-4">{t('h1', { kit: name })}</h1>
            <p className="mb-6 text-lg leading-relaxed text-ink-soft">
              {t('intro', { kit: name })}
            </p>

            <ul className="mb-7 space-y-2.5 text-sm">
              {['bullet1', 'bullet2', 'bullet3', 'bullet4'].map((key) => (
                <li key={key} className="flex gap-2.5">
                  <span aria-hidden className="text-brand">
                    ✓
                  </span>
                  {t(key)}
                </li>
              ))}
            </ul>

            <div className="mb-8 overflow-hidden rounded-[14px] border border-hairline">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('priceTableCaption', { kit: name })}</caption>
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">{t('tierColumn')}</th>
                    <th className="px-4 py-2.5 font-semibold">{t('priceColumn')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {TIERS.map((tier) => (
                    <tr key={tier}>
                      <td className="px-4 py-2.5 font-medium">{tierLabels[tier]}</td>
                      <td className="px-4 py-2.5">
                        {formatPrice(kit.tiers[tier].price_eur, 'EUR', locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ButtonLink href={`/${locale}/builder`} variant="accent" size="lg">
              {t('cta', { kit: name })}
            </ButtonLink>
          </div>
        </div>

        <section className="mt-16 max-w-3xl">
          <h2 className="mb-6">{t('faqTitle')}</h2>
          <dl className="space-y-5">
            {faq.map((entry) => (
              <div key={entry.question}>
                <dt className="mb-1.5 font-bold">{entry.question}</dt>
                <dd className="text-sm leading-relaxed text-ink-soft">{entry.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-16">
          <h2 className="mb-6">{t('otherKits')}</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {KIT_SLUGS.filter((s) => s !== slug)
              .slice(0, 5)
              .map((other) => (
                <li key={other} className="gyj-card overflow-hidden">
                  <a href={`/${locale}/maillot/${other}`} className="block">
                    <div className="gyj-mockup-bg relative aspect-[3/4]">
                      <Image
                        src={`/kits/${other}/front.png`}
                        alt={tKits(other)}
                        fill
                        sizes="(min-width: 1024px) 12rem, 40vw"
                        className="object-contain"
                      />
                    </div>
                    <p className="truncate border-t border-hairline px-3 py-2.5 text-sm font-semibold">
                      {tKits(other)}
                    </p>
                  </a>
                </li>
              ))}
          </ul>
        </section>
      </article>
    </>
  );
}
