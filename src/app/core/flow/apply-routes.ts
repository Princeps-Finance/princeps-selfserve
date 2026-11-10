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
  welcomeBack: '/apply/welcome-back',
  profile: '/apply/profile',
  employment: '/apply/employment',
  waitlist: '/apply/waitlist',
  statement: '/apply/statement',
  salary: '/apply/salary',
  eligibility: '/apply/eligibility',
  offers: '/apply/offers',
  terms: '/apply/terms',
  nin: '/apply/nin',
  documents: '/apply/documents',
  verifyIdentity: '/apply/verify-identity',
  mandate: '/apply/mandate',
  submit: '/apply/submit',
  status: '/apply/status',
} as const;

export type ApplyRoute = (typeof APPLY)[keyof typeof APPLY];
