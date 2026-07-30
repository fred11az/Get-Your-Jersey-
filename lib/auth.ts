import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE } from './auth-shared';

export { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE };

function adminToken(): string | undefined {
  const token = process.env.ADMIN_TOKEN;
  return token && token.length > 0 ? token : undefined;
}

/**
 * Comparaison à temps constant. On hache les deux côtés d'abord : `timingSafeEqual`
 * exige des buffers de même longueur, et comparer les longueurs brutes
 * divulguerait la taille du token.
 */
function secureEquals(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Le cookie ne stocke pas le token en clair mais son empreinte. */
function cookieValueFor(token: string): string {
  return createHash('sha256').update(`gyj:${token}`).digest('hex');
}

export function verifyToken(candidate: string): boolean {
  const expected = adminToken();
  if (!expected) return false;
  return secureEquals(candidate, expected);
}

export function sessionCookieValue(): string | null {
  const expected = adminToken();
  return expected ? cookieValueFor(expected) : null;
}

/** Vérifie la session admin depuis les cookies de la requête courante. */
export async function isAuthenticated(): Promise<boolean> {
  const expected = sessionCookieValue();
  if (!expected) return false;
  const jar = await cookies();
  const actual = jar.get(ADMIN_COOKIE)?.value;
  return Boolean(actual) && secureEquals(actual as string, expected);
}

/**
 * Auth des routes API admin : accepte soit le cookie de session, soit un header
 * `Authorization: Bearer <ADMIN_TOKEN>` pour les appels scriptés.
 */
export async function isAuthorizedRequest(request: Request): Promise<boolean> {
  const header = request.headers.get('authorization');
  if (header?.startsWith('Bearer ')) {
    return verifyToken(header.slice('Bearer '.length).trim());
  }
  return isAuthenticated();
}

export function isAdminTokenConfigured(): boolean {
  return Boolean(adminToken());
}
