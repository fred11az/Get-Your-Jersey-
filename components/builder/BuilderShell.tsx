'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import type {
  KitOption,
  KitSlug,
  PaymentMethod,
  PublicSettings,
  SceneOption,
  Size,
  Tier,
} from '@/lib/types';
import type { ScenePlayback } from '@/lib/scenes';
import { currencyForCountry } from '@/lib/countries';
import { Button } from '@/components/shared/Button';
import { ProgressBar, TOTAL_STEPS } from './ProgressBar';
import { Step1KitSelection } from './Step1KitSelection';
import { Step2TierSelection } from './Step2TierSelection';
import { Step3Details, validateDetails, type DetailsValue } from './Step3Details';
import { Step4PhotoUpload, type BuilderPhoto } from './Step4PhotoUpload';
import { Step5Preview } from './Step5Preview';
import {
  Step6Checkout,
  EMPTY_SHIPPING,
  validateShipping,
  type ShippingErrors,
  type ShippingValue,
} from './Step6Checkout';

/** Envoi best-effort d'un événement : jamais bloquant pour le parcours. */
function track(type: string, metadata?: Record<string, unknown>) {
  void fetch('/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type, metadata }),
    keepalive: true,
  }).catch(() => {});
}

export function BuilderShell({
  kits,
  settings,
  scenes = [],
  playbacks = {},
}: {
  kits: KitOption[];
  settings: PublicSettings;
  scenes?: SceneOption[];
  /** Séquences animées par identifiant de scène. Absente = image fixe. */
  playbacks?: Record<string, ScenePlayback>;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('builder');
  const tCommon = useTranslations('common');
  const tStep4 = useTranslations('builder.step4');
  const tStep5 = useTranslations('builder.step5');
  const tKits = useTranslations('kits');

  const [step, setStep] = useState(1);
  const [kitSlug, setKitSlug] = useState<KitSlug>();
  const [tier, setTier] = useState<Tier>();
  const [details, setDetails] = useState<DetailsValue>({ jerseyName: '', jerseyNumber: '' });
  const [detailErrors, setDetailErrors] = useState<ReturnType<typeof validateDetails>>({});
  const [photos, setPhotos] = useState<BuilderPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string>();

  const [previewUrl, setPreviewUrl] = useState<string>();
  const [artworkUrl, setArtworkUrl] = useState<string>();
  const [uploadedUrls, setUploadedUrls] = useState<string[]>();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string>();
  /** Change dès qu'une donnée du rendu bouge : invalide l'aperçu en cache. */
  const [renderKey, setRenderKey] = useState(0);
  /** Mise en situation portée. `undefined` = maillot à plat. */
  const [sceneId, setSceneId] = useState<string>();

  const [shipping, setShipping] = useState<ShippingValue>(EMPTY_SHIPPING);
  const [shippingErrors, setShippingErrors] = useState<ShippingErrors>({});
  const [payment, setPayment] = useState<PaymentMethod>('iban');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const kit = useMemo(() => kits.find((k) => k.slug === kitSlug), [kits, kitSlug]);
  const currency = shipping.country ? currencyForCountry(shipping.country) : 'EUR';
  const amount =
    kit && tier ? (currency === 'USD' ? kit.tiers[tier].price_usd : kit.tiers[tier].price_eur) : 0;

  useEffect(() => {
    track('STEP_1_VIEWED');
  }, []);

  // Les URL objet des photos doivent être révoquées, sinon elles fuient.
  useEffect(() => {
    return () => {
      for (const photo of photos) URL.revokeObjectURL(photo.objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nettoyage au démontage
  }, []);

  const addPhotos = useCallback((files: File[]) => {
    setPhotoError(undefined);
    setPhotos((current) => [
      ...current,
      ...files.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        objectUrl: URL.createObjectURL(file),
      })),
    ]);
    setUploadedUrls(undefined);
    setRenderKey((k) => k + 1);
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos((current) => {
      const target = current.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.objectUrl);
      return current.filter((p) => p.id !== id);
    });
    setUploadedUrls(undefined);
    setRenderKey((k) => k + 1);
  }, []);

  /** Envoie les photos une seule fois, puis demande le rendu au serveur. */
  const generatePreview = useCallback(async () => {
    if (!kit || !tier) return;
    setPreviewLoading(true);
    setPreviewError(undefined);

    try {
      let urls = uploadedUrls;

      if (!urls) {
        const form = new FormData();
        for (const photo of photos) form.append('photos', photo.file, photo.file.name);
        const upload = await fetch('/api/upload', { method: 'POST', body: form });
        if (!upload.ok) {
          const body = (await upload.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? 'UPLOAD_FAILED');
        }
        const uploaded = (await upload.json()) as { urls: string[] };
        urls = uploaded.urls;
        setUploadedUrls(urls);
      }

      const response = await fetch('/api/render/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          photoUrls: urls,
          jerseyNumber: details.jerseyNumber,
          jerseyName: details.jerseyName,
          kitSlug: kit.slug,
          jerseyTier: tier,
          sceneId,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'RENDER_FAILED');
      }

      const result = (await response.json()) as {
        previewUrl: string;
        artworkUrl?: string;
        generationTime: number;
      };
      setPreviewUrl(result.previewUrl);
      setArtworkUrl(result.artworkUrl);
      track('STEP_5_PREVIEW_GENERATED', {
        kitSlug: kit.slug,
        tier,
        generationTime: result.generationTime,
      });
    } catch (error) {
      // Le code serveur est repris tel quel : sans lui, « aperçu impossible »
      // ne dit ni au client ni à nous ce qui a réellement échoué.
      const code = error instanceof Error ? error.message : '';
      setPreviewError(code ? `${tStep5('failed')} (${code})` : tStep5('failed'));
      console.error('[builder] aperçu', error);
    } finally {
      setPreviewLoading(false);
    }
  }, [kit, tier, photos, uploadedUrls, details.jerseyNumber, details.jerseyName, sceneId, tStep5]);

  // L'aperçu se régénère en entrant à l'étape 5, ou si une donnée a changé.
  useEffect(() => {
    if (step === 5) void generatePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- déclencheur volontairement restreint
  }, [step, renderKey, sceneId]);

  function goNext() {
    if (step === 1) {
      if (!kitSlug) return;
      track('STEP_1_SELECTED', { kitSlug });
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!tier) return;
      track('STEP_2_SELECTED', { kitSlug, tier });
      setStep(3);
      return;
    }
    if (step === 3) {
      const errors = validateDetails(details);
      setDetailErrors(errors);
      if (Object.keys(errors).length > 0) return;
      track('STEP_3_COMPLETED', { size: details.size });
      setRenderKey((k) => k + 1);
      setStep(4);
      return;
    }
    if (step === 4) {
      if (photos.length === 0) {
        setPhotoError(tStep4('atLeastOne'));
        return;
      }
      track('STEP_4_PHOTOS_UPLOADED', { count: photos.length });
      setStep(5);
      return;
    }
    if (step === 5) {
      track('CLICK_ORDER');
      setStep(6);
    }
  }

  async function submitOrder() {
    if (!kit || !tier || !details.size) return;

    const errors = validateShipping(shipping);
    setShippingErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setSubmitError(undefined);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...shipping,
          language: locale,
          kit_slug: kit.slug,
          kit_tier: tier,
          size: details.size,
          jersey_name: details.jerseyName,
          jersey_number: details.jerseyNumber,
          photo_urls: uploadedUrls ?? [],
          render_preview_url: previewUrl,
          payment_method: payment,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'ORDER_FAILED');
      }

      const order = (await response.json()) as {
        id: string;
        reference: string;
        whatsappUrl?: string;
      };

      const target = new URLSearchParams({ order: order.id, method: payment });
      // On quitte le builder : la confirmation porte les instructions de paiement.
      router.push(`/${locale}/checkout/confirmation?${target.toString()}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message !== 'ORDER_FAILED'
          ? error.message
          : tCommon('genericError'),
      );
      setSubmitting(false);
    }
  }

  const canContinue =
    (step === 1 && Boolean(kitSlug)) ||
    (step === 2 && Boolean(tier)) ||
    step === 3 ||
    step === 4;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-7 text-3xl sm:text-4xl">{t('title')}</h1>
      <ProgressBar current={step} onJump={(target) => setStep(target)} />

      {step === 1 && (
        <Step1KitSelection kits={kits} selected={kitSlug} onSelect={setKitSlug} />
      )}

      {step === 2 && kit && (
        <Step2TierSelection kit={kit} currency={currency} selected={tier} onSelect={setTier} />
      )}

      {step === 3 && (
        <Step3Details
          value={details}
          errors={detailErrors}
          onChange={(patch) => {
            setDetails((current) => ({ ...current, ...patch }));
            setDetailErrors({});
          }}
        />
      )}

      {step === 4 && (
        <Step4PhotoUpload
          photos={photos}
          error={photoError}
          onAdd={addPhotos}
          onRemove={removePhoto}
        />
      )}

      {step === 5 && (
        <Step5Preview
          previewUrl={previewUrl}
          loading={previewLoading}
          error={previewError}
          // Scènes du kit choisi, plus les scènes neutres.
          scenes={scenes.filter((s) => s.kitSlug === null || s.kitSlug === kitSlug)}
          sceneId={sceneId}
          playback={sceneId ? (playbacks[sceneId] ?? null) : null}
          artworkUrl={artworkUrl}
          onSceneChange={setSceneId}
          onRegenerate={() => setRenderKey((k) => k + 1)}
          onBack={() => setStep(4)}
          onValidate={goNext}
        />
      )}

      {step === 6 && kit && tier && (
        <Step6Checkout
          value={shipping}
          errors={shippingErrors}
          payment={payment}
          iban={settings.iban}
          ibanBic={settings.iban_bic}
          ibanHolder={settings.iban_holder}
          submitting={submitting}
          submitError={submitError}
          summary={{
            kitName: tKits(kit.slug),
            tier,
            size: details.size as Size | undefined,
            jerseyName: details.jerseyName,
            jerseyNumber: details.jerseyNumber,
            amount,
            currency,
            previewUrl,
          }}
          onChange={(patch) => {
            setShipping((current) => ({ ...current, ...patch }));
            setShippingErrors({});
          }}
          onPaymentChange={setPayment}
          onSubmit={submitOrder}
        />
      )}

      {/* L'étape 5 porte ses propres actions, l'étape 6 son bouton de commande. */}
      {step !== 5 && step !== 6 && (
        <div className="mt-9 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
            {tCommon('back')}
          </Button>
          <Button variant="primary" size="lg" onClick={goNext} disabled={!canContinue}>
            {tCommon('next')}
          </Button>
        </div>
      )}

      {step === 6 && (
        <div className="mt-9">
          <Button variant="ghost" onClick={() => setStep(5)}>
            {tCommon('back')}
          </Button>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {t('stepLabel', { current: step, total: TOTAL_STEPS })}
      </p>
    </div>
  );
}
