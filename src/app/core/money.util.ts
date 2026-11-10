const NAIRA = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

export function formatNaira(amount: number): string {
  return NAIRA.format(amount);
}

/**
 * An amount for reading aloud, exact to the kobo: "57,500 naira and 50 kobo". The words naira and kobo are the same
 * in every language the app speaks, so this needs no translation.
 */
export function spokenNaira(amount: number): string {
  const totalKobo = Math.round(amount * 100);
  const naira = Math.floor(totalKobo / 100);
  const kobo = totalKobo % 100;
  return `${naira.toLocaleString('en-NG')} naira and ${kobo} kobo`;
}
