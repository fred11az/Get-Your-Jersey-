import { NextResponse } from 'next/server';
import { isAuthorizedRequest } from '@/lib/auth';
import { getOrder } from '@/lib/orders';
import { orderReference } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * Export du design d'une commande, en JSON (section 4 de docs/SPEC.md).
 *
 * Admin uniquement : le design contient les URLs des photos du client et ses
 * données de livraison ne doivent pas fuiter via une URL devinable à partir
 * d'un UUID.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedRequest(request))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { id } = await params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
  }

  const reference = orderReference(order.id);
  const payload = {
    reference,
    createdAt: order.created_at,
    status: order.status,
    customer: {
      firstName: order.first_name,
      lastName: order.last_name,
      email: order.email,
      phone: order.phone,
      address: order.address,
      postalCode: order.postal_code,
      city: order.city,
      country: order.country,
    },
    product: {
      kit: order.kit_slug,
      tier: order.kit_tier,
      size: order.size,
      jerseyName: order.jersey_name,
      jerseyNumber: order.jersey_number,
      amount: order.amount,
      currency: order.currency,
    },
    design: order.design_json,
    renders: {
      preview: order.render_preview_url,
      printPdf: order.render_pdf_url,
    },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${reference}.json"`,
    },
  });
}
