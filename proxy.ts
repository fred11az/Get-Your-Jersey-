import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { ADMIN_COOKIE } from './lib/auth-shared';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Deux responsabilités (section 4 de docs/SPEC.md) :
 *  1. routing multilingue pour les pages publiques ;
 *  2. garde d'accès au dashboard admin.
 *
 * Le middleware ne fait que vérifier la *présence* du cookie : la comparaison
 * avec ADMIN_TOKEN se fait dans le layout admin et les routes API, côté Node.
 * L'Edge Runtime n'a pas accès à `timingSafeEqual`, et dupliquer un contrôle de
 * secret à deux endroits est une source de divergence.
 */
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') return NextResponse.next();

    if (!request.cookies.get(ADMIN_COOKIE)?.value) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques, les assets et les routes API.
    '/((?!api|_next|_vercel|models|kits|locales|fonts|favicon.ico|.*\\..*).*)',
  ],
};
