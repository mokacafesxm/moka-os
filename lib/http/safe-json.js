'use strict';

// Safari/WebKit throws a generic native SyntaxError ("The string did not
// match the expected pattern") when JSON.parse-ing a non-JSON response body
// — a DOM Exception 12-family error shared by several unrelated WebKit APIs,
// not specific to JSON at all. It carries zero diagnostic value on its own.
//
// Investigated 2026-07-31 (module Load upload failures, reported as "did
// not match the expected pattern" on 3 unrelated file types/routes): there
// is no Zod `.regex()` or any other pattern-based validation anywhere in
// this codebase that could produce that message (confirmed empirically —
// Zod v4's actual regex-mismatch message reads "Invalid string: must match
// pattern ..."). The real cause was a non-JSON response body reaching
// `res.json()` unguarded. The most likely real-world trigger in this app:
// hitting the public customer domain (mokacafe.co) instead of the internal
// admin domain (moka-os.vercel.app) — middleware.js 308-redirects every
// non-/commander path on the public domain to /commander, whose body is not
// JSON. See docs/ARCHITECTURE.md "Domaine public vs domaine interne" for
// the full writeup.
//
// This helper never masks a real business error (a route returning a JSON
// `{ error: "..." }` body still flows through untouched) — it only replaces
// the opaque browser exception that would otherwise fire when the body
// isn't JSON at all, with a message that names what actually happened.
async function parseJsonResponse(res) {
  if (res.redirected) {
    const err = new Error(
      'Réponse redirigée par le serveur — tu utilises peut-être le lien public (mokacafe.co) au lieu du lien interne MOKA OS. Vérifie l\'app installée sur ton écran d\'accueil.'
    );
    err.status = res.status;
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const err = new Error(
      `Réponse inattendue du serveur (HTTP ${res.status}, type "${contentType || 'inconnu'}" au lieu de JSON).`
    );
    err.status = res.status;
    throw err;
  }

  try {
    return await res.json();
  } catch {
    const err = new Error(`Réponse du serveur illisible (HTTP ${res.status}).`);
    err.status = res.status;
    throw err;
  }
}

module.exports = { parseJsonResponse };
