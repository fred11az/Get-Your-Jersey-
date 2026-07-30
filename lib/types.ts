import type { Locale } from '@/i18n/routing';

/**
 * Kits disponibles, adossés aux photos produit réelles fournies par le client
 * (voir lib/kit-catalog.ts et scripts/import-real-kits.ts). La spec en prévoyait
 * cinq fictifs ; les dix ci-dessous sont les maillots réellement en catalogue.
 */
export const KIT_SLUGS = [
  'portugal',
  'portugal-away',
  'spain',
  'spain-away',
  'france',
  'france-away',
  'brazil',
  'argentina',
  'barcelona',
  'real-madrid',
] as const;
export type KitSlug = (typeof KIT_SLUGS)[number];

export const TIERS = ['supporter', 'authentique', 'joueur'] as const;
export type Tier = (typeof TIERS)[number];

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type Size = (typeof SIZES)[number];

export const ORDER_STATUSES = ['PENDING', 'PAID', 'SENT_TO_PRINTER', 'SHIPPED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ['iban', 'whatsapp'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Zone d'impression : px pour le mockup, mm pour la sortie imprimeur. */
export interface PrintZone {
  x: number;
  y: number;
  width: number;
  height: number;
  width_mm: number;
  height_mm: number;
}

export interface TierMeta {
  print_zone: PrintZone;
  price_eur: number;
  price_usd: number;
}

/**
 * Couleurs de flocage propres au kit. `primary` remplit le nom et forme la
 * bordure extérieure du numéro ; `secondary` cerne le nom et forme le liseré
 * intérieur du numéro. Elles sont choisies pour contraster avec le tissu du
 * maillot — une bordure blanche serait invisible sur un maillot blanc.
 */
export interface Flocking {
  primary: string;
  secondary: string;
}

export interface KitMetadata {
  slug: KitSlug;
  name: string;
  color_hex: string;
  flocking: Flocking;
  mockup: { width: number; height: number };
  tiers: Record<Tier, TierMeta>;
}

/** Contenu de `orders.design_json`. */
export interface DesignJson {
  /** URLs des PNG RGBA déjà détourés côté navigateur. */
  photos: string[];
  layout: {
    kitSlug: KitSlug;
    tier: Tier;
    jerseyNumber: string;
    jerseyName: string;
    halftone: { angle: number; size: number };
    border: { widthPx: number; color: string; accentColor: string };
  };
}

export interface Order {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  postal_code: string;
  city: string;
  language: Locale;
  kit_slug: KitSlug;
  kit_tier: Tier;
  size: Size;
  jersey_name: string;
  jersey_number: string;
  amount: string;
  currency: string;
  design_json: DesignJson;
  render_preview_url: string | null;
  render_pdf_url: string | null;
  status: OrderStatus;
  whatsapp_sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: number;
  iban: string;
  iban_bic: string | null;
  iban_holder: string | null;
  whatsapp_number: string;
  whatsapp_template: string;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsEvent {
  id: number;
  type: string;
  order_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const EVENT_TYPES = [
  'STEP_1_VIEWED',
  'STEP_1_SELECTED',
  'STEP_2_SELECTED',
  'STEP_3_COMPLETED',
  'STEP_4_PHOTOS_UPLOADED',
  'STEP_5_PREVIEW_GENERATED',
  'STEP_6_ORDER_CREATED',
  'CLICK_PREVIEW',
  'CLICK_ORDER',
  'BACKGROUND_REMOVAL_FAILED',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Référence courte lisible, dérivée de l'UUID (ex. GYJ-4F2A9C). */
export function orderReference(id: string): string {
  return `GYJ-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

/**
 * Vues sérialisables passées du serveur aux composants client du builder.
 * On n'expose que ce qui est nécessaire : ni chemins de fichiers, ni secrets.
 */
export interface KitOption {
  slug: KitSlug;
  name: string;
  color_hex: string;
  flocking: Flocking;
  tiers: Record<Tier, { price_eur: number; price_usd: number }>;
}

/** Sous-ensemble public de `settings` : aucune donnée sensible. */
export interface PublicSettings {
  iban: string;
  iban_bic: string | null;
  iban_holder: string | null;
  whatsapp_number: string;
  whatsapp_template: string;
}

/**
 * Paramètres de style figés dans `design_json` à la commande. Ils tracent ce qui
 * a été montré au client : si le pipeline évolue, on sait avec quels réglages la
 * commande a été validée.
 */
export const DEFAULT_DESIGN_STYLE = {
  halftone: { angle: 45, size: 0 },
  borderWidthPx: 13,
} as const;

/** Vue client d'une mise en situation portée (voir lib/scenes.ts). */
export interface SceneOption {
  id: string;
  label: string;
  gender: 'man' | 'woman';
  /** `null` = scène neutre, utilisable avec tous les kits. */
  kitSlug: string | null;
}
