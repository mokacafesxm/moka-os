import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ENV_KEYS = ['IMPORTS_AUTH_DISABLED', 'IMPORTS_AUTH_USERNAME', 'IMPORTS_AUTH_PASSWORD', 'NODE_ENV'];
let savedEnv;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

function basicHeader(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function requestFor(pathname, { authorization, host = 'moka-os.vercel.app' } = {}) {
  const headers = { host };
  if (authorization) headers.authorization = authorization;
  return new NextRequest(`https://${host}${pathname}`, { headers });
}

describe('middleware — /imports and /api/imports/* Basic Auth', () => {
  it('blocks unauthorized access to the /imports staff page (missing credentials configured -> fail closed)', async () => {
    const { middleware } = await import('../middleware.js');
    const response = await middleware(requestFor('/imports'));
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toMatch(/^Basic realm=/);
  });

  it('blocks unauthorized preflight and commit API calls the same way', async () => {
    process.env.IMPORTS_AUTH_USERNAME = 'staff';
    process.env.IMPORTS_AUTH_PASSWORD = 'secret';
    const { middleware } = await import('../middleware.js');

    const preflightRes = await middleware(requestFor('/api/imports/preflight'));
    expect(preflightRes.status).toBe(401);

    const commitRes = await middleware(requestFor('/api/imports/commit'));
    expect(commitRes.status).toBe(401);
  });

  it('rejects wrong credentials with 401', async () => {
    process.env.IMPORTS_AUTH_USERNAME = 'staff';
    process.env.IMPORTS_AUTH_PASSWORD = 'secret';
    const { middleware } = await import('../middleware.js');

    const response = await middleware(
      requestFor('/imports', { authorization: basicHeader('staff', 'wrong-password') })
    );
    expect(response.status).toBe(401);
  });

  it('allows access with valid credentials', async () => {
    process.env.IMPORTS_AUTH_USERNAME = 'staff';
    process.env.IMPORTS_AUTH_PASSWORD = 'secret';
    const { middleware } = await import('../middleware.js');

    const response = await middleware(requestFor('/imports', { authorization: basicHeader('staff', 'secret') }));
    expect(response.status).toBe(200);

    const apiResponse = await middleware(
      requestFor('/api/imports/commit', { authorization: basicHeader('staff', 'secret') })
    );
    expect(apiResponse.status).toBe(200);
  });

  it('fails safely (401) when production has no credentials configured, even with the explicit dev opt-out unset', async () => {
    process.env.NODE_ENV = 'production';
    const { middleware } = await import('../middleware.js');
    const response = await middleware(requestFor('/imports'));
    expect(response.status).toBe(401);
  });

  it('never lets IMPORTS_AUTH_DISABLED be implied by NODE_ENV=development alone', async () => {
    process.env.NODE_ENV = 'development';
    const { middleware } = await import('../middleware.js');
    const response = await middleware(requestFor('/imports'));
    expect(response.status).toBe(401);
  });

  it('leaves the existing mokacafe.co host allowlist behavior untouched for non-imports paths', async () => {
    const { middleware } = await import('../middleware.js');
    const response = await middleware(requestFor('/commander', { host: 'mokacafe.co' }));
    expect(response.status).toBe(200);

    const blocked = await middleware(requestFor('/some-internal-page', { host: 'mokacafe.co' }));
    expect(blocked.status).toBe(308);
  });
});
