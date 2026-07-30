'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/shared/Button';

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);

    const response = await fetch('/api/auth/verify-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => null);

    if (!response) {
      setError('Connexion impossible. Réessayer.');
      setBusy(false);
      return;
    }

    if (response.ok) {
      // `replace` : le formulaire ne doit pas rester dans l'historique.
      router.replace(search.get('from') ?? '/admin');
      return;
    }

    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setError(
      body.error === 'ADMIN_TOKEN_NOT_CONFIGURED'
        ? "ADMIN_TOKEN n'est pas configurée sur le serveur."
        : 'Token invalide.',
    );
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="gyj-card w-full max-w-sm p-7">
        <h1 className="mb-1.5 text-xl font-extrabold">Administration</h1>
        <p className="mb-6 text-sm text-ink-soft">GetYourJersey</p>

        <label className="gyj-label" htmlFor="token">
          Token d&apos;accès
        </label>
        <input
          id="token"
          type="password"
          className="gyj-field"
          value={token}
          autoComplete="current-password"
          autoFocus
          onChange={(e) => setToken(e.target.value)}
        />

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <Button type="submit" full className="mt-5" disabled={busy || token.length === 0}>
          {busy ? 'Vérification…' : 'Se connecter'}
        </Button>
    </form>
  );
}
