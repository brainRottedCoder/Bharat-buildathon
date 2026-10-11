// Unit tests for the Lambda port (aws/lambda/index.ts). Run: node --test aws/lambda/
// No grids, network or AWS SDK needed: the tested paths all stop before loadGeo.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { eventToRequest, handle, rateLimitOk, toResult } from './index.ts';

function radarEvent(overrides: Record<string, unknown> = {}) {
  return {
    rawPath: '/api/radar',
    rawQueryString: 'region=north',
    headers: {},
    requestContext: { http: { method: 'GET', sourceIp: '203.0.113.7' } },
    ...overrides,
  };
}

describe('eventToRequest', () => {
  it('joins payload 2.0 cookies back into one Cookie header', () => {
    const req = eventToRequest(radarEvent({ cookies: ['agniguard_session=1.abc', 'other=x'] }));
    assert.equal(req.headers.get('cookie'), 'agniguard_session=1.abc; other=x');
  });

  it('carries the path and query string', () => {
    const req = eventToRequest(radarEvent());
    const url = new URL(req.url);
    assert.equal(url.pathname, '/api/radar');
    assert.equal(url.searchParams.get('region'), 'north');
  });
});

describe('rateLimitOk', () => {
  it('allows 20 requests per window and refuses the 21st', () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < 20; i++) assert.equal(rateLimitOk(key, 1_000), true);
    assert.equal(rateLimitOk(key, 1_000), false);
  });

  it('resets in the next window and tracks IPs independently', () => {
    const key = `test2-${Date.now()}`;
    for (let i = 0; i < 20; i++) rateLimitOk(key, 2_000);
    assert.equal(rateLimitOk(key, 2_000 + 60), true, 'next window');
    assert.equal(rateLimitOk(`${key}-b`, 2_000), true, 'different IP');
  });
});

describe('toResult', () => {
  it('moves Set-Cookie into the payload 2.0 cookies array', async () => {
    const res = new Response(null, {
      status: 204,
      headers: { 'set-cookie': 'agniguard_session=1.abc; Path=/api; HttpOnly', 'cache-control': 'no-store' },
    });
    const out = await toResult(res);
    assert.equal(out.statusCode, 204);
    assert.deepEqual(out.cookies, ['agniguard_session=1.abc; Path=/api; HttpOnly']);
    assert.equal(out.headers['set-cookie'], undefined);
    assert.equal(out.headers['cache-control'], 'no-store');
  });
});

describe('handle', () => {
  it('rejects a bad region before touching secrets, grids or networks', async () => {
    const out = await handle(radarEvent({ rawQueryString: 'region=antarctica' }));
    assert.equal(out.statusCode, 400);
    assert.match(out.body, /region must be one of/);
  });

  it('answers 403 verify:true without a session, and never calls it an all-clear', async () => {
    process.env.TURNSTILE_SECRET = 'test-secret';
    process.env.FIRMS_MAP_KEY = 'test-key';
    process.env.GRIDS_BUCKET = 'test-bucket';
    try {
      const out = await handle(radarEvent());
      assert.equal(out.statusCode, 403);
      const body = JSON.parse(out.body);
      assert.equal(body.verify, true);
      assert.match(body.error, /not an all-clear/);
    } finally {
      delete process.env.TURNSTILE_SECRET;
      delete process.env.FIRMS_MAP_KEY;
      delete process.env.GRIDS_BUCKET;
    }
  });

  it('refuses every scan when TURNSTILE_SECRET is missing, as an error', async () => {
    delete process.env.TURNSTILE_SECRET;
    const out = await handle(radarEvent({ requestContext: { http: { method: 'GET', sourceIp: '198.51.100.9' } } }));
    assert.equal(out.statusCode, 500);
    assert.match(out.body, /not an all-clear/);
  });

  it('404s unknown paths', async () => {
    const out = await handle(radarEvent({ rawPath: '/api/nope' }));
    assert.equal(out.statusCode, 404);
  });
});
