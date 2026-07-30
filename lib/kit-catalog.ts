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
  /**
   * Fragment de nom de fichier de la photo de **dos**, quand le client en a
   * fourni une. Sans lui, le dos est un mockup dérivé de la face
   * (docs/DIVERGENCES.md §4), ce qui reste une approximation : le flocage se
   * pose au dos, donc une vraie photo de dos est toujours préférable. Quand elle
   * existe, la zone d'impression est calculée sur elle et non sur la face.
   */
  backMarker?: string;
  /**
   * Zone à retoucher sur la photo produit, en fractions de l'image du vêtement.
   * Sert à effacer un flocage déjà présent : le maillot doit être vierge, sinon
   * l'ancien numéro transparaît sous celui du client.
   */
  eraseZone?: { x: number; y: number; w: number; h: number };
  /**
   * Ramène au blanc pur un fond de studio légèrement gris ou crème. À n'activer
   * que sur une photo prise contre un mur : sur un fond déjà blanc c'est inutile,
   * et sur un maillot très clair et peu saturé (Real Madrid domicile) cela
   * risquerait de manger le vêtement.
   */
  whitenBackdrop?: boolean;
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
    sourceMarker: 'WA0031',
    backMarker: 'WA0032',
    sourceQuality: 'clean',
  },
  {
    slug: 'spain-away',
    name: 'Spain Away',
    colorHex: '#EFE9DC',
    // grenat sur le crème, liseré or
    flocking: { primary: '#7B1E2B', secondary: '#C8A34A' },
    sourceMarker: 'WA0029',
    backMarker: 'WA0030',
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
    slug: 'england',
    name: 'England',
    colorHex: '#F2F4F8',
    // navy sur le blanc, liseré rouge — les couleurs de col du maillot
    flocking: { primary: '#12224C', secondary: '#D2202F' },
    sourceMarker: 'WA0072',
    backMarker: 'WA0073',
    sourceQuality: 'clean',
  },
  {
    slug: 'england-away',
    name: 'England Away',
    colorHex: '#D7202A',
    // blanc sur le rouge, liseré navy
    flocking: { primary: '#FFFFFF', secondary: '#12224C' },
    sourceMarker: 'WA0069',
    backMarker: 'WA0071',
    sourceQuality: 'clean',
  },
  {
    slug: 'brazil',
    name: 'Brazil',
    colorHex: '#F7DF1E',
    // vert sur le jaune, liseré bleu
    flocking: { primary: '#0B6B3A', secondary: '#1B3A8F' },
    sourceMarker: 'WA0061',
    backMarker: 'WA0065',
    sourceQuality: 'clean',
  },
  {
    slug: 'brazil-away',
    name: 'Brazil Away',
    colorHex: '#14224A',
    // or sur le presque noir : le vert Brésil y serait sourd
    flocking: { primary: '#FFC72C', secondary: '#00A868' },
    sourceMarker: 'WA0066',
    backMarker: 'WA0068',
    sourceQuality: 'clean',
  },
  {
    slug: 'argentina',
    name: 'Argentina',
    colorHex: '#8AB6E0',
    // blanc sur le sombre, liseré céleste
    flocking: { primary: '#FFFFFF', secondary: '#6CACE4' },
    // Le maillot domicile fourni porte un « 10 » floqué : effacé à l'import.
    eraseZone: { x: 0.28, y: 0.24, w: 0.44, h: 0.40 },
    sourceMarker: 'WA0059',
    sourceQuality: 'clean',
  },
  {
    slug: 'argentina-away',
    name: 'Argentina Away',
    colorHex: '#14161C',
    // blanc sur le noir, liseré bleu vif comme les arabesques du maillot
    flocking: { primary: '#FFFFFF', secondary: '#2B5EE8' },
    sourceMarker: 'WA0016',
    backMarker: 'WA0035',
    // Seule photo du lot prise contre un mur, et non en studio sur fond blanc.
    whitenBackdrop: true,
    sourceQuality: 'flatlay',
  },
  {
    slug: 'usa',
    name: 'USA',
    colorHex: '#D62232',
    // navy sur les vagues rouges et blanches : seule teinte lisible sur les deux
    flocking: { primary: '#1B2A5B', secondary: '#FFFFFF' },
    sourceMarker: 'WA0076',
    backMarker: 'WA0077',
    sourceQuality: 'clean',
  },
  {
    slug: 'usa-away',
    name: 'USA Away',
    colorHex: '#E4ECF8',
    // navy sur le bleu très pâle, liseré rouge
    flocking: { primary: '#1B2A5B', secondary: '#C8102E' },
    sourceMarker: 'WA0074',
    backMarker: 'WA0075',
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
    sourceMarker: 'WA0036',
    sourceQuality: 'mannequin',
  },
  {
    slug: 'real-madrid-away',
    name: 'Real Madrid Away',
    colorHex: '#12233F',
    // blanc sur le navy, liseré or
    flocking: { primary: '#FFFFFF', secondary: '#C8A34A' },
    sourceMarker: 'WA0033',
    backMarker: 'WA0034',
    sourceQuality: 'clean',
  },
  {
    slug: 'psg',
    name: 'Paris Saint-Germain',
    colorHex: '#1A3EA8',
    // blanc, comme le flocage réel du club ; liseré rouge de la bande centrale
    flocking: { primary: '#FFFFFF', secondary: '#C8102E' },
    sourceMarker: 'WA0078',
    backMarker: 'WA0079',
    sourceQuality: 'clean',
  },
  {
    slug: 'psg-away',
    name: 'Paris Saint-Germain Away',
    colorHex: '#F4F5F8',
    // navy sur le blanc, liseré magenta de la bande centrale
    flocking: { primary: '#101A3C', secondary: '#D81E5B' },
    sourceMarker: 'WA0081',
    backMarker: 'WA0082',
    sourceQuality: 'clean',
  },
];

export const REAL_KIT_SLUGS = REAL_KITS.map((k) => k.slug);
