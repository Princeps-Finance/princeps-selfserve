import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const names = ['NG_APP_ENVIRONMENT', 'NG_APP_API_BASE_URL', 'NG_APP_ACCOUNTS_URL'];
const settings = Object.fromEntries(names.map((name) => [name, process.env[name] ?? '']));
if (!['development', 'staging', 'production'].includes(settings.NG_APP_ENVIRONMENT))
  throw new Error('NG_APP_ENVIRONMENT is required');
const url = new URL(settings.NG_APP_API_BASE_URL);
if (
  url.protocol !== 'https:' ||
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  url.pathname !== '/'
)
  throw new Error('The API base URL must be an HTTPS origin');
if (
  settings.NG_APP_ENVIRONMENT === 'production' &&
  url.hostname === 'self-service-apply.princeps.cloud'
)
  throw new Error('Production cannot target the development API');
if (settings.NG_APP_ACCOUNTS_URL && new URL(settings.NG_APP_ACCOUNTS_URL).protocol !== 'https:')
  throw new Error('Accounts URL must use HTTPS');
const directory = resolve(process.argv[2] ?? 'dist/princeps-selfserve/browser');
const headers = resolve(directory, '_headers');
const content = await readFile(headers, 'utf8');
if (!content.includes('https://*.amazonaws.com'))
  throw new Error('Missing upload origin in hosting policy');
await writeFile(
  headers,
  content.replace(
    /connect-src 'self'[^;]*/,
    "connect-src 'self' " + url.origin + ' https://*.amazonaws.com',
  ),
);
if (process.argv[3]) {
  const amplifyHeaders = resolve(process.argv[3]);
  const yaml = await readFile(amplifyHeaders, 'utf8');
  await writeFile(
    amplifyHeaders,
    yaml.replace(
      /connect-src 'self'[^;]*/,
      "connect-src 'self' " + url.origin + ' https://*.amazonaws.com',
    ),
  );
}
await writeFile(
  resolve(directory, 'ngx-env.js'),
  `globalThis._NGX_ENV_ = ${JSON.stringify(settings)};\n`,
);
console.log('Runtime configuration and hosting policy written. Compiled assets unchanged.');
