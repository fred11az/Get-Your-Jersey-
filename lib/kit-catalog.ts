/**
 * Catalogue des kits réels, construit à partir des photos produit fournies par
 * le client. `sourceMarker` est le fragment de nom de fichier de la photo
 * d'origine : il rend l'import reproductible (scripts/import-real-kits.ts).
 */
export interface RealKitDefinition {
  slug: string;
  name: string;
  colorHex: string;
  sourceMarker: string;
  /** Qualité de la photo source, pour prioriser les remplacements. */
  sourceQuality: 'clean' | 'mannequin' | 'flatlay';
}

export const REAL_KITS: RealKitDefinition[] = [
  {
    slug: 'portugal',
    name: 'Portugal',
    colorHex: '#B4223C',
    sourceMarker: 'WA0015',
    sourceQuality: 'clean',
  },
  {
    slug: 'portugal-away',
    name: 'Portugal Away',
    colorHex: '#A7E8D2',
    sourceMarker: 'WA0017',
    sourceQuality: 'mannequin',
  },
  {
    slug: 'spain',
    name: 'Spain',
    colorHex: '#C8102E',
    sourceMarker: 'WA0013',
    sourceQuality: 'clean',
  },
  {
    slug: 'spain-away',
    name: 'Spain Away',
    colorHex: '#EFE9DC',
    sourceMarker: 'WA0010',
    sourceQuality: 'clean',
  },
  {
    slug: 'france',
    name: 'France',
    colorHex: '#1E3A8A',
    sourceMarker: 'WA0011',
    sourceQuality: 'flatlay',
  },
  {
    slug: 'france-away',
    name: 'France Away',
    colorHex: '#CDEBDD',
    sourceMarker: 'WA0012',
    sourceQuality: 'clean',
  },
  {
    slug: 'brazil',
    name: 'Brazil',
    colorHex: '#F7DF1E',
    sourceMarker: 'WA0014',
    sourceQuality: 'mannequin',
  },
  {
    slug: 'argentina',
    name: 'Argentina',
    colorHex: '#1B2A4A',
    sourceMarker: 'WA0016',
    sourceQuality: 'clean',
  },
  {
    slug: 'barcelona',
    name: 'FC Barcelona',
    colorHex: '#A50044',
    sourceMarker: 'WA0008',
    sourceQuality: 'mannequin',
  },
  {
    slug: 'real-madrid',
    name: 'Real Madrid',
    colorHex: '#F0F0F0',
    sourceMarker: 'WA0009',
    sourceQuality: 'mannequin',
  },
];

export const REAL_KIT_SLUGS = REAL_KITS.map((k) => k.slug);
