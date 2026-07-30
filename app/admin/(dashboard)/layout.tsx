import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { isAdminTokenConfigured, isAuthenticated } from '@/lib/auth';
import { AdminNav } from '@/components/admin/AdminNav';

export const dynamic = 'force-dynamic';

/**
 * Garde du dashboard. Le middleware vérifie déjà la présence du cookie, mais
 * c'est ici que sa valeur est réellement comparée à `ADMIN_TOKEN` : l'Edge
 * Runtime n'a pas `timingSafeEqual`, et dupliquer un contrôle de secret à deux
 * endroits est une source de divergence.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  if (!isAdminTokenConfigured()) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="gyj-card max-w-md p-7">
          <h1 className="mb-2 text-xl font-extrabold">Configuration incomplète</h1>
          <p className="text-sm leading-relaxed text-ink-soft">
            La variable d&apos;environnement <code className="font-mono">ADMIN_TOKEN</code>{' '}
            n&apos;est pas définie. Le dashboard reste inaccessible jusqu&apos;à ce qu&apos;elle
            le soit.
          </p>
        </div>
      </main>
    );
  }

  if (!(await isAuthenticated())) redirect('/admin/login');

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
