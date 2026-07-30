import { getSettings } from '@/lib/settings';
import { isDbConfigured } from '@/lib/db';
import { SettingsForm } from '@/components/admin/SettingsForm';

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <h1 className="mb-2 text-2xl font-extrabold">Réglages</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Ces valeurs sont affichées aux clients à l&apos;étape de paiement.
      </p>

      {!isDbConfigured() && (
        <p className="mb-6 rounded-[8px] bg-amber-50 p-3 text-sm text-amber-900">
          <code className="font-mono">DATABASE_URL</code> n&apos;est pas configurée : les valeurs
          affichées sont celles de repli et ne peuvent pas être enregistrées.
        </p>
      )}

      <SettingsForm
        initial={{
          iban: settings.iban,
          iban_bic: settings.iban_bic,
          iban_holder: settings.iban_holder,
          whatsapp_number: settings.whatsapp_number,
          whatsapp_template: settings.whatsapp_template,
        }}
      />
    </>
  );
}
