import { NextResponse } from 'next/server';
import { isAuthorizedRequest } from '@/lib/auth';
import { deleteOrder, getOrder, markWhatsappSent, updateOrderStatus } from '@/lib/orders';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/types';

export const runtime = 'nodejs';

/** Changement de statut d'une commande — admin uniquement. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthorizedRequest(request))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { id } = await params;

  let status: string;
  let whatsappSent = false;
  try {
    const body = (await request.json()) as { status?: unknown; whatsappSent?: unknown };
    if (typeof body.status !== 'string') throw new Error();
    status = body.status;
    whatsappSent = body.whatsappSent === true;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  if (!(ORDER_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: 'UNKNOWN_STATUS' }, { status: 400 });
  }

  const updated = await updateOrderStatus(id, status as OrderStatus);
  if (!updated) {
    return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
  }
  if (whatsappSent) await markWhatsappSent(id);

  return NextResponse.json({ order: updated });
}

/** Suppression d'une commande — admin uniquement. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthorizedRequest(request))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { id } = await params;
  if (!(await getOrder(id))) {
    return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
  }

  await deleteOrder(id);
  return NextResponse.json({ deleted: id });
}
