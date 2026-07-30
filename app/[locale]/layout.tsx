import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { locales, isLocale } from '@/i18n/routing';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import '../globals.css';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = await getTranslations({ locale, namespace: 'home' });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://getyourjersey.com';

  return {
    title: `GetYourJersey — ${t('title')}`,
    description: t('subtitle'),
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      title: `GetYourJersey — ${t('title')}`,
      description: t('subtitle'),
      locale,
      type: 'website',
      images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: 'GetYourJersey' }],
    },
    twitter: { card: 'summary_large_image', images: ['/brand/og.png'] },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // Permet le rendu statique des pages de ce segment.
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider>
          <Header locale={locale} />
          <main className="flex-1">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
