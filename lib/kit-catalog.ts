/**
 * Catalogue des kits réels, construit à partir des photos produit fournies par
 * le client. `sourceMarker` est le fragment de nom de fichier de la photo
 * d'origine : il rend l'import reproductible (scripts/import-real-kits.ts).
 */
/**
 * Couleurs de flocage, propres à chaque maillot.
 *
 * Deux couleurs suffisent, parce que le visuel de référence les réutilise de
 * façon croisée :
 *   - `primary`   → remplissage du nom ET bordure extérieure du numéro ;
 *   - `secondary` → cerne du nom ET liseré intérieur du numéro.
 *
 * Le choix n'est pas décoratif, il est fonctionnel : sur un maillot clair
 * (Real Madrid, Brésil, maillots extérieurs), une `primary` blanche serait
 * invisible. Chaque paire est donc choisie pour contraster avec le tissu du kit
 * concerné, en restant dans la palette officielle de l'équipe.
 */
export interface FlockingColors {
  primary: string;
  secondary: string;
}

export interface RealKitDefinition {
  slug: string;
  name: string;
  colorHex: string;
  flocking: FlockingColors;
  sourceMarker: string;
  /** Qualité de la photo source, pour prioriser les remplacements. */
  sourceQuality: 'clean' | 'mannequin' | 'flatlay';
}

export const REAL_KITS: RealKitDefinition[] = [
  {
    slug: 'portugal',
    name: 'Portugal',
    colorHex: '#B4223C',
    // blanc sur le rouge, liseré vert Portugal
    flocking: { primary: '#FFFFFF', secondary: '#046A38' },
    sourceMarker: 'WA0015',
    sourceQuality: 'clean',
  },
  {
    slug: 'portugal-away',
    name: 'Portugal Away',
    colorHex: '#A7E8D2',
    // vert foncé : le blanc serait invisible sur le mint
    flocking: { primary: '#046A38', secondary: '#B4223C' },
    sourceMarker: 'WA0017',
    sourceQuality: 'mannequin',
  },
  {
    slug: 'spain',
    name: 'Spain',
    colorHex: '#C8102E',
    // jaune sur le rouge, liseré navy
    flocking: { primary: '#FFD100', secondary: '#1B3A6B' },
    sourceMarker: 'WA0013',
    sourceQuality: 'clean',
  },
  {
    slug: 'spain-away',
    name: 'Spain Away',
    colorHex: '#EFE9DC',
    // grenat sur le crème, liseré or
    flocking: { primary: '#7B1E2B', secondary: '#C8A34A' },
    sourceMarker: 'WA0010',
    sourceQuality: 'clean',
  },
  {
    slug: 'france',
    name: 'France',
    colorHex: '#1E3A8A',
    // exactement le maillot de référence
    flocking: { primary: '#FFFFFF', secondary: '#D2202F' },
    sourceMarker: 'WA0011',
    sourceQuality: 'flatlay',
  },
  {
    slug: 'france-away',
    name: 'France Away',
    colorHex: '#CDEBDD',
    // navy : maillot extérieur trop clair pour du blanc
    flocking: { primary: '#1B3A6B', secondary: '#D2202F' },
    sourceMarker: 'WA0012',
    sourceQuality: 'clean',
  },
  {
    slug: 'brazil',
    name: 'Brazil',
    colorHex: '#F7DF1E',
    // vert sur le jaune, liseré bleu
    flocking: { primary: '#0B6B3A', secondary: '#1B3A8F' },
    sourceMarker: 'WA0014',
    sourceQuality: 'mannequin',
  },
  {
    slug: 'argentina',
    name: 'Argentina',
    colorHex: '#1B2A4A',
    // blanc sur le sombre, liseré céleste
    flocking: { primary: '#FFFFFF', secondary: '#6CACE4' },
    sourceMarker: 'WA0016',
    sourceQuality: 'clean',
  },
  {
    slug: 'barcelona',
    name: 'FC Barcelona',
    colorHex: '#A50044',
    // jaune Barça, lisible sur bleu comme sur grenat
    flocking: { primary: '#FFD100', secondary: '#1B2A6B' },
    sourceMarker: 'WA0008',
    sourceQuality: 'mannequin',
  },
  {
    slug: 'real-madrid',
    name: 'Real Madrid',
    colorHex: '#F0F0F0',
    // navy sur le blanc, liseré or
    flocking: { primary: '#1B3A6B', secondary: '#C8A34A' },
    sourceMarker: 'WA0009',
    sourceQuality: 'mannequin',
  },
];

export const REAL_KIT_SLUGS = REAL_KITS.map((k) => k.slug);
