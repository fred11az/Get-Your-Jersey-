'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';
import type { SceneOption } from '@/lib/types';
import type { ScenePlayback } from '@/lib/scenes';
import { WornPlayer } from './WornPlayer';

export function Step5Preview({
  previewUrl,
  loading,
  error,
  scenes = [],
  sceneId,
  playback,
  artworkUrl,
  onSceneChange,
  onRegenerate,
  onBack,
  onValidate,
}: {
  previewUrl?: string;
  loading: boolean;
  error?: string;
  /** Mises en situation disponibles. Vide = option masquée. */
  scenes?: SceneOption[];
  sceneId?: string;
  /** Séquence animée de la scène courante, si elle en a une. */
  playback?: ScenePlayback | null;
  /** Visuel isolé à fond transparent, superposé par le lecteur animé. */
  artworkUrl?: string;
  onSceneChange?: (id: string | undefined) => void;
  onRegenerate: () => void;
  onBack: () => void;
  onValidate: () => void;
}) {
  const t = useTranslations('builder.step5');
  const tCommon = useTranslations('common');

  return (
    <section>
      <h2 className="mb-1.5">{t('title')}</h2>
      <p className="mb-7 text-ink-soft">{t('subtitle')}</p>

      {/* Sélecteur de mise en situation : n'apparaît que si des scènes ont été
          déposées dans public/scenes/ (voir docs/ASSETS.md). */}
      {scenes.length > 0 && onSceneChange && (
        <div className="mx-auto mb-5 flex max-w-md flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => onSceneChange(undefined)}
            aria-pressed={!sceneId}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              !sceneId ? 'border-brand bg-brand text-white' : 'border-hairline hover:border-brand'
            }`}
          >
            {t('viewFlat')}
          </button>
          {scenes.map((scene) => (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSceneChange(scene.id)}
              aria-pressed={sceneId === scene.id}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                sceneId === scene.id
                  ? 'border-brand bg-brand text-white'
                  : 'border-hairline hover:border-brand'
              }`}
            >
              {scene.gender === 'woman' ? t('viewWorn.woman') : t('viewWorn.man')}
            </button>
          ))}
        </div>
      )}

      <div className="gyj-card gyj-mockup-bg mx-auto flex aspect-[3/4] w-full max-w-md items-center justify-center overflow-hidden">
        {loading && (
          <div className="flex flex-col items-center gap-3 text-sm text-ink-soft">
            <span
              aria-hidden
              className="h-8 w-8 animate-spin rounded-full border-2 border-hairline border-t-brand"
            />
            {t('generating')}
          </div>
        )}

        {!loading && error && (
          <div className="px-6 text-center">
            <p role="alert" className="mb-4 text-sm text-red-600">
              {error}
            </p>
            <Button variant="ghost" onClick={onRegenerate}>
              {t('regenerate')}
            </Button>
          </div>
        )}

        {/* Scène animée : le visuel est superposé image par image dans un
            canvas. Sinon, image composée par le serveur. */}
        {!loading && !error && playback && artworkUrl && (
          <WornPlayer playback={playback} artworkUrl={artworkUrl} />
        )}

        {!loading && !error && !playback && previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- rendu dynamique hors build
          <img src={previewUrl} alt={t('title')} className="h-full w-full object-contain" />
        )}
      </div>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button variant="ghost" onClick={onBack}>
          {tCommon('edit')}
        </Button>
        <Button variant="accent" size="lg" onClick={onValidate} disabled={loading || !previewUrl}>
          {t('looksGood')}
        </Button>
      </div>
    </section>
  );
}
