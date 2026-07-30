'use client';

import { useState } from 'react';
import { Button } from '@/components/shared/Button';
import { buildWhatsappLink } from '@/lib/whatsapp';
import type { PublicSettings } from '@/lib/types';

const ERROR_LABELS: Record<string, string> = {
  INVALID_IBAN: 'IBAN invalide (format ou clé de contrôle).',
  INVALID_WHATSAPP_NUMBER: 'Numéro WhatsApp invalide. Format international, ex. +33612345678.',
  EMPTY_TEMPLATE: 'Le message pré-rempli ne peut pas être vide.',
  UNAUTHORIZED: 'Session expirée. Se reconnecter.',
};

export function SettingsForm({ initial }: { initial: PublicSettings }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  function patch(next: Partial<PublicSettings>) {
    setForm((current) => ({ ...current, ...next }));
    setSaved(false);
    setError(undefined);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);

    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    }).catch(() => null);

    setBusy(false);

    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(ERROR_LABELS[body.error ?? ''] ?? 'Enregistrement impossible.');
      return;
    }
    setSaved(true);
  }

  // Prévisualisation du lien tel que le client le recevra.
  const previewLink = buildWhatsappLink(form.whatsapp_number, form.whatsapp_template, {
    reference: 'GYJ-XXXXXX',
    kit: 'Portugal',
    tier: 'joueur',
    size: 'L',
    jerseyName: 'MARTIN',
    jerseyNumber: '10',
    amount: '89.00 EUR',
    previewUrl: 'https://…/preview.webp',
  });

  return (
    <form onSubmit={save} className="grid max-w-2xl gap-6">
      <fieldset className="gyj-card p-5">
        <legend className="px-1 text-sm font-bold">Compte bancaire pour les virements</legend>

        <div className="mt-3 grid gap-4">
          <div>
            <label className="gyj-label" htmlFor="iban">
              IBAN
            </label>
            <input
              id="iban"
              className="gyj-field font-mono"
              value={form.iban}
              maxLength={42}
              onChange={(e) => patch({ iban: e.target.value.toUpperCase() })}
            />
            <p className="mt-1.5 text-xs text-ink-soft">
              Affiché tel quel au client au moment du paiement. Clé de contrôle vérifiée à
              l&apos;enregistrement.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="gyj-label" htmlFor="bic">
                BIC (optionnel)
              </label>
              <input
                id="bic"
                className="gyj-field font-mono"
                value={form.iban_bic ?? ''}
                onChange={(e) => patch({ iban_bic: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className="gyj-label" htmlFor="holder">
                Titulaire
              </label>
              <input
                id="holder"
                className="gyj-field"
                value={form.iban_holder ?? ''}
                onChange={(e) => patch({ iban_holder: e.target.value })}
              />
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="gyj-card p-5">
        <legend className="px-1 text-sm font-bold">Lien WhatsApp pour les commandes</legend>

        <div className="mt-3 grid gap-4">
          <div>
            <label className="gyj-label" htmlFor="whatsapp">
              Numéro
            </label>
            <input
              id="whatsapp"
              className="gyj-field font-mono"
              value={form.whatsapp_number}
              placeholder="+33612345678"
              onChange={(e) => patch({ whatsapp_number: e.target.value })}
            />
          </div>

          <div>
            <label className="gyj-label" htmlFor="template">
              Message pré-rempli
            </label>
            <textarea
              id="template"
              className="gyj-field min-h-32 font-mono text-xs"
              value={form.whatsapp_template}
              onChange={(e) => patch({ whatsapp_template: e.target.value })}
            />
            <p className="mt-1.5 text-xs text-ink-soft">
              Jetons disponibles :{' '}
              <code className="font-mono">
                {'{reference} {kit} {tier} {size} {jerseyName} {jerseyNumber} {amount} {previewUrl}'}
              </code>
              . Un jeton inconnu est laissé tel quel, pour rendre la faute de frappe visible.
            </p>
          </div>

          <div>
            <p className="gyj-label">Aperçu du lien</p>
            <a
              href={previewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block break-all rounded-[8px] bg-neutral-50 p-3 text-xs text-brand hover:underline"
            >
              {previewLink}
            </a>
          </div>
        </div>
      </fieldset>

      <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        <strong className="font-bold">Token d&apos;administration.</strong> Il n&apos;est pas
        modifiable ici : il vit uniquement dans la variable d&apos;environnement{' '}
        <code className="font-mono">ADMIN_TOKEN</code>. Deux sources de vérité pour un même
        secret finissent par diverger — voir <code className="font-mono">docs/DIVERGENCES.md</code>{' '}
        §6.
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {saved && <p className="text-sm font-semibold text-emerald-700">Réglages enregistrés.</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setForm(initial);
            setError(undefined);
            setSaved(false);
          }}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
