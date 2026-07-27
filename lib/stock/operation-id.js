'use strict';

// Client-side idempotency-key persistence for the manual quick-receipt flow
// (app/page.js openStockReceive/saveStockReceive). Extracted as a pure
// function with an injected storage interface so it's unit-testable without
// a DOM — the real caller passes window.sessionStorage.
//
// Deployment-readiness review finding: generating a fresh operation id every
// time the receive modal opens (regardless of WHY it was reopened) means a
// staff member who is unsure whether a save actually went through — e.g. the
// request succeeded server-side but the response never reached the client
// (dropped wifi) — and closes/reopens the modal to check would get a NEW id
// on retry, defeating the idempotency guarantee for exactly the ambiguous
// case it exists to cover. Persisting the id per stock-item until a save for
// that item actually succeeds closes this gap: reusing a stale id that never
// actually succeeded is harmless (the server has no matching fingerprint, so
// it just applies normally); reusing one that DID succeed is exactly the
// desired already_applied outcome.

const STORAGE_PREFIX = 'mokaStockReceiveOp:';

function resolveOperationId(itemId, storage) {
  if (!itemId || !storage) return null;
  const storageKey = STORAGE_PREFIX + itemId;
  try {
    const existing = storage.getItem(storageKey);
    if (existing) return existing;
    const fresh = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    storage.setItem(storageKey, fresh);
    return fresh;
  } catch {
    // Storage unavailable/full — fall back to a one-off id rather than crash;
    // this only degrades the close/reopen protection, it never breaks the
    // per-request idempotency check itself.
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function clearOperationId(itemId, storage) {
  if (!itemId || !storage) return;
  try {
    storage.removeItem(STORAGE_PREFIX + itemId);
  } catch {
    // Non-fatal — see resolveOperationId.
  }
}

module.exports = { resolveOperationId, clearOperationId, STORAGE_PREFIX };
