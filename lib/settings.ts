import { isDbConfigured, query, queryOne } from './db';
import type { Settings } from './types';
import { DEFAULT_WHATSAPP_TEMPLATE } from './whatsapp';

/**
 * Valeurs de repli quand la base n'est pas encore branchée (dev, premier
 * déploiement avant seed). Elles permettent de parcourir le builder sans DB.
 */
export const FALLBACK_SETTINGS: Settings = {
  id: 0,
  iban: 'FR76 3000 4000 0300 0000 0000 000',
  iban_bic: 'BNPAFRPPXXX',
  iban_holder: 'GetYourJersey SAS',
  whatsapp_number: '+33600000000',
  whatsapp_template: DEFAULT_WHATSAPP_TEMPLATE,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

export async function getSettings(): Promise<Settings> {
  if (!isDbConfigured()) return FALLBACK_SETTINGS;
  try {
    const row = await queryOne<Settings>('SELECT * FROM settings ORDER BY id LIMIT 1');
    return row ?? FALLBACK_SETTINGS;
  } catch (error) {
    console.error('[settings] lecture impossible, repli sur les valeurs par défaut', error);
    return FALLBACK_SETTINGS;
  }
}

export interface SettingsInput {
  iban: string;
  iban_bic: string | null;
  iban_holder: string | null;
  whatsapp_number: string;
  whatsapp_template: string;
}

export async function updateSettings(input: SettingsInput): Promise<Settings> {
  const existing = await queryOne<{ id: number }>('SELECT id FROM settings ORDER BY id LIMIT 1');

  if (!existing) {
    const rows = await query<Settings>(
      `INSERT INTO settings (iban, iban_bic, iban_holder, whatsapp_number, whatsapp_template)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        input.iban,
        input.iban_bic,
        input.iban_holder,
        input.whatsapp_number,
        input.whatsapp_template,
      ],
    );
    return rows[0] as Settings;
  }

  const rows = await query<Settings>(
    `UPDATE settings
        SET iban = $1, iban_bic = $2, iban_holder = $3,
            whatsapp_number = $4, whatsapp_template = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *`,
    [
      input.iban,
      input.iban_bic,
      input.iban_holder,
      input.whatsapp_number,
      input.whatsapp_template,
      existing.id,
    ],
  );
  return rows[0] as Settings;
}

/** Validation IBAN : format, puis contrôle mod-97 (ISO 13616). */
export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));

  // Modulo 97 par tranches : le nombre dépasse la précision d'un Number.
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export function isValidWhatsappNumber(raw: string): boolean {
  return /^\+?\d{8,15}$/.test(raw.replace(/[\s.-]/g, ''));
}
