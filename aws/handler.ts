// AWS Lambda entry for the API (production). API Gateway HTTP API (payload format 2.0) calls this; it turns the event
// into a standard Request, runs the shared router and turns the Response back. See aws/template.yaml.
import { route } from '../api/router';

export interface ApiEvent {
  rawPath: string;
  rawQueryString?: string;
  headers: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext: { http: { method: string } };
}

export interface ApiResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function toRequest(event: ApiEvent): Request {
  const method = event.requestContext.http.method;
  const host = event.headers['host'] ?? 'localhost';
  const url = `https://${host}${event.rawPath}${event.rawQueryString ? `?${event.rawQueryString}` : ''}`;
  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers)) if (value !== undefined) headers.set(name, value);
  const hasBody = method !== 'GET' && method !== 'HEAD' && event.body !== undefined;
  const body = hasBody ? (event.isBase64Encoded ? Buffer.from(event.body!, 'base64') : event.body) : undefined;
  return new Request(url, { method, headers, body });
}

export async function handler(event: ApiEvent): Promise<ApiResult> {
  const res = await route(toRequest(event));
  const headers: Record<string, string> = {};
  res.headers.forEach((value, name) => (headers[name] = value));
  return { statusCode: res.status, headers, body: await res.text() };
}
