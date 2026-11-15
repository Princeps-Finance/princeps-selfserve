/** A place the customer chose to share from their phone's location. Never saved on the device; sent once with the application. */
export interface LocationFix {
  latitude: number;
  longitude: number;
  /** How close the phone says the point is, in metres. A large number means a rough place (a mast, not a GPS fix). */
  accuracyM: number;
  /** When the phone gave it, as an ISO time. */
  capturedAt: string;
}

/** Returns a safe fix from untrusted numbers, or null when any part is not believable. About a metre of detail is kept. */
export function toLocationFix(latitude: unknown, longitude: unknown, accuracyM: unknown, capturedAt = new Date()): LocationFix | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const accuracy = typeof accuracyM === 'number' && Number.isFinite(accuracyM) && accuracyM >= 0 ? Math.round(accuracyM) : 0;
  const round = (n: number): number => Math.round(n * 100_000) / 100_000;
  return { latitude: round(latitude), longitude: round(longitude), accuracyM: Math.min(accuracy, 100_000), capturedAt: capturedAt.toISOString() };
}
