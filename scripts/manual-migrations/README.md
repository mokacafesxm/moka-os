# Manual migrations — NOT part of the live application

Scripts in this directory are human-run, one-off tools. None of them are
called by `app/`, `lib/`, the CLI (`npm run importer`), CI, or any Vercel
cron/build step. They exist here (rather than the repo root) so their
one-off/manual nature is unambiguous, and so they can carry consistent
safety defaults:

- **Environment-based credentials only** — never a hardcoded API key or
  database id. A hardcoded id is exactly the risk that got the original
  version of `backfill-pointages-2026-06.js` quarantined here (Architecture
  Ownership Audit, section 5): it silently targeted the same production
  Pointages database as the live app, with no way to point it at a
  sandbox/test database instead.
- **Dry-run by default** — every script prints what it *would* do and makes
  zero network calls unless explicitly told otherwise.
- **Explicit confirmation required for real writes** — typically a
  `--confirm` flag.

Before running any script here against production, verify independently (in
Notion) that its intended change has not already been applied — none of
these scripts are idempotent.
