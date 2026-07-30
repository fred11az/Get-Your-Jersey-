import { Pool, type QueryResultRow } from 'pg';

/**
 * Pool PostgreSQL partagé. En dev, Next recharge les modules à chaque édition :
 * on garde le pool sur `globalThis` pour ne pas épuiser les connexions.
 */
const globalForDb = globalThis as unknown as { __gyjPool?: Pool };

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL absente. Copier .env.example en .env.local et renseigner la connexion PostgreSQL.',
    );
  }

  if (!globalForDb.__gyjPool) {
    globalForDb.__gyjPool = new Pool({
      connectionString,
      // Vercel Postgres exige TLS ; en local (docker/postgres nu) il n'est pas là.
      ssl: /localhost|127\.0\.0\.1/.test(connectionString)
        ? undefined
        : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }
  return globalForDb.__gyjPool;
}

export async function query<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

/** Première ligne ou `null`. */
export async function queryOne<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
