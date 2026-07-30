'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Tableau de bord' },
  { href: '/admin/orders', label: 'Commandes' },
  { href: '/admin/settings', label: 'Réglages' },
  { href: '/admin/analytics', label: 'Analytique' },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/verify-token', { method: 'DELETE' });
    router.replace('/admin/login');
  }

  return (
    <header className="border-b border-hairline bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2 font-extrabold">
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-[8px] bg-brand text-[0.65rem] text-white"
          >
            GYJ
          </span>
          Admin
        </span>

        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {LINKS.map((link) => {
            // `/admin` ne doit pas rester actif sur les sous-pages.
            const active =
              link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`py-1 font-medium transition-colors ${
                  active ? 'text-brand underline underline-offset-4' : 'text-ink-soft hover:text-brand'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={logout}
          className="ml-auto rounded-[8px] border border-hairline px-3 py-1.5 text-sm font-medium hover:border-brand hover:text-brand"
        >
          Déconnexion
        </button>
      </div>
    </header>
  );
}
