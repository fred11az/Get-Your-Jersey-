import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/routing';
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

  // Les pages « occasion » (lib/seo.ts OCCASIONS) sont le prochain lot. Elles
  // ne sont PAS déclarées ici avant d'exister : un sitemap qui pointe vers des
  // 404 fait perdre du budget d'exploration et abîme la confiance du crawler.

  return entries;
}
