import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  isAuthDisabled,
  getConfiguredCredentials,
  constantTimeEqual,
  parseBasicAuthHeader,
  verifyBasicAuth,
  isImportsPath,
} from '../imports-basic-auth.js';

const ENV_KEYS = ['IMPORTS_AUTH_DISABLED', 'IMPORTS_AUTH_USERNAME', 'IMPORTS_AUTH_PASSWORD'];
let savedEnv;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
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

describe('isAuthDisabled', () => {
  it('is false by default', () => {
    expect(isAuthDisabled()).toBe(false);
  });

  it('is true only for the exact literal "true" — never inferred from NODE_ENV', () => {
    process.env.IMPORTS_AUTH_DISABLED = 'true';
    expect(isAuthDisabled()).toBe(true);
    process.env.IMPORTS_AUTH_DISABLED = '1';
    expect(isAuthDisabled()).toBe(false);
    process.env.IMPORTS_AUTH_DISABLED = 'TRUE';
    expect(isAuthDisabled()).toBe(false);
  });
});

describe('getConfiguredCredentials', () => {
  it('returns null when either var is missing', () => {
    expect(getConfiguredCredentials()).toBeNull();
    process.env.IMPORTS_AUTH_USERNAME = 'staff';
    expect(getConfiguredCredentials()).toBeNull();
  });

  it('returns both values when both are set', () => {
    process.env.IMPORTS_AUTH_USERNAME = 'staff';
    process.env.IMPORTS_AUTH_PASSWORD = 'secret';
    expect(getConfiguredCredentials()).toEqual({ username: 'staff', password: 'secret' });
  });
});

describe('constantTimeEqual', () => {
  it('matches equal strings and rejects different ones, regardless of length', async () => {
    expect(await constantTimeEqual('abc', 'abc')).toBe(true);
    expect(await constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(await constantTimeEqual('', '')).toBe(true);
  });
});

describe('parseBasicAuthHeader', () => {
  it('parses a valid Basic header', () => {
    expect(parseBasicAuthHeader(basicHeader('staff', 'secret'))).toEqual({
      username: 'staff',
      password: 'secret',
    });
  });

  it('returns null for missing, non-Basic, or malformed headers', () => {
    expect(parseBasicAuthHeader(null)).toBeNull();
    expect(parseBasicAuthHeader(undefined)).toBeNull();
    expect(parseBasicAuthHeader('Bearer sometoken')).toBeNull();
    expect(parseBasicAuthHeader('Basic %%%not-base64%%%')).toBeNull();
    expect(parseBasicAuthHeader(`Basic ${Buffer.from('no-colon-here').toString('base64')}`)).toBeNull();
  });

  it('supports a password containing a colon', () => {
    expect(parseBasicAuthHeader(basicHeader('staff', 'sec:ret'))).toEqual({
      username: 'staff',
      password: 'sec:ret',
    });
  });
});

describe('verifyBasicAuth', () => {
  it('allows everything when explicitly disabled', async () => {
    process.env.IMPORTS_AUTH_DISABLED = 'true';
    expect(await verifyBasicAuth(null)).toEqual({ ok: true, reason: 'DISABLED' });
  });

  it('fails closed with CONFIG_MISSING when credentials are not configured', async () => {
    expect(await verifyBasicAuth(basicHeader('staff', 'secret'))).toEqual({ ok: false, reason: 'CONFIG_MISSING' });
  });

  it('fails with MISSING_HEADER when no Authorization header is sent', async () => {
    process.env.IMPORTS_AUTH_USERNAME = 'staff';
    process.env.IMPORTS_AUTH_PASSWORD = 'secret';
    expect(await verifyBasicAuth(null)).toEqual({ ok: false, reason: 'MISSING_HEADER' });
  });

  it('fails with INVALID_CREDENTIALS on a wrong username or password', async () => {
    process.env.IMPORTS_AUTH_USERNAME = 'staff';
    process.env.IMPORTS_AUTH_PASSWORD = 'secret';
    expect(await verifyBasicAuth(basicHeader('staff', 'wrong'))).toEqual({ ok: false, reason: 'INVALID_CREDENTIALS' });
    expect(await verifyBasicAuth(basicHeader('nope', 'secret'))).toEqual({ ok: false, reason: 'INVALID_CREDENTIALS' });
  });

  it('succeeds with matching credentials', async () => {
    process.env.IMPORTS_AUTH_USERNAME = 'staff';
    process.env.IMPORTS_AUTH_PASSWORD = 'secret';
    expect(await verifyBasicAuth(basicHeader('staff', 'secret'))).toEqual({ ok: true, reason: null });
  });
});

describe('isImportsPath', () => {
  it('matches /imports and its sub-paths', () => {
    expect(isImportsPath('/imports')).toBe(true);
    expect(isImportsPath('/imports/')).toBe(true);
    expect(isImportsPath('/imports/history')).toBe(true);
  });

  it('matches /api/imports and its sub-paths', () => {
    expect(isImportsPath('/api/imports')).toBe(true);
    expect(isImportsPath('/api/imports/preflight')).toBe(true);
    expect(isImportsPath('/api/imports/commit')).toBe(true);
  });

  it('does not match unrelated paths', () => {
    expect(isImportsPath('/commander')).toBe(false);
    expect(isImportsPath('/api/orders/checkout')).toBe(false);
    expect(isImportsPath('/importsx')).toBe(false);
  });
});
