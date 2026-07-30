import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/i18n/routing';
import { loadAllKits } from '@/lib/kits';
import { getSettings } from '@/lib/settings';
import { loadScenes, scenePlayback, type ScenePlayback } from '@/lib/scenes';
import type { KitOption, PublicSettings } from '@/lib/types';
import { BuilderShell } from '@/components/builder/BuilderShell';

// Les réglages (IBAN, WhatsApp) sont éditables en admin : pas de mise en cache.
export const dynamic = 'force-dynamic';

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const [kits, settings, scenes] = await Promise.all([loadAllKits(), getSettings(), loadScenes()]);

  // On ne transmet au client que le strict nécessaire : les metadata complètes
  // contiennent des chemins serveur, et `settings` un enregistrement complet.
  const options: KitOption[] = kits.map((kit) => ({
    slug: kit.slug,
    name: kit.name,
    color_hex: kit.color_hex,
    flocking: kit.flocking,
    tiers: {
      supporter: {
        price_eur: kit.tiers.supporter.price_eur,
        price_usd: kit.tiers.supporter.price_usd,
      },
      authentique: {
        price_eur: kit.tiers.authentique.price_eur,
        price_usd: kit.tiers.authentique.price_usd,
      },
      joueur: { price_eur: kit.tiers.joueur.price_eur, price_usd: kit.tiers.joueur.price_usd },
    },
  }));

  const publicSettings: PublicSettings = {
    iban: settings.iban,
    iban_bic: settings.iban_bic,
    iban_holder: settings.iban_holder,
    whatsapp_number: settings.whatsapp_number,
    whatsapp_template: settings.whatsapp_template,
  };

  // Les scènes sont optionnelles : sans photo déposée, le builder n'affiche pas
  // l'option « porté » et l'aperçu reste sur le maillot à plat.
  return (
    <BuilderShell
      kits={options}
      settings={publicSettings}
      scenes={scenes.map((scene) => ({
        id: scene.id,
        label: scene.label,
        gender: scene.gender,
        kitSlug: scene.kitSlug,
      }))}
      playbacks={Object.fromEntries(
        scenes
          .map((scene) => [scene.id, scenePlayback(scene)] as const)
          .filter((entry): entry is [string, ScenePlayback] => entry[1] !== null),
      )}
    />
  );
}
