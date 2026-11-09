/** Princeps support contacts, shared by every screen that offers a way to reach a person. */
export const SUPPORT_PHONE = '+2348001234567';
export const SUPPORT_WHATSAPP = '2348001234567';
export const SUPPORT_EMAIL = 'support@princeps.ng';

/** WhatsApp deep link with an optional prefilled message. */
export function whatsappLink(message = 'Hello Princeps, I need help with my loan application.'): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export function telLink(): string {
  return `tel:${SUPPORT_PHONE}`;
}
