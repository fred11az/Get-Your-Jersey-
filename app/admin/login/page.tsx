import { Suspense } from 'react';
import { LoginForm } from '@/components/admin/LoginForm';

/**
 * Le formulaire lit `?from=` pour revenir sur la page demandée après connexion.
 * `useSearchParams` impose une frontière Suspense : sans elle, le prerender
 * échoue au build.
 */
export default function AdminLoginPage() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Suspense
        fallback={<div className="gyj-card h-72 w-full max-w-sm animate-pulse bg-neutral-50" />}
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
