import { getTranslations } from 'next-intl/server';

export async function Footer() {
  const t = await getTranslations('footer');

  return (
    <footer className="mt-16 border-t border-hairline bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-4 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} GetYourJersey. {t('rights')}</p>
        <p>{t('madeWith')}</p>
      </div>
    </footer>
  );
}
