import { NextResponse } from 'next/server';
import { fetchStored, putFile } from '@/lib/blob';
import { buildPrintPdf } from '@/lib/print-pdf';
import { getOrder, setRenderUrls } from '@/lib/orders';
import { renderJersey } from '@/lib/render';
import { isAuthorizedRequest } from '@/lib/auth';
import { orderReference } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Génère le PDF imprimeur d'une commande.
 *
 * Réservé à l'admin : le PDF 300 dpi est le livrable de production, pas un
 * document client. Le visuel est régénéré depuis `design_json` plutôt que
 * stocké au moment de la commande — la commande reste la source de vérité, et
 * une correction du pipeline profite aux commandes déjà passées.
 */
export async function POST(request: Request) {
  if (!(await isAuthorizedRequest(request))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let orderId: string;
  try {
    const body = (await request.json()) as { orderId?: unknown };
    if (typeof body.orderId !== 'string') throw new Error();
    orderId = body.orderId;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const order = await getOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
  }

  try {
    const photos = await Promise.all(order.design_json.photos.map(fetchStored));

    const render = await renderJersey({
      photos,
      jerseyNumber: order.jersey_number,
      jerseyName: order.jersey_name,
      kitSlug: order.kit_slug,
      tier: order.kit_tier,
      side: 'back',
    });

    const pdf = await buildPrintPdf({
      artworkPng: render.artworkPng,
      zone: render.zone,
      mockup: render.previewWebP,
      reference: orderReference(order.id),
    });

    const stored = await putFile(`print/${order.id}.pdf`, pdf, 'application/pdf');
    await setRenderUrls(order.id, { pdf: stored.url });

    return NextResponse.json({ pdfUrl: stored.url, bytes: pdf.length });
  } catch (error) {
    console.error('[render/pdf] échec', error);
    return NextResponse.json({ error: 'RENDER_FAILED' }, { status: 500 });
  }
}
