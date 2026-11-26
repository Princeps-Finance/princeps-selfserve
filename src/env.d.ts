interface ImportMetaEnv {
  readonly NG_APP_API_BASE_URL?: string;
  readonly NG_APP_ACCOUNTS_URL?: string;
  /** "true" turns on the federal IPPIS / Remita choice on the salary screen. Off everywhere else. */
  readonly NG_APP_FEATURE_REMITA?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
