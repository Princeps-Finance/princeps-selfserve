import type { EmploymentType } from '../application/application-state.service';

/** One row of the live `GET /api/employment-types`, cut down to what the app uses. */
export interface EmploymentAvailability {
  code: string;
  isAvailable: boolean;
}

/** The live API's codes, mapped to ours. */
const CODES: Readonly<Record<string, EmploymentType>> = {
  government: 'government',
  paramilitary: 'paramilitary',
  'nysc-corper': 'corper',
  'private-sector': 'private-sector',
  'own-business': 'own-business',
};

/**
 * Which of our employment types the live API says can be served right now.
 * A type the API does not mention is left out, so the app keeps its own default for it.
 */
export function availabilityByType(rows: readonly EmploymentAvailability[]): Partial<Record<EmploymentType, boolean>> {
  const out: Partial<Record<EmploymentType, boolean>> = {};
  for (const row of rows) {
    const type = Object.hasOwn(CODES, row.code) ? CODES[row.code] : undefined;
    if (type) out[type] = row.isAvailable;
  }
  return out;
}
