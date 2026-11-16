interface ImportMetaEnv {
  readonly NG_APP_ENVIRONMENT: string;
  readonly NG_APP_API_BASE_URL: string;
  readonly NG_APP_ACCOUNTS_URL?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
