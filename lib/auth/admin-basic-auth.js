// HTTP Basic Auth guard for /api/admin/* — the only server-side enforcement
// anywhere in the app (every other admin page, e.g. /specials, /incidents,
// is gated by StaffContext's isAdmin client-side only, trivially bypassable
// by anyone who knows the internal .vercel.app URL). Verified in
// middleware.js before any /api/admin/* route runs, using the Edge runtime's
// atob (not Buffer, which isn't available there).
//
// Mirrors the credential shape of the now-removed /imports Basic Auth
// (IMPORTS_AUTH_USERNAME/PASSWORD) rather than inventing a new convention.

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyAdminBasicAuth(request) {
  const expectedUser = process.env.ADMIN_API_USERNAME;
  const expectedPass = process.env.ADMIN_API_PASSWORD;
  // Unconfigured means closed, never open-by-default — same principle as the
  // importer's CONFIG_MISSING routes (see .env.example).
  if (!expectedUser || !expectedPass) return false;

  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return false;

  let decoded;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep === -1) return false;

  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  return timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass);
}
