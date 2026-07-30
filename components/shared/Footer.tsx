import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

export async function Footer() {
  const t = await getTranslations('footer');

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
      <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-4 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} GetYourJersey. {t('rights')}</p>
        <p>{t('madeWith')}</p>
      </div>
    </footer>
  );
}
