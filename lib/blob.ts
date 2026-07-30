import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Stockage des fichiers (photos détourées, aperçus, PDF).
 *
 * En prod : Vercel Blob. En local sans jeton : disque, dans un dossier de cache,
 * servi par la route `/api/files/[...path]`. Les fonctions Vercel n'ayant pas de
 * disque partagé entre instances, le repli disque n'est PAS utilisable en
 * production — d'où l'avertissement au démarrage.
 */

/**
 * Repli disque, pour le développement uniquement.
 *
 * Impérativement sous `os.tmpdir()` : sur Vercel, tout le système de fichiers
 * est en LECTURE SEULE à l'exécution sauf `/tmp`. Écrire ailleurs — dans
 * `.next/cache` par exemple — lève EROFS, l'upload échoue, et le client ne voit
 * qu'un « aperçu impossible » sans indice de la cause.
 */
const LOCAL_DIR = path.join(os.tmpdir(), 'gyj-uploads');

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

if (!isBlobConfigured() && process.env.NODE_ENV === 'production') {
  console.warn(
    '[blob] BLOB_READ_WRITE_TOKEN absent en production : les fichiers vont dans le ' +
      "répertoire temporaire d'une seule instance. Ils seront introuvables dès que " +
      'la requête suivante atterrit ailleurs. Configurer Vercel Blob.',
  );
}

export interface StoredFile {
  url: string;
  pathname: string;
}

function safePathname(pathname: string): string {
  const clean = pathname.replace(/^\/+/, '');
  if (clean.includes('..')) throw new Error(`Chemin de stockage invalide : ${pathname}`);
  return clean;
}

export async function putFile(
  pathname: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<StoredFile> {
  const clean = safePathname(pathname);

  if (isBlobConfigured()) {
    const { put } = await import('@vercel/blob');
    const result = await put(clean, Buffer.from(body), {
      access: 'public',
      contentType,
      // Le chemin porte déjà un identifiant unique : pas de suffixe aléatoire,
      // sinon on ne peut plus recalculer l'URL depuis l'ID de commande.
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { url: result.url, pathname: clean };
  }

  const target = path.join(LOCAL_DIR, clean);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
  return { url: `/api/files/${clean}`, pathname: clean };
}

/** Lecture du repli disque (utilisée uniquement par `/api/files`). */
export async function readLocalFile(pathname: string): Promise<Buffer> {
  return readFile(path.join(LOCAL_DIR, safePathname(pathname)));
}

/** Récupère le contenu d'un fichier stocké, quel que soit le backend. */
export async function fetchStored(url: string): Promise<Buffer> {
  if (url.startsWith('/api/files/')) {
    return readLocalFile(url.slice('/api/files/'.length));
  }
  const absolute = url.startsWith('http')
    ? url
    : `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}${url}`;
  const response = await fetch(absolute);
  if (!response.ok) {
    throw new Error(`Fichier introuvable (${response.status}) : ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
