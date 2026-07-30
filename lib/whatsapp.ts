import { orderReference, type Order } from './types';

/** Ne garde que les chiffres : wa.me n'accepte ni `+` ni espaces. */
export function normalizeWhatsappNumber(raw: string): string {
  return raw.replace(/\D/g, '');
}

export interface WhatsappContext {
  reference: string;
  kit: string;
  tier: string;
  size: string;
  jerseyName: string;
  jerseyNumber: string;
  amount: string;
  previewUrl: string;
}

/**
 * Remplace les jetons `{clé}` du template configuré en admin. Un jeton inconnu
 * est laissé tel quel plutôt que remplacé par « undefined » : l'admin voit
 * immédiatement sa faute de frappe.
 */
export function fillTemplate(template: string, context: WhatsappContext): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = (context as unknown as Record<string, string>)[key];
    return value ?? match;
  });
}

export function buildWhatsappLink(
  whatsappNumber: string,
  template: string,
  context: WhatsappContext,
): string {
  const number = normalizeWhatsappNumber(whatsappNumber);
  const text = fillTemplate(template, context);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function whatsappContextFromOrder(
  order: Order,
  kitName: string,
  siteUrl: string,
): WhatsappContext {
  return {
    reference: orderReference(order.id),
    kit: kitName,
    tier: order.kit_tier,
    size: order.size,
    jerseyName: order.jersey_name,
    jerseyNumber: order.jersey_number,
    amount: `${order.amount} ${order.currency}`,
    previewUrl: order.render_preview_url ?? `${siteUrl}/api/orders/${order.id}/export`,
  };
}

export const DEFAULT_WHATSAPP_TEMPLATE =
  "Bonjour, je veux cette commande {reference} :\n" +
  '• Kit : {kit} ({tier})\n' +
  '• Taille : {size}\n' +
  '• Flocage : {jerseyName} #{jerseyNumber}\n' +
  '• Montant : {amount}\n' +
  'Aperçu : {previewUrl}';
