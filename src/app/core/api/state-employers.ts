import type { SalaryChannel } from '../application/application-state.service';

/** An employer inside a state that is paid on its own channel, such as Adamawa's SUBEB or PHCDA. */
export interface StateEmployer {
  code: string;
  name: string;
  channel: SalaryChannel;
}

/** One state the lender serves for state government staff. When `employers` is set the customer picks one of them next. */
export interface StateGovernment {
  code: string;
  name: string;
  /** How staff in this state are paid. A listed employer can override it. */
  channel: SalaryChannel;
  employers: StateEmployer[];
}

/**
 * What the app shows until the back end answers `GET /api/state-employers`, or if it never does.
 * The live list replaces this one, so a state or employer is added or removed without a release.
 */
export const DEFAULT_STATE_GOVERNMENTS: readonly StateGovernment[] = [
  { code: 'adamawa', name: 'Adamawa', channel: 'remita', employers: [
    { code: 'adamawa-subeb', name: 'Adamawa SUBEB', channel: 'remita' },
    { code: 'adamawa-lga', name: 'Adamawa LGA', channel: 'remita' },
    { code: 'adamawa-phcda', name: 'Adamawa PHCDA', channel: 'dedukt' },
  ] },
  { code: 'cross-river', name: 'Cross River', channel: 'remita', employers: [] },
  { code: 'delta', name: 'Delta', channel: 'remita', employers: [] },
  { code: 'gombe', name: 'Gombe', channel: 'remita', employers: [] },
  { code: 'katsina', name: 'Katsina', channel: 'remita', employers: [] },
  { code: 'ondo', name: 'Ondo', channel: 'remita', employers: [] },
  { code: 'plateau', name: 'Plateau', channel: 'remita', employers: [] },
];

const CHANNELS: ReadonlySet<string> = new Set(['remita', 'ippis', 'dedukt']);

function channelOf(v: unknown, fallback: SalaryChannel): SalaryChannel {
  return typeof v === 'string' && CHANNELS.has(v) ? (v as SalaryChannel) : fallback;
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : null;
}

/** Turns whatever the back end sent into a safe list: known shapes only, no repeats. Null when nothing usable arrived. */
export function sanitizeStateGovernments(raw: unknown): StateGovernment[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: StateGovernment[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const code = text(r['code']);
    const name = text(r['name']);
    if (!code || !name || seen.has(code)) continue;
    seen.add(code);
    const channel = channelOf(r['channel'], 'remita');
    const employers: StateEmployer[] = [];
    const seenEmployers = new Set<string>();
    for (const e of Array.isArray(r['employers']) ? (r['employers'] as unknown[]) : []) {
      if (!e || typeof e !== 'object') continue;
      const er = e as Record<string, unknown>;
      const ec = text(er['code']);
      const en = text(er['name']);
      if (!ec || !en || seenEmployers.has(ec)) continue;
      seenEmployers.add(ec);
      employers.push({ code: ec, name: en, channel: channelOf(er['channel'], channel) });
    }
    out.push({ code, name, channel, employers });
  }
  return out.length ? out : null;
}
