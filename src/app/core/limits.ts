/** Limits shared by the browser and its API client, named once instead of repeated as bare numbers. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 15_000;
/** How long an eligibility result stays valid. After this the customer is asked to check again. */
export const ELIGIBILITY_TTL_MS = 60 * 60 * 1000;
