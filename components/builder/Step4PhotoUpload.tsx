'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export interface BuilderPhoto {
  id: string;
  file: File;
  /** URL objet locale, pour l'aperçu avant tout envoi. */
  objectUrl: string;
}

export function Step4PhotoUpload({
  photos,
  error,
  onAdd,
  onRemove,
}: {
  photos: BuilderPhoto[];
  error?: string;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations('builder.step4');
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string>();

  function accept(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    setLocalError(undefined);

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setLocalError(t('maxReached'));
      return;
    }

    const valid: File[] = [];
    for (const file of incoming.slice(0, room)) {
      if (!ACCEPTED.includes(file.type)) {
        setLocalError(t('unsupported'));
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setLocalError(t('tooLarge'));
        continue;
      }
      valid.push(file);
    }

    if (incoming.length > room) setLocalError(t('maxReached'));
    if (valid.length) onAdd(valid);
  }

  const message = localError ?? error;

  return (
    <section>
      <h2 className="mb-1.5">{t('title')}</h2>
      <p className="mb-7 text-ink-soft">{t('subtitle')}</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files);
        }}
        className={`rounded-[14px] border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? 'border-brand bg-brand-soft' : 'border-hairline bg-white'
        }`}
      >
        <p className="text-base font-semibold">{t('dropzone')}</p>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={photos.length >= MAX_PHOTOS}
          className="mt-1.5 text-sm font-semibold text-brand underline underline-offset-2 disabled:opacity-50 disabled:no-underline"
        >
          {t('browse')}
        </button>
        <p className="mt-3 text-xs text-ink-soft">{t('formats')}</p>

        <input
          ref={input}
          type="file"
          accept={ACCEPTED.join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            accept(e.target.files);
            // Permet de re-sélectionner le même fichier après suppression.
            e.target.value = '';
          }}
        />
      </div>

      {message && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {message}
        </p>
      )}

      {photos.length > 0 && (
        <>
          <ul className="mt-6 grid grid-cols-3 gap-4">
            {photos.map((photo, index) => (
              <li key={photo.id} className="gyj-card overflow-hidden">
                <div className="relative aspect-[3/4] bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL objet locale */}
                  <img
                    src={photo.objectUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/65 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(photo.id)}
                  className="w-full border-t border-hairline py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  {t('remove')}
                </button>
              </li>
            ))}
          </ul>

          {/* L'ordre compte : il détermine l'empilement dans le numéro. */}
          <p className="mt-3 text-xs text-ink-soft">{t('explain')}</p>
        </>
      )}
    </section>
  );
}
