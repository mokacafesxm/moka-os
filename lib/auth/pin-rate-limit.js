// In-memory, per-serverless-instance rate limit for the hidden admin-access
// PIN check (app/api/admin-access) — same accepted per-instance limitation as
// _notion.js's notionGate/withNotionCache. No distributed store: this PIN is
// a convenience shortcut to a URL, never the real security boundary (the
// backoffice behind it still requires its own isAdmin gate + Basic Auth), so
// a per-instance lockout is enough to kill naive brute-forcing without the
// complexity of a shared store.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const attempts = new Map(); // ip -> { count, lockedUntil }

export function isLockedOut(ip) {
  const entry = attempts.get(ip);
  return !!(entry?.lockedUntil && entry.lockedUntil > Date.now());
}

export function recordFailedAttempt(ip) {
  const entry = attempts.get(ip) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    entry.count = 0;
  }
  attempts.set(ip, entry);
}

export function recordSuccess(ip) {
  attempts.delete(ip);
}
