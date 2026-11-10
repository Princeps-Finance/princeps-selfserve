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

/** Zoho support flow opened by the floating Support button. Empty until the link is provided: the contact sheet opens instead. */
export const SUPPORT_ZOHO_URL = '';

/** Money lender licence number, shown in the page footer. Empty until the business provides it: nothing is shown then. */
export const LICENCE_NUMBER = '';
