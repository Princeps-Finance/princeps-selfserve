/**
 * The Princeps self-service API, version 2 (`/api/v2`, see BACKEND-REQUESTS.md). This file reads its open reference
 * lists. Nothing about a customer is sent, so these calls need no resume token.
 *
 * `SELF_SERVICE_API_URL` is the host (for example https://self-service-apply.princeps.cloud). A trailing slash, or a
 * trailing `/api/v2`, is tolerated.
 */
export function v2Base(): string | null {
  const raw = process.env['SELF_SERVICE_API_URL']?.trim().replace(/\/+$/, '').replace(/\/api\/v2$/, '');
  return raw ? raw : null;
}

/** v2 wraps every reply as `{ statusCode, code, message, data, status, timestamp }`. */
interface Envelope {
  status?: unknown;
  data?: unknown;
}

/** GET a v2 path and return its `data`, or null when the service is down, answers an error or sends something unexpected. */
export async function v2Get(path: string, timeoutMs = 5_000): Promise<unknown | null> {
  const base = v2Base();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/v2${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as Envelope | null;
    return body && body.status === 'success' && body.data !== undefined ? body.data : null;
  } catch {
    return null;
  }
}

const text = (v: unknown, max = 120): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export function toBanks(data: unknown): { code: string; name: string }[] {
  if (!Array.isArray(data)) return [];
  const out: { code: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const row of data) {
    const code = text((row as { code?: unknown })?.code, 12);
    const name = text((row as { name?: unknown })?.name);
    if (code && name && !seen.has(code)) {
      seen.add(code);
      out.push({ code, name });
    }
  }
  return out;
}

/** v2 types to ours: `federal` and `state` are both our `government` (open when either is), `nysc` is our `nysc-corper`. */
const TYPE_CODES: Record<string, string> = { federal: 'government', state: 'government', paramilitary: 'paramilitary', nysc: 'nysc-corper', 'private-sector': 'private-sector', 'own-business': 'own-business' };

export function toEmploymentTypes(data: unknown): { code: string; isAvailable: boolean }[] {
  if (!Array.isArray(data)) return [];
  const open = new Map<string, boolean>();
  for (const row of data) {
    const code = text((row as { code?: unknown })?.code, 40);
    const mapped = code && Object.hasOwn(TYPE_CODES, code) ? TYPE_CODES[code] : null;
    if (!mapped) continue;
    open.set(mapped, (open.get(mapped) ?? false) || (row as { status?: unknown }).status === 'AVAILABLE');
  }
  return [...open].map(([code, isAvailable]) => ({ code, isAvailable }));
}

/** The state governments v2 lets a customer pick, as `{ code, name, channel, employers }` for the app's state screen. */
export function toStateGovernments(data: unknown): { code: string; name: string; channel: 'remita'; employers: never[] }[] {
  if (!Array.isArray(data)) return [];
  const out: { code: string; name: string; channel: 'remita'; employers: never[] }[] = [];
  const seen = new Set<string>();
  for (const row of data) {
    // The MDA code is what `PUT /employment` needs, and the state name is what the customer reads.
    const code = text((row as { code?: unknown })?.code, 80);
    const name = text((row as { state?: unknown })?.state, 60);
    if (code && name && !seen.has(code)) {
      seen.add(code);
      // v2 does not say how an MDA is paid (the server decides), so the app gets the usual state channel.
      out.push({ code, name, channel: 'remita', employers: [] });
    }
  }
  return out;
}

export function toLgas(data: unknown): string[] {
  return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim().slice(0, 80)) : [];
}
