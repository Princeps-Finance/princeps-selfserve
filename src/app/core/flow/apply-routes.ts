/**
 * Every URL in the apply flow, in one place. Components and guards refer to these names, never to string
 * literals, so a route can be renamed or reordered here without hunting through the steps.
 */
export const APPLY = {
  home: '/',
  root: '/apply',
  welcome: '/apply/welcome',
  bvn: '/apply/bvn',
  verify: '/apply/verify',
  resume: '/apply/resume',
  saved: '/apply/saved',
  loans: '/apply/loans',
  profile: '/apply/profile',
  employment: '/apply/employment',
  waitlist: '/apply/waitlist',
  statement: '/apply/statement',
  salary: '/apply/salary',
  eligibility: '/apply/eligibility',
  checkResult: '/apply/check-result',
  offers: '/apply/offers',
  terms: '/apply/terms',
  nin: '/apply/nin',
  documents: '/apply/documents',
  offerLetter: '/apply/offer-letter',
  verifyIdentity: '/apply/verify-identity',
  mandate: '/apply/mandate',
  submit: '/apply/submit',
  status: '/apply/status',
} as const;

/** The detail screen for one existing loan. */
export const loanRoute = (id: string): string => `${APPLY.loans}/${encodeURIComponent(id)}`;

export type ApplyRoute = (typeof APPLY)[keyof typeof APPLY];
