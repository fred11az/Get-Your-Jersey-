import type { KitSlug } from './types';

/**
 * Contenu des pages d'atterrissage SEO.
 *
 * Principe directeur : **une page = une intention de recherche réelle, avec du
 * contenu propre**. Générer des centaines de pages quasi identiques en changeant
 * un mot-clé est un « doorway page », explicitement sanctionné par Google — le
 * risque n'est pas de ne pas ranker, c'est de faire déclasser tout le domaine.
 *
 * On monte donc un ensemble borné et vraiment différencié :
 *   - une page par maillot (10) : contenu propre à l'équipe, son maillot, ses
 *     couleurs de flocage, ses prix ;
 *   - une page par occasion d'achat (anniversaire, cadeau supporter, EVJF…) :
 *     l'intention de recherche est distincte et le contenu diffère réellement.
 *
 * Multiplié par 5 langues, cela fait déjà une centaine d'URL indexables, chacune
 * défendable. C'est ce qui capte du trafic durablement, pas le volume brut.
 */

export interface Occasion {
  slug: string;
  /** Clé de traduction dans `seo.occasions.<key>`. */
  key: string;
  /** Kits mis en avant sur cette page. */
  featured: KitSlug[];
}

export const OCCASIONS: Occasion[] = [
  { slug: 'cadeau-supporter', key: 'gift', featured: ['portugal', 'france', 'barcelona'] },
  { slug: 'anniversaire', key: 'birthday', featured: ['spain', 'brazil', 'real-madrid'] },
  { slug: 'cadeau-couple', key: 'couple', featured: ['argentina', 'france-away', 'portugal'] },
  { slug: 'equipe-club', key: 'team', featured: ['barcelona', 'real-madrid', 'spain'] },
  { slug: 'photo-famille', key: 'family', featured: ['france', 'brazil', 'portugal-away'] },
];

export function findOccasion(slug: string): Occasion | undefined {
  return OCCASIONS.find((occasion) => occasion.slug === slug);
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://getyourjersey.com';

export function siteUrl(path = ''): string {
  return `${SITE}${path}`;
}

/**
 * Fiche produit structurée (schema.org).
 *
 * `Product` + `Offer` permettent l'affichage du prix et de la disponibilité dans
 * les résultats de recherche. On ne déclare AUCUN `aggregateRating` : inventer
 * des avis est une violation des règles de Google sur les données structurées et
 * vaut une pénalité manuelle. À ajouter seulement quand de vrais avis existent.
 */
export function productJsonLd(input: {
  name: string;
  description: string;
  image: string;
  priceEur: number;
  url: string;
  brand?: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    image: [siteUrl(input.image)],
    brand: { '@type': 'Brand', name: input.brand ?? 'GetYourJersey' },
    offers: {
      '@type': 'Offer',
      url: siteUrl(input.url),
      priceCurrency: 'EUR',
      price: input.priceEur.toFixed(2),
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingDestination: [
          { '@type': 'DefinedRegion', addressCountry: 'FR' },
          { '@type': 'DefinedRegion', addressCountry: 'US' },
        ],
      },
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: siteUrl(item.url),
    })),
  };
}

export function faqJsonLd(entries: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}
