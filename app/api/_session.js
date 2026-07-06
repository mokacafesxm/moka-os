import crypto from "crypto";

const COOKIE_NAME = "moka_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

function sign(value) {
  const hmac = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(value).digest("hex");
  return `${value}.${hmac}`;
}

function verify(signed) {
  if (!signed) return null;
  const separatorIndex = signed.lastIndexOf(".");
  if (separatorIndex === -1) return null;

  const value = signed.slice(0, separatorIndex);
  const providedHmac = signed.slice(separatorIndex + 1);
  const expectedHmac = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(value).digest("hex");

  const provided = Buffer.from(providedHmac);
  const expected = Buffer.from(expectedHmac);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;

  return value;
}

function cookieAttributes() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

// Session identity is just the phone number, HMAC-signed — the Clients
// database (keyed by phone) is the source of truth for everything else.
export function sessionCookieHeader(phone) {
  return `${COOKIE_NAME}=${encodeURIComponent(sign(phone))}; Max-Age=${MAX_AGE_SECONDS}; ${cookieAttributes()}`;
}

export function clearSessionCookieHeader() {
  return `${COOKIE_NAME}=; Max-Age=0; ${cookieAttributes()}`;
}

export function getPhoneFromRequest(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verify(decodeURIComponent(match[1]));
}
