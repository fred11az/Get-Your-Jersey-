import Image from 'next/image';
import { getLocale, getTranslations } from 'next-intl/server';
import { OCCASIONS } from '@/lib/seo';

export async function Footer() {
  const [t, tPage, locale] = await Promise.all([
    getTranslations('footer'),
    getTranslations('idea.page'),
    getLocale(),
  ]);

  // Les pages « occasion » sont listées ici pour ne pas être orphelines : une
  // page qui n'existe que dans le sitemap est explorée puis oubliée.
  const ideas = await Promise.all(
    OCCASIONS.map(async (occasion) => ({
      slug: occasion.slug,
      name: (await getTranslations(`idea.occasions.${occasion.key}`))('name'),
    })),
  );

  return (
    <footer className="mt-16 border-t border-hairline bg-white">
      {/* Bandeau visuel : rappelle le produit porté juste avant les mentions. */}
      <div className="grid grid-cols-3 gap-px bg-hairline">
        {['studio-duo', 'street-group', 'studio-lineup'].map((slug) => (
          <div key={slug} className="relative h-24 overflow-hidden sm:h-36">
            <Image
              src={`/lifestyle/${slug}-800.jpg`}
              alt=""
              width={800}
              height={450}
              sizes="33vw"
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
      <nav
        aria-label={tPage('breadcrumb')}
        className="mx-auto max-w-6xl px-4 pt-8 text-sm sm:px-6"
      >
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {tPage('breadcrumb')}
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {ideas.map((idea) => (
            <li key={idea.slug}>
              <a href={`/${locale}/idee/${idea.slug}`} className="text-ink-soft hover:text-brand">
                {idea.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-4 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} GetYourJersey. {t('rights')}</p>
        <p>{t('madeWith')}</p>
      </div>
    </footer>
  );
}
