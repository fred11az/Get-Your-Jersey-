import { NextResponse } from 'next/server';
import { isBlobConfigured, readLocalFile } from '@/lib/blob';

export const runtime = 'nodejs';

const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};

/**
 * Sert les fichiers du repli disque, utilisé en développement quand Vercel Blob
 * n'est pas configuré. Quand Blob est actif, les URLs pointent directement chez
 * lui et cette route n'est jamais appelée : on refuse alors, pour ne pas laisser
 * traîner un second chemin d'accès aux fichiers en production.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (isBlobConfigured()) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const { path: segments } = await params;
  const relative = segments.join('/');

  try {
    const file = await readLocalFile(relative);
    const extension = relative.split('.').pop()?.toLowerCase() ?? '';

    return new NextResponse(new Uint8Array(file), {
      headers: {
        'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
        'cache-control': 'private, max-age=300',
      },
    });
  } catch {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
}
