import { NextResponse } from "next/server";
import { verifyBasicAuth, parseBasicAuthHeader, isImportsPath, REALM } from "./lib/auth/imports-basic-auth.js";

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

// Loud, once-per-instance signal that production is misconfigured — this
// file can't hard-fail server startup, but a missing/disabled auth config
// in production should never be silent. Every /imports request still
// fails closed (401) regardless of this log (see middleware() below).
if (
  process.env.NODE_ENV === "production" &&
  process.env.IMPORTS_AUTH_DISABLED !== "true" &&
  (!process.env.IMPORTS_AUTH_USERNAME || !process.env.IMPORTS_AUTH_PASSWORD)
) {
  console.error(
    "[imports-basic-auth] IMPORTS_AUTH_USERNAME/IMPORTS_AUTH_PASSWORD are not configured in production — " +
      "/imports and /api/imports/* will refuse every request (fail-closed) until they are set."
  );
}

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;

  // Applies regardless of host — the importer staff tool is never public
  // and never depends on the mokacafe.co allowlist logic below.
  if (isImportsPath(pathname)) {
    const authorizationHeader = request.headers.get("authorization");
    const authResult = await verifyBasicAuth(authorizationHeader);
    if (!authResult.ok) {
      return new NextResponse("Authentication required.", {
        status: 401,
        headers: { "WWW-Authenticate": `Basic realm="${REALM}"` },
      });
    }

    // Forwards the submitted username to the route handler for the Import
    // Runs audit trail's `initiated_by` field (PR4 addendum) — re-parsed
    // here rather than re-verified, since verifyBasicAuth already
    // authenticated this request. Not a real per-staff identity (the
    // credential is shared) — see docs/ARCHITECTURE.md "PR4 addendum —
    // audit trail" for why this is honestly labeled "best-effort".
    const requestHeaders = new Headers(request.headers);
    const submitted = parseBasicAuthHeader(authorizationHeader);
    requestHeaders.set("x-imports-user", submitted?.username ?? "");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const hostname = (request.headers.get("host") || "").split(":")[0];

  // Internal domain (moka-os.vercel.app) and anything else (previews,
  // localhost during dev, etc.) stay fully unrestricted.
  if (!PUBLIC_HOSTS.has(hostname)) return NextResponse.next();

  if (isAllowedPath(pathname)) return NextResponse.next();

  return NextResponse.redirect(new URL("/commander", request.url), 308);
}

// Excludes Next.js internals and static files (images, manifest, favicon...)
// by extension — those must load regardless of host or /commander itself
// breaks (it references /logo-moka.png, the shared layout references
// /manifest.json, /icon-*.png, etc.).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|json|webmanifest|css|txt|xml)$).*)"],
};
