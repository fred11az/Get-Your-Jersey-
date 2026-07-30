import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale } from './routing';

/**
 * Les fichiers de traduction vivent dans `public/locales/` conformément à la
 * section 8 de docs/SPEC.md. Ils sont importés (donc bundlés) et non lus via
 * HTTP : le chemin `public/` les rend aussi accessibles statiquement, ce qui est
 * sans conséquence pour des libellés d'interface.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: (await import(`../public/locales/${locale}.json`)).default,
  };
});
