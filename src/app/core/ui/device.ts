/**
 * True on a phone with little memory (2 GB or less, or two cores or fewer). The browser only tells us this in rough
 * steps, and not at all on iPhone, where this stays false. Used to keep the camera work small enough not to crash the page.
 */
export function isLowMemoryDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const n = navigator as Navigator & { deviceMemory?: number };
  return (typeof n.deviceMemory === 'number' && n.deviceMemory <= 2) || (typeof n.hardwareConcurrency === 'number' && n.hardwareConcurrency <= 2);
}
