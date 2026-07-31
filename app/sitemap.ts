import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/routing';
import { OCCASIONS } from '@/lib/seo';
import { KIT_SLUGS } from '@/lib/types';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://getyourjersey.com';

/**
 * Sitemap complet, toutes langues.
 *
 * Chaque entrée porte ses `alternates.languages` : c'est ce qui indique à Google
 * que /fr/... et /en/... sont deux versions d'une même page et non du contenu
 * dupliqué. Sans cela, cinq langues divisent l'autorité au lieu de l'additionner.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  const alternates = (pathFor: (locale: string) => string) => ({
    languages: Object.fromEntries(locales.map((l) => [l, `${SITE}${pathFor(l)}`])),
  });

  const add = (
    pathFor: (locale: string) => string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  ) => {
    for (const locale of locales) {
      entries.push({
        url: `${SITE}${pathFor(locale)}`,
        lastModified: new Date(),
        changeFrequency,
        priority,
        alternates: alternates(pathFor),
      });
    }
  };

  add((l) => `/${l}`, 1, 'weekly');
  add((l) => `/${l}/builder`, 0.9, 'monthly');

  for (const kit of KIT_SLUGS) {
    add((l) => `/${l}/maillot/${kit}`, 0.8, 'weekly');
  }

  // Pages « occasion » : app/[locale]/idee/[occasion]/page.tsx. Elles n'étaient
  // pas déclarées tant qu'elles n'existaient pas — un sitemap qui pointe vers
  // des 404 gaspille du budget d'exploration et abîme la confiance du crawler.
  for (const occasion of OCCASIONS) {
    add((l) => `/${l}/idee/${occasion.slug}`, 0.7, 'monthly');
  }

  return entries;
}
