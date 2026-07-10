import { NextResponse } from "next/server";

// Public custom domain must expose ONLY /commander and what it depends on —
// everything else (the OrderPad, KDS, admin pages/APIs) stays reachable
// exclusively via moka-os.vercel.app. This is an ALLOWLIST, not a blocklist:
// any internal route added later is blocked by default here instead of
// silently becoming public, which is the whole point of doing this in
// middleware rather than enumerating exceptions in next.config.js.
const PUBLIC_HOSTS = new Set(["mokacafe.co", "www.mokacafe.co"]);

// Keep in sync with what app/commander/** actually calls (verified via
// `grep -rn "fetch(" app/commander`) — not a guess.
const ALLOWED_PATHS = [
  "/commander",
  "/api/account/card",
  "/api/account/card/save",
  "/api/account/card/setup-intent",
  "/api/account/orders",
  "/api/account/profile",
  "/api/account/rewards",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/send-code",
  "/api/auth/set-prenom",
  "/api/auth/verify-code",
  "/api/orders/checkout",
  "/api/orders/confirm",
  "/api/orders/pay-saved-card",
  "/api/wheel/eligibility",
  "/api/wheel/spin",
];

function isAllowedPath(pathname) {
  return ALLOWED_PATHS.some((allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`));
}

export function middleware(request) {
  const hostname = (request.headers.get("host") || "").split(":")[0];

  // Internal domain (moka-os.vercel.app) and anything else (previews,
  // localhost during dev, etc.) stay fully unrestricted.
  if (!PUBLIC_HOSTS.has(hostname)) return NextResponse.next();

  if (isAllowedPath(request.nextUrl.pathname)) return NextResponse.next();

  return NextResponse.redirect(new URL("/commander", request.url), 308);
}

// Excludes Next.js internals and static files (images, manifest, favicon...)
// by extension — those must load regardless of host or /commander itself
// breaks (it references /logo-moka.png, the shared layout references
// /manifest.json, /icon-*.png, etc.).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|json|webmanifest|css|txt|xml)$).*)"],
};
