/**
 * Production build: the mock client is never used. Identity, OTP, salary and
 * submission all go through the /api functions to the backoffice.
 */
export const environment = {
  production: true,
  useMockApi: false,
};
