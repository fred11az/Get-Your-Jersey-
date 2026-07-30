import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ButtonLink } from './Button';

export async function Header({ locale }: { locale: Locale }) {
  const t = await getTranslations('nav');

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5 sm:px-6">
        <Link href={`/${locale}`} aria-label="GetYourJersey" className="shrink-0">
          {/* Le logo porte déjà le nom de la marque et l'accroche : le répéter en
              texte à côté ferait doublon pour un lecteur d'écran comme à l'œil. */}
          <Image
            src="/brand/logo.png"
            alt="GetYourJersey"
            width={858}
            height={834}
            priority
            className="h-12 w-auto sm:h-14"
          />
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher locale={locale} />
          <ButtonLink href={`/${locale}/builder`} variant="accent">
            {t('builder')}
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
