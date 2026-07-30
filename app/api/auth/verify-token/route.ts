import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
  isAdminTokenConfigured,
  sessionCookieValue,
  verifyToken,
} from '@/lib/auth';

export const runtime = 'nodejs';

/** Connexion admin : échange le token contre un cookie de session httpOnly. */
export async function POST(request: Request) {
  if (!isAdminTokenConfigured()) {
    return NextResponse.json({ error: 'ADMIN_TOKEN_NOT_CONFIGURED' }, { status: 503 });
  }

  let token: string;
  try {
    const body = (await request.json()) as { token?: unknown };
    if (typeof body.token !== 'string') throw new Error();
    token = body.token;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  if (!verifyToken(token)) {
    // Délai fixe : réduit l'intérêt d'une attaque par force brute sans révéler
    // si l'échec vient du format ou de la valeur.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 401 });
  }

  const value = sessionCookieValue();
  if (!value) {
    return NextResponse.json({ error: 'ADMIN_TOKEN_NOT_CONFIGURED' }, { status: 503 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE,
    value,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  return response;
}

/** Déconnexion. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: ADMIN_COOKIE, value: '', path: '/', maxAge: 0 });
  return response;
}
