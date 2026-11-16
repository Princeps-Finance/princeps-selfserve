/** Princeps support contacts, shared by every screen that offers a way to reach a person. */
export const SUPPORT_PHONE = '+2347001235372';
export const SUPPORT_WHATSAPP = '2347074609040';
export const SUPPORT_EMAIL = 'info@princepsfinance.com';

/** WhatsApp deep link with an optional prefilled message. */
export function whatsappLink(message = 'Hello Princeps, I need help with my loan application.'): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export function telLink(): string {
  return `tel:${SUPPORT_PHONE}`;
}

/** Money lender licence number, shown in the page footer. Empty until the business provides it: nothing is shown then. */
export const LICENCE_NUMBER = '';
