import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { NOTION_VERSION, queryDatabase, createPage, getDatabase } from '../../notion/notion-client.js';

let savedFetch;
let savedApiKey;

beforeEach(() => {
  savedFetch = global.fetch;
  savedApiKey = process.env.NOTION_API_KEY;
  process.env.NOTION_API_KEY = 'test-key';
});

afterEach(() => {
  global.fetch = savedFetch;
  if (savedApiKey === undefined) delete process.env.NOTION_API_KEY;
  else process.env.NOTION_API_KEY = savedApiKey;
});

describe('Notion API version + classic database endpoint compatibility', () => {
  it('uses the classic 2022-06-28 API version and classic /databases/{id} endpoints, never a data_source_id path', async () => {
    expect(NOTION_VERSION).toBe('2022-06-28');

    const seenRequests = [];
    global.fetch = async (url, opts) => {
      seenRequests.push({ url, headers: opts.headers });
      return { ok: true, status: 200, json: async () => ({ id: 'db-1', properties: {} }) };
    };

    await getDatabase('db-1');
    await queryDatabase('db-1', null, null, 10);
    await createPage('db-1', {});

    for (const req of seenRequests) {
      expect(req.headers['Notion-Version']).toBe('2022-06-28');
      expect(req.url).toMatch(/^https:\/\/api\.notion\.com\/v1\//);
      expect(req.url).not.toMatch(/data_sources?/);
    }
    expect(seenRequests[0].url).toBe('https://api.notion.com/v1/databases/db-1');
    expect(seenRequests[1].url).toBe('https://api.notion.com/v1/databases/db-1/query');
    expect(seenRequests[2].url).toBe('https://api.notion.com/v1/pages');
  });
});

describe('429 retry policy', () => {
  it('retries a 429 response (with Retry-After) and succeeds without surfacing an error', async () => {
    let callCount = 0;
    global.fetch = async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          ok: false,
          status: 429,
          headers: new Map([['retry-after', '0']]),
          arrayBuffer: async () => new ArrayBuffer(0),
        };
      }
      return { ok: true, status: 200, json: async () => ({ id: 'db-1', properties: {} }) };
    };

    const result = await getDatabase('db-1');
    expect(result).toEqual({ id: 'db-1', properties: {} });
    expect(callCount).toBe(2);
  });

  it('never retries a 500 (only 429 is safe to retry)', async () => {
    let callCount = 0;
    global.fetch = async () => {
      callCount += 1;
      return { ok: false, status: 500, text: async () => 'server error' };
    };

    await expect(createPage('db-1', {})).rejects.toThrow(/500/);
    expect(callCount).toBe(1);
  });
});
