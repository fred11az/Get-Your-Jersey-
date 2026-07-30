/**
 * Crée le schéma et insère la configuration initiale.
 *   npm run db:seed
 *
 * Idempotent : rejouable. N'écrase pas une ligne `settings` existante.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { DEFAULT_WHATSAPP_TEMPLATE } from '../lib/whatsapp';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL absente. Renseigner .env.local avant de lancer le seed.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString)
      ? undefined
      : { rejectUnauthorized: false },
  });

  try {
    const schema = await readFile(path.join(process.cwd(), 'lib', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('✓ Schéma appliqué (tables settings, orders, events + index)');

    const { rows } = await pool.query<{ count: string }>('SELECT COUNT(*)::text FROM settings');
    if (Number(rows[0]?.count ?? 0) === 0) {
      await pool.query(
        `INSERT INTO settings (iban, iban_bic, iban_holder, whatsapp_number, whatsapp_template)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'FR76 3000 4000 0300 0000 0000 000',
          'BNPAFRPPXXX',
          'GetYourJersey SAS',
          '+33600000000',
          DEFAULT_WHATSAPP_TEMPLATE,
        ],
      );
      console.log('✓ Configuration initiale insérée (à personnaliser dans /admin/settings)');
    } else {
      console.log('· Configuration déjà présente, laissée intacte');
    }

    if (!process.env.ADMIN_TOKEN) {
      console.warn('⚠ ADMIN_TOKEN absente : /admin restera inaccessible.');
    }
    console.log('\nSeed terminé.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Seed en échec :', error);
  process.exit(1);
});
