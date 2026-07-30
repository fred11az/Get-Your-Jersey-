/**
 * Formatage pur, sans dépendance Node.
 *
 * Ce module est importé par des composants client : il ne doit JAMAIS tirer
 * `node:fs` ni quoi que ce soit de serveur, sinon le bundler échoue en tentant
 * d'embarquer un module externe côté navigateur. C'est la raison d'être de ce
 * fichier, séparé de `lib/kits.ts` qui lit le disque.
 */
export function formatPrice(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
