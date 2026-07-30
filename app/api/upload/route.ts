import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { putFile } from '@/lib/blob';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_PHOTOS = 3;
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Réception des photos clientes.
 *
 * Chaque photo est re-encodée par Sharp avant stockage : cela normalise
 * l'orientation EXIF, borne la résolution, et supprime les métadonnées (donc la
 * géolocalisation, qu'un client n'a aucune raison de nous transmettre). Le
 * re-encodage garantit aussi que le fichier stocké est bien une image, et non un
 * fichier arbitraire portant un type MIME trompeur.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'INVALID_FORM' }, { status: 400 });
  }

  const files = form.getAll('photos').filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: 'NO_PHOTO' }, { status: 400 });
  }
  if (files.length > MAX_PHOTOS) {
    return NextResponse.json({ error: 'TOO_MANY_PHOTOS' }, { status: 400 });
  }

  const batch = crypto.randomUUID();
  const urls: string[] = [];

  for (const [index, file] of files.entries()) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'PHOTO_TOO_LARGE' }, { status: 413 });
    }
    if (!ACCEPTED.has(file.type)) {
      return NextResponse.json({ error: 'UNSUPPORTED_TYPE' }, { status: 415 });
    }

    try {
      const normalized = await sharp(Buffer.from(await file.arrayBuffer()))
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();

      const stored = await putFile(
        `photos/${batch}/${index}.jpg`,
        normalized,
        'image/jpeg',
      );
      urls.push(stored.url);
    } catch (error) {
      // Deux causes distinctes, à ne pas confondre : une image corrompue (faute
      // du client) et un stockage indisponible (faute de configuration).
      const message = error instanceof Error ? error.message : String(error);
      const storageFailure = /EROFS|EACCES|ENOSPC|BLOB|token/i.test(message);
      console.error('[upload]', storageFailure ? 'stockage indisponible' : 'photo illisible', error);
      return NextResponse.json(
        {
          error: storageFailure ? 'STORAGE_UNAVAILABLE' : 'UNREADABLE_IMAGE',
          detail: storageFailure ? message : undefined,
        },
        { status: storageFailure ? 503 : 422 },
      );
    }
  }

  return NextResponse.json({ urls });
}
