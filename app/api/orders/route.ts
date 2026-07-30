import { NextResponse } from 'next/server';
import { isLocale, defaultLocale } from '@/i18n/routing';
import { trackEvent } from '@/lib/analytics';
import { isSupportedCountry, currencyForCountry } from '@/lib/countries';
import { isDbConfigured } from '@/lib/db';
import { isValidJerseyNumber, normalizeJerseyName } from '@/lib/glyphs';
import { isKitSlug, priceFor } from '@/lib/kits';
import { createOrder, listOrders } from '@/lib/orders';
import { getSettings } from '@/lib/settings';
import { isAuthorizedRequest } from '@/lib/auth';
import { buildWhatsappLink, whatsappContextFromOrder } from '@/lib/whatsapp';
import { loadKit } from '@/lib/kits';
import {
  DEFAULT_DESIGN_STYLE,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  SIZES,
  TIERS,
  orderReference,
  type DesignJson,
  type OrderStatus,
  type PaymentMethod,
  type Size,
  type Tier,
} from '@/lib/types';

export const runtime = 'nodejs';

const REQUIRED_TEXT = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'country',
  'address',
  'postal_code',
  'city',
] as const;

/** Création de commande (étape 6 du parcours). */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const text = (key: string): string =>
    typeof body[key] === 'string' ? (body[key] as string).trim() : '';

  for (const key of REQUIRED_TEXT) {
    if (text(key).length === 0) {
      return NextResponse.json({ error: 'MISSING_FIELD', field: key }, { status: 400 });
    }
  }

  const email = text('email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 });
  }

  const country = text('country').toUpperCase();
  if (!isSupportedCountry(country)) {
    return NextResponse.json({ error: 'UNSUPPORTED_COUNTRY' }, { status: 400 });
  }

  const kitSlug = text('kit_slug');
  const tier = text('kit_tier');
  const size = text('size');
  const jerseyNumber = text('jersey_number');
  const jerseyName = normalizeJerseyName(text('jersey_name'));

  if (!isKitSlug(kitSlug)) {
    return NextResponse.json({ error: 'UNKNOWN_KIT' }, { status: 400 });
  }
  if (!(TIERS as readonly string[]).includes(tier)) {
    return NextResponse.json({ error: 'UNKNOWN_TIER' }, { status: 400 });
  }
  if (!(SIZES as readonly string[]).includes(size)) {
    return NextResponse.json({ error: 'UNKNOWN_SIZE' }, { status: 400 });
  }
  if (!isValidJerseyNumber(jerseyNumber) || jerseyName.length === 0) {
    return NextResponse.json({ error: 'INVALID_FLOCKING' }, { status: 400 });
  }

  const photoUrls = Array.isArray(body.photo_urls)
    ? (body.photo_urls as unknown[]).filter((u): u is string => typeof u === 'string')
    : [];
  if (photoUrls.length === 0 || photoUrls.length > 3) {
    return NextResponse.json({ error: 'INVALID_PHOTO_COUNT' }, { status: 400 });
  }

  const paymentMethod: PaymentMethod = (PAYMENT_METHODS as readonly string[]).includes(
    text('payment_method'),
  )
    ? (text('payment_method') as PaymentMethod)
    : 'iban';

  const languageRaw = text('language');
  const language = isLocale(languageRaw) ? languageRaw : defaultLocale;

  // Le montant est recalculé côté serveur : jamais celui envoyé par le client.
  const currency = currencyForCountry(country);
  const amount = await priceFor(kitSlug, tier as Tier, currency);

  const kit = await loadKit(kitSlug);
  const design: DesignJson = {
    photos: photoUrls,
    layout: {
      kitSlug,
      tier: tier as Tier,
      jerseyNumber,
      jerseyName,
      halftone: DEFAULT_DESIGN_STYLE.halftone,
      border: {
        widthPx: DEFAULT_DESIGN_STYLE.borderWidthPx,
        color: kit.flocking.primary,
        accentColor: kit.flocking.secondary,
      },
    },
  };

  try {
    const order = await createOrder({
      first_name: text('first_name'),
      last_name: text('last_name'),
      email,
      phone: text('phone'),
      country,
      address: text('address'),
      postal_code: text('postal_code'),
      city: text('city'),
      language,
      kit_slug: kitSlug,
      kit_tier: tier as Tier,
      size: size as Size,
      jersey_name: jerseyName,
      jersey_number: jerseyNumber,
      amount,
      currency,
      design_json: design,
      render_preview_url:
        typeof body.render_preview_url === 'string' ? body.render_preview_url : null,
    });

    await trackEvent('STEP_6_ORDER_CREATED', {
      orderId: order.id,
      metadata: { kitSlug, tier, amount, currency, paymentMethod },
    });

    const response: {
      id: string;
      reference: string;
      amount: string;
      currency: string;
      whatsappUrl?: string;
    } = {
      id: order.id,
      reference: orderReference(order.id),
      amount: order.amount,
      currency: order.currency,
    };

    if (paymentMethod === 'whatsapp') {
      const settings = await getSettings();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
      response.whatsappUrl = buildWhatsappLink(
        settings.whatsapp_number,
        settings.whatsapp_template,
        whatsappContextFromOrder(order, kit.name, siteUrl),
      );
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[orders] création impossible', error);
    return NextResponse.json({ error: 'ORDER_FAILED' }, { status: 500 });
  }
}

/** Liste des commandes — admin uniquement. */
export async function GET(request: Request) {
  if (!(await isAuthorizedRequest(request))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  const orders = await listOrders({
    status:
      status && (ORDER_STATUSES as readonly string[]).includes(status)
        ? (status as OrderStatus)
        : undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  });

  return NextResponse.json({ orders });
}
