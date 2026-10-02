import { NextResponse } from "next/server";
import { verifyAdminBasicAuth } from "./lib/auth/admin-basic-auth";

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
  "/api/admin-access",
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

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;
  const hostname = (request.headers.get("host") || "").split(":")[0];

  // Internal domain (moka-os.vercel.app) and anything else (previews,
  // localhost during dev, etc.) stay fully unrestricted — EXCEPT the new
  // backoffice routes below, which get real server-side enforcement rather
  // than the client-only isAdmin gate every other admin page uses.
  //
  // Deliberately an allowlist of prefixes, NOT a blanket "/api/admin" match:
  // /api/admin/sync-stock already existed (a no-auth backfill endpoint
  // auto-fired on every admin page load, see app/(os)/page.js) — gating the
  // whole namespace would have 401'd it. Extend this list as Phase 2 (the
  // catalogue editor) adds /api/admin/products, /categories, /promos, /upload.
  const ADMIN_GUARDED_PREFIXES = [
    "/api/admin/orders",
    "/api/admin/products",
    "/api/admin/categories",
    "/api/admin/promos",
    "/api/admin/upload",
  ];
  if (!PUBLIC_HOSTS.has(hostname)) {
    const needsAdminAuth = ADMIN_GUARDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (needsAdminAuth && !verifyAdminBasicAuth(request)) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="MOKA OS Admin"' },
      });
    }
    return NextResponse.next();
  }

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
