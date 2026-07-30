/**
 * Marchés desservis : Union européenne + quelques voisins européens + USA
 * (section 1 de docs/SPEC.md). La devise découle du pays.
 */
export interface Country {
  code: string;
  name: string;
  currency: 'EUR' | 'USD';
}

export const COUNTRIES: Country[] = [
  { code: 'AT', name: 'Austria', currency: 'EUR' },
  { code: 'BE', name: 'Belgium', currency: 'EUR' },
  { code: 'BG', name: 'Bulgaria', currency: 'EUR' },
  { code: 'HR', name: 'Croatia', currency: 'EUR' },
  { code: 'CY', name: 'Cyprus', currency: 'EUR' },
  { code: 'CZ', name: 'Czechia', currency: 'EUR' },
  { code: 'DK', name: 'Denmark', currency: 'EUR' },
  { code: 'EE', name: 'Estonia', currency: 'EUR' },
  { code: 'FI', name: 'Finland', currency: 'EUR' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'GR', name: 'Greece', currency: 'EUR' },
  { code: 'HU', name: 'Hungary', currency: 'EUR' },
  { code: 'IE', name: 'Ireland', currency: 'EUR' },
  { code: 'IT', name: 'Italy', currency: 'EUR' },
  { code: 'LV', name: 'Latvia', currency: 'EUR' },
  { code: 'LT', name: 'Lithuania', currency: 'EUR' },
  { code: 'LU', name: 'Luxembourg', currency: 'EUR' },
  { code: 'MT', name: 'Malta', currency: 'EUR' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR' },
  { code: 'NO', name: 'Norway', currency: 'EUR' },
  { code: 'PL', name: 'Poland', currency: 'EUR' },
  { code: 'PT', name: 'Portugal', currency: 'EUR' },
  { code: 'RO', name: 'Romania', currency: 'EUR' },
  { code: 'SK', name: 'Slovakia', currency: 'EUR' },
  { code: 'SI', name: 'Slovenia', currency: 'EUR' },
  { code: 'ES', name: 'Spain', currency: 'EUR' },
  { code: 'SE', name: 'Sweden', currency: 'EUR' },
  { code: 'CH', name: 'Switzerland', currency: 'EUR' },
  { code: 'GB', name: 'United Kingdom', currency: 'EUR' },
  { code: 'US', name: 'United States', currency: 'USD' },
];

const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));

export function findCountry(code: string): Country | undefined {
  return byCode.get(code.toUpperCase());
}

export function currencyForCountry(code: string): 'EUR' | 'USD' {
  return findCountry(code)?.currency ?? 'EUR';
}

export function isSupportedCountry(code: string): boolean {
  return byCode.has(code.toUpperCase());
}
