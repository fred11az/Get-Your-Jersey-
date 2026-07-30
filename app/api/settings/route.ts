import { NextResponse } from 'next/server';
import { isAuthorizedRequest } from '@/lib/auth';
import {
  getSettings,
  isValidIban,
  isValidWhatsappNumber,
  updateSettings,
} from '@/lib/settings';

export const runtime = 'nodejs';

/**
 * Lecture des réglages.
 *
 * Sans authentification on ne renvoie que le sous-ensemble public — celui dont
 * le checkout a besoin. Le reste (horodatages, identifiant interne) est réservé
 * à l'admin.
 */
export async function GET(request: Request) {
  const settings = await getSettings();

  if (await isAuthorizedRequest(request)) {
    return NextResponse.json({ settings });
  }

  return NextResponse.json({
    settings: {
      iban: settings.iban,
      iban_bic: settings.iban_bic,
      iban_holder: settings.iban_holder,
      whatsapp_number: settings.whatsapp_number,
      whatsapp_template: settings.whatsapp_template,
    },
  });
}

/** Mise à jour des réglages — admin uniquement. */
export async function PUT(request: Request) {
  if (!(await isAuthorizedRequest(request))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const str = (key: string): string =>
    typeof body[key] === 'string' ? (body[key] as string).trim() : '';

  const iban = str('iban').replace(/\s+/g, '').toUpperCase();
  const whatsappNumber = str('whatsapp_number');
  const template = str('whatsapp_template');

  if (!isValidIban(iban)) {
    return NextResponse.json({ error: 'INVALID_IBAN' }, { status: 400 });
  }
  if (!isValidWhatsappNumber(whatsappNumber)) {
    return NextResponse.json({ error: 'INVALID_WHATSAPP_NUMBER' }, { status: 400 });
  }
  if (template.length === 0) {
    return NextResponse.json({ error: 'EMPTY_TEMPLATE' }, { status: 400 });
  }

  try {
    const settings = await updateSettings({
      iban,
      iban_bic: str('iban_bic') || null,
      iban_holder: str('iban_holder') || null,
      whatsapp_number: whatsappNumber,
      whatsapp_template: template,
    });
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[settings] mise à jour impossible', error);
    return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 });
  }
}
