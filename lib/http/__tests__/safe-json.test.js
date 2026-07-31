import { describe, it, expect } from 'vitest';

const { parseJsonResponse } = require('../safe-json');

/** Minimal duck-typed stand-in for a Fetch API Response — only the surface parseJsonResponse reads. */
function fakeResponse({ redirected = false, status = 200, contentType = 'application/json', body = '{}' }) {
  return {
    redirected,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => {
      try {
        return JSON.parse(body);
      } catch (err) {
        throw err;
      }
    },
  };
}

describe('parseJsonResponse', () => {
  it('parses a normal JSON response through unchanged', async () => {
    const res = fakeResponse({ body: '{"success":true,"count":3}' });
    await expect(parseJsonResponse(res)).resolves.toEqual({ success: true, count: 3 });
  });

  it('never masks a real business error JSON body', async () => {
    const res = fakeResponse({ status: 400, body: '{"success":false,"error":"Nom requis"}' });
    await expect(parseJsonResponse(res)).resolves.toEqual({ success: false, error: 'Nom requis' });
  });

  it('gives a specific, actionable message when the response was redirected (the real-world cause: public domain instead of internal admin domain)', async () => {
    const res = fakeResponse({ redirected: true, contentType: 'text/plain', body: 'Redirecting...' });
    await expect(parseJsonResponse(res)).rejects.toThrow(/lien public.*mokacafe\.co|lien interne/i);
  });

  it('rejects with a clear message for any other non-JSON content-type, without ever attempting JSON.parse on it', async () => {
    const res = fakeResponse({ status: 500, contentType: 'text/html', body: '<html>Internal Server Error</html>' });
    await expect(parseJsonResponse(res)).rejects.toThrow(/HTTP 500/);
  });

  it('rejects with a clear message when the content-type claims JSON but the body fails to parse', async () => {
    const res = fakeResponse({ status: 200, contentType: 'application/json', body: 'not actually json' });
    await expect(parseJsonResponse(res)).rejects.toThrow(/illisible/);
  });
});
