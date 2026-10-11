// AWS Lambda port of worker/src/index.ts (the Cloudflare Worker) for the AWS edition
// of AgniGuard (see aws/README.md). Same routes, same error semantics: a failed scan is
// an error, never "no fires detected".
//
// The two entry points are deliberately line-for-line parallel. If you change
// behaviour here, change worker/src/index.ts too, until they share one module.

import { decodeLandCoverGrid, decodeStateGrid, REGIONS, runRadar, type Geo, type Region } from '@agniguard/logic';

import { hasValidSession, issueSession, verifyTurnstile } from '../../worker/src/turnstile.ts';

/** API Gateway HTTP API (payload format 2.0) event — only the parts this handler reads. */
export interface HttpApiEvent {
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  /** Payload 2.0 splits Cookie out of headers into this array of "name=value" strings. */
  cookies?: string[];
  body?: string;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string; sourceIp?: string } };
}

/** Payload 2.0 result. `cookies` becomes real Set-Cookie headers at API Gateway. */
export interface HttpApiResult {
  statusCode: number;
  headers: Record<string, string>;
  cookies?: string[];
  body: string;
}

interface LambdaEnv {
  /** NASA FIRMS MAP_KEY, a SAM parameter, never in the repo or the client bundle. */
  FIRMS_MAP_KEY?: string;
  /** Turnstile secret; also signs the session cookie (worker/src/turnstile.ts). */
  TURNSTILE_SECRET?: string;
  /** Site bucket holding the prebuilt grids boundaries/states.bin and landcover/india.bin. */
  GRIDS_BUCKET?: string;
}

// Per-IP fixed-window limiter, the Lambda stand-in for the Worker's RADAR_LIMITER
// binding (wrangler.jsonc: 20/min per IP, checked before any FIRMS or wind work).
// In-memory means per warm container, so it is approximate across concurrent
// containers; firm protection would be AWS WAF on the CloudFront distribution.
const WINDOW_SECONDS = 60;
const LIMIT_PER_WINDOW = 20;
const windows = new Map<string, { start: number; count: number }>();

export function rateLimitOk(key: string, nowSec: number): boolean {
  const slot = Math.floor(nowSec / WINDOW_SECONDS);
  const entry = windows.get(key);
  if (!entry || entry.start !== slot) {
    windows.set(key, { start: slot, count: 1 });
  } else if (entry.count >= LIMIT_PER_WINDOW) {
    return false;
  } else {
    entry.count += 1;
  }
  // Bound the map: one entry per IP per minute is tiny, but a spoofed-IP flood is not.
  if (windows.size > 10_000) windows.clear();
  return true;
}

// The two prebuilt grids answer "which state" and "which land cover" for any point in
// India (logic/src/geo.ts). They live in the site bucket next to the static frontend,
// synced by aws/sync-site.ps1. Fetched once per warm container, like the Worker caches
// them per isolate; a failed load is not cached, so the next request retries.
let geo: Promise<Geo> | null = null;

async function gridBytes(bucket: string, key: string): Promise<ArrayBuffer> {
  // Imported lazily so the module loads (and unit tests run) without the SDK installed.
  // The SDK ships in the Lambda nodejs runtime and is esbuild-external at build time.
  const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
  const out = await new S3Client({}).send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await out.Body!.transformToByteArray();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function loadGeo(bucket: string): Promise<Geo> {
  if (!geo) {
    geo = Promise.all([gridBytes(bucket, 'boundaries/states.bin'), gridBytes(bucket, 'landcover/india.bin')]).then(
      ([states, land]) => ({
        stateAt: decodeStateGrid(states),
        landCoverAt: decodeLandCoverGrid(land),
      }),
    );
    geo.catch(() => (geo = null));
  }
  return geo;
}

const NO_STORE = { 'cache-control': 'no-store' } as const;

function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

/** 429s never say "no fires" — they say why nothing was checked, same as the missing-key 500 does. */
function rateLimited(): Response {
  return Response.json(
    { error: 'Too many requests, try again in a minute. This is not an all-clear.' },
    { status: 429, headers: { ...NO_STORE, 'retry-after': '60' } },
  );
}

function isRegion(value: string | null): value is Region {
  return (REGIONS as readonly (string | null)[]).includes(value);
}

/** Rebuild a fetch Request from the event, joining payload 2.0's split cookies back
 *  into one Cookie header so worker/src/turnstile.ts can read them unchanged. */
export function eventToRequest(event: HttpApiEvent): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) headers.append(name, value);
  }
  const cookie = (event.cookies ?? []).join('; ');
  if (cookie) headers.set('cookie', cookie);

  const query = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const method = event.requestContext?.http?.method ?? 'GET';
  const body =
    event.body === undefined || method === 'GET' || method === 'HEAD'
      ? undefined
      : event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : event.body;
  // The origin is a placeholder: only the path, query, headers and body are read.
  return new Request(`https://lambda.internal${event.rawPath ?? '/'}${query}`, { method, headers, body });
}

/** Convert the fetch Response into the payload 2.0 result shape. */
export async function toResult(res: Response): Promise<HttpApiResult> {
  const headers: Record<string, string> = {};
  res.headers.forEach((value, name) => {
    if (name !== 'set-cookie') headers[name] = value;
  });
  const getSetCookie = (res.headers as { getSetCookie?: () => string[] }).getSetCookie;
  const cookies = getSetCookie ? getSetCookie.call(res.headers) : [];
  const single = res.headers.get('set-cookie');
  return {
    statusCode: res.status,
    headers,
    ...(cookies.length ? { cookies } : single ? { cookies: [single] } : {}),
    body: await res.text(),
  };
}

const nowSec = () => Math.floor(Date.now() / 1000);

/** POST /api/verify {token}: spend a Turnstile token, answer with a session cookie. */
async function verify(request: Request, env: LambdaEnv, clientIp: string): Promise<Response> {
  if (request.method !== 'POST') return error(405, 'use POST');
  if (!rateLimitOk(clientIp, nowSec())) return rateLimited();
  if (!env.TURNSTILE_SECRET) return error(500, 'Human verification is not configured.');

  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  if (typeof body?.token !== 'string' || !body.token) return error(400, 'missing Turnstile token');

  let passed: boolean;
  try {
    passed = await verifyTurnstile(body.token, env.TURNSTILE_SECRET, clientIp);
  } catch (err) {
    return error(502, err instanceof Error ? err.message : 'Turnstile siteverify unreachable');
  }
  if (!passed) return error(403, 'Human verification failed, please try again.');

  return new Response(null, {
    status: 204,
    headers: { 'set-cookie': await issueSession(env.TURNSTILE_SECRET, nowSec()), 'cache-control': 'no-store' },
  });
}

export async function handle(event: HttpApiEvent): Promise<HttpApiResult> {
  const env = process.env as LambdaEnv;
  const request = eventToRequest(event);
  const url = new URL(request.url);
  // API Gateway's source IP replaces Cloudflare's cf-connecting-ip header.
  const clientIp = event.requestContext?.http?.sourceIp ?? 'anon';

  if (url.pathname === '/api/verify') return toResult(await verify(request, env, clientIp));
  if (url.pathname !== '/api/radar') return toResult(error(404, 'not found'));
  if (request.method !== 'GET') return toResult(error(405, 'use GET'));

  const region = url.searchParams.get('region');
  if (!isRegion(region)) return toResult(error(400, `region must be one of: ${REGIONS.join(', ')}`));

  // Before any FIRMS or wind work: one shared MAP_KEY and one region loop's worth of
  // Open-Meteo calls per request, so a script hammering this endpoint must not
  // exhaust either (FIRMS allows 5,000 transactions per 10 minutes).
  if (!rateLimitOk(clientIp, nowSec())) return toResult(rateLimited());

  // Human check before any FIRMS or wind work. A missing secret refuses rather than
  // letting everything through: a misconfigured deploy must not silently drop the check.
  if (!env.TURNSTILE_SECRET) {
    return toResult(error(500, 'Human verification not configured, so no fire data was fetched. This is not an all-clear.'));
  }
  if (!(await hasValidSession(request, env.TURNSTILE_SECRET, nowSec()))) {
    return toResult(
      Response.json(
        { error: 'Verify you are human to load fire data. This is not an all-clear.', verify: true },
        { status: 403, headers: NO_STORE },
      ),
    );
  }

  // No key means nothing was checked. That is an error, never an all-clear.
  if (!env.FIRMS_MAP_KEY) {
    return toResult(error(500, 'FIRMS key not configured, so no fire data was fetched. This is not an all-clear.'));
  }
  if (!env.GRIDS_BUCKET) {
    return toResult(error(500, 'Grids bucket not configured, so no fire data was fetched. This is not an all-clear.'));
  }

  let grids: Geo;
  try {
    grids = await loadGeo(env.GRIDS_BUCKET);
  } catch (err) {
    // Without the grids no fire can be placed in a state or classified; fail loudly.
    return toResult(error(500, err instanceof Error ? err.message : 'state and land-cover grids unavailable'));
  }

  try {
    const result = await runRadar(region, env.FIRMS_MAP_KEY, grids);
    return toResult(Response.json(result, { headers: NO_STORE }));
  } catch (err) {
    // fetchHotspots never puts its URL (which carries the key) in an error message.
    return toResult(error(502, err instanceof Error ? err.message : 'FIRMS fetch failed'));
  }
}

export const handler = handle;
