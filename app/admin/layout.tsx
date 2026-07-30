import type { ReactNode } from 'react';
import '../globals.css';

export const metadata = {
  title: 'Administration — GetYourJersey',
  // Le dashboard ne doit jamais être indexé.
  robots: { index: false, follow: false },
};

/**
 * Coquille commune à `/admin/login` et au dashboard. La garde
 * d'authentification vit dans `app/admin/(dashboard)/layout.tsx` : la page de
 * connexion partage la même URL de base mais ne peut évidemment pas exiger
 * d'être déjà connecté.
 */
export default function AdminShellLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-neutral-50">{children}</body>
    </html>
  );
}
