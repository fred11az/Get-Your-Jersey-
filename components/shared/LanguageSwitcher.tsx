'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { locales, localeLabels, type Locale } from '@/i18n/routing';

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /** Remplace le segment de langue en conservant le reste du chemin. */
  function switchTo(next: Locale) {
    const segments = pathname.split('/');
    segments[1] = next;
    router.push(segments.join('/') || `/${next}`);
    setOpen(false);
  }

  const current = localeLabels[locale];

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current.name}
        className="flex items-center gap-1.5 rounded-[8px] border border-hairline px-2.5 py-2 text-sm font-medium transition-colors hover:border-brand hover:text-brand"
      >
        <span aria-hidden>{current.flag}</span>
        <span className="hidden sm:inline">{locale.toUpperCase()}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden className="opacity-60">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1.5 w-44 overflow-hidden rounded-[10px] border border-hairline bg-white py-1 shadow-xl"
        >
          {locales.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={l === locale}
                onClick={() => switchTo(l)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-brand-soft ${
                  l === locale ? 'font-semibold text-brand' : 'text-ink'
                }`}
              >
                <span aria-hidden>{localeLabels[l].flag}</span>
                {localeLabels[l].name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
