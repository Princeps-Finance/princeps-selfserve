/**
 * True on a phone with little memory (2 GB or less, or two cores or fewer). The browser only tells us this in rough
 * steps, and not at all on iPhone, where this stays false. Used to keep the camera work small enough not to crash the page.
 */
export function isLowMemoryDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const device = navigator as Navigator & { deviceMemory?: number };
  return (
    (typeof device.deviceMemory === 'number' && device.deviceMemory <= 2) ||
    (typeof device.hardwareConcurrency === 'number' && device.hardwareConcurrency <= 2)
  );
}
