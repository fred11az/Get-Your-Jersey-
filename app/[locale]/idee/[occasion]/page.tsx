import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isLocale, locales } from '@/i18n/routing';
import { loadKit } from '@/lib/kits';
import { formatPrice } from '@/lib/format';
import { breadcrumbJsonLd, faqJsonLd, findOccasion, OCCASIONS } from '@/lib/seo';
import { ButtonLink } from '@/components/shared/Button';

/**
 * Page d'atterrissage par occasion d'achat.
 *
 * Le parti pris rédactionnel est celui de `lib/seo.ts` : un ensemble BORNÉ de
 * pages, chacune avec du contenu qui lui est propre. Décliner un même texte en
 * changeant le mot-clé fabriquerait des « doorway pages », que Google sanctionne
 * au niveau du domaine entier. Chaque occasion a donc ses conseils, ses
 * questions fréquentes et ses maillots mis en avant.
 */

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    OCCASIONS.map((occasion) => ({ locale, occasion: occasion.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; occasion: string }>;
}): Promise<Metadata> {
  const { locale, occasion: slug } = await params;
  const occasion = findOccasion(slug);
  if (!isLocale(locale) || !occasion) return {};

  const t = await getTranslations({ locale, namespace: `idea.occasions.${occasion.key}` });
  const firstKit = occasion.featured[0];

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: {
      canonical: `/${locale}/idee/${slug}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/idee/${slug}`])),
    },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      images: firstKit ? [{ url: `/kits/${firstKit}/back.png` }] : undefined,
    },
  };
}

export default async function OccasionPage({
  params,
}: {
  params: Promise<{ locale: string; occasion: string }>;
}) {
  const { locale, occasion: slug } = await params;
  const occasion = findOccasion(slug);
  if (!isLocale(locale) || !occasion) notFound();
  setRequestLocale(locale);

  const [t, tPage, tKits] = await Promise.all([
    getTranslations(`idea.occasions.${occasion.key}`),
    getTranslations('idea.page'),
    getTranslations('kits'),
  ]);

  const kits = await Promise.all(occasion.featured.map((kit) => loadKit(kit)));

  const faq = [
    { question: t('faq1Q'), answer: t('faq1A') },
    { question: t('faq2Q'), answer: t('faq2A') },
  ];

  const tips = [1, 2, 3].map((index) => ({
    title: t(`tip${index}Title`),
    body: t(`tip${index}Body`),
  }));

  return (
    <>
      {/* Fil d'Ariane et FAQ en données structurées. Pas de `Product` : cette
          page n'est pas une fiche produit, la déclarer comme telle serait une
          fausse déclaration de balisage. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd([
              { name: 'GetYourJersey', url: `/${locale}` },
              { name: t('name'), url: `/${locale}/idee/${slug}` },
            ]),
            faqJsonLd(faq),
          ]),
        }}
      />

      <article className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <nav aria-label={tPage('breadcrumb')} className="mb-6 text-xs text-ink-soft">
          <a href={`/${locale}`} className="hover:text-brand">
            GetYourJersey
          </a>
          <span aria-hidden> / </span>
          <span className="font-semibold text-ink">{t('name')}</span>
        </nav>

        <header className="max-w-3xl">
          <h1 className="mb-4">{t('h1')}</h1>
          <p className="text-lg leading-relaxed text-ink-soft">{t('intro')}</p>
          <div className="mt-7">
            <ButtonLink href={`/${locale}/builder`} variant="accent" size="lg">
              {tPage('cta')}
            </ButtonLink>
          </div>
        </header>

        <section className="mt-16">
          <h2 className="mb-6">{tPage('tipsTitle')}</h2>
          <ol className="grid gap-5 sm:grid-cols-3">
            {tips.map((tip, index) => (
              <li key={tip.title} className="gyj-card p-5">
                <span
                  aria-hidden
                  className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
                >
                  {index + 1}
                </span>
                <h3 className="mb-1.5 text-base font-bold">{tip.title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{tip.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16">
          <h2 className="mb-6">{tPage('featuredTitle')}</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {kits.map((kit) => (
              <li key={kit.slug} className="gyj-card overflow-hidden">
                <a href={`/${locale}/maillot/${kit.slug}`} className="block">
                  <div className="gyj-mockup-bg relative aspect-[3/4]">
                    {/* La face, comme dans les autres grilles du site : sept kits
                        n'ont pas encore de vraie photo de dos (docs/DIVERGENCES.md
                        §4) et leur mockup généré est fade en vignette. */}
                    <Image
                      src={`/kits/${kit.slug}/front.png`}
                      alt={tKits(kit.slug)}
                      fill
                      sizes="(min-width: 640px) 18rem, 45vw"
                      className="object-contain"
                    />
                  </div>
                  <div className="border-t border-hairline px-3 py-2.5">
                    <p className="truncate text-sm font-semibold">{tKits(kit.slug)}</p>
                    <p className="text-xs text-ink-soft">
                      {tPage('priceFrom', {
                        price: formatPrice(kit.tiers.supporter.price_eur, 'EUR', locale),
                      })}
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16 max-w-3xl">
          <h2 className="mb-6">{tPage('faqTitle')}</h2>
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
          <h2 className="mb-6">{tPage('otherIdeas')}</h2>
          <ul className="flex flex-wrap gap-3">
            {OCCASIONS.filter((other) => other.slug !== slug).map((other) => (
              <li key={other.slug}>
                <a
                  href={`/${locale}/idee/${other.slug}`}
                  className="inline-block rounded-full border border-hairline px-4 py-2 text-sm font-semibold transition-colors hover:border-brand hover:text-brand"
                >
                  <OccasionName locale={locale} occasionKey={other.key} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </>
  );
}

/** Libellé d'une autre occasion, dans sa propre section de traduction. */
async function OccasionName({ locale, occasionKey }: { locale: string; occasionKey: string }) {
  const t = await getTranslations({ locale, namespace: `idea.occasions.${occasionKey}` });
  return <>{t('name')}</>;
}
