# bug-sessions-lane-no-gm-write-guard

## Summary

The Sessions planner API (`server/routes/sessions.js`) has NO origin guard at
all: a network (LAN/visitor) client can GET the full session list and
POST/PUT/DELETE session plans. Every sibling GM lane implements a guard —
inventory.js has `refuseUnlessGm` ("Access denied: GM-only feature"),
notes.js filters `isPrivate` rows and 403s private reads — but sessions has
neither. Only the client sidebar hides the Sessions button off localhost; the
server accepts the writes outright, violating the server-first GM-only
doctrine.

## Steps to reproduce

1. In test-campaign, as GM (localhost), create a session via the Sessions view
   (or the equivalent whole-array POST) so the list is non-empty.
2. From a NON-localhost origin, read:
   `curl -H 'Host: 192.168.0.44' http://localhost/api/campaigns/test-campaign/sessions`
   → HTTP 200 with the full GM plan list (no filtering).
3. From the same non-localhost origin, append a row and POST the whole array:
   `curl -X POST -H 'Host: 192.168.0.44' -H 'Content-Type: application/json' -d '{"sessions":[<existing rows>, {"name":"OP Visitor Session","description":"honest visitor append","status":"planned"}]}' http://localhost/api/campaigns/test-campaign/sessions`
   → `{"success":true}` HTTP 200.
4. GET the list as localhost → "OP Visitor Session" persisted to
   `public/campaigns/test-campaign/data/sessions.json`.
5. (Same family) PUT upsert and DELETE lanes likewise have no origin check.

## Expected behavior

Per the GM-only doctrine (AGENTS.md "GM features are localhost-only" and the
precedent of `bug-player-clients-can-write-party-inventory` which added
`refuseUnlessGm` to inventory), the Sessions CRUD lanes should refuse
non-localhost writes with 403, and arguably filter reads to GM as well (the
sidebar marks Sessions `localhostOnly: true`; a LAN client should get 403, not
a 200 plan dump).

## Actual behavior

All sessions reads and writes succeed from a visitor origin. Live-verified
2026-11-12 (explore run OP): visitor GET → 200 (full list); visitor whole-array
POST appending a row → 200 + disk persistence. The only thing protecting the
lane is the hidden sidebar button in `src/components/sidebar/Sidebar.jsx`
(`localhostOnly: true` for sessions). A forged Host header through the Vite
proxy is exactly the attack the `notes-localhost-guard` suite was written for
— sessions never got that treatment.

## Likely location

Confident: `server/routes/sessions.js` (createJsonEntityRouter('sessions', …)
options pass `broadcast` + `validateList` but no origin gate; the custom PUT
lane has none either). Compare `server/routes/inventory.js:19-25`
(`refuseUnlessGm`) and `server/routes/notes.js:40-51` (transformList /
authorizeRead). Note: `docs/test-setup-playbook.md` §36 and the
`docs/app-exploration.md` Depth Seeds currently CLAIM "server routes
{notes,sessions,inventory}.js carry a localhost guard (unit-pinned)" — that is
WRONG for sessions (no such code, no such test; grep of sessions.js/
sessions.test.js for isLocalhost/403 is empty). This run corrects it in place.

## Suggested fix

Mirror the inventory guard: in `server/routes/sessions.js` add an
`isLocalhost(req)` check (same hostname idiom) returning
`res.status(403).json({ error: 'Access denied: GM-only feature' })` on all
write lanes (factory POST/DELETE + custom PUT) — easiest via a router-level
`router.use` middleware on the mounted sessions router for non-GET, or by
extending `createJsonEntityRouter` with a `requireGmWrites: true` option the
factory consults before POST/PUT/DELETE (preferred: shared lane so future
GM-only entities get it for free). Add read filtering or full 403 on GET to
match the sidebar's localhostOnly intent — product call, but a visitor 200
dump of the GM session plan is at minimum inconsistent. Add a
`sessions-localhost-guard.test.js` mirroring `notes-localhost-guard.test.js`.

## Severity

Broken feature / data integrity risk — any LAN player can silently rewrite the
GM's session planning store; the doctrine says these lanes are GM-only and the
sibling routes enforce it, so this is an enforcement hole, not just a UX gap.

## Resolution

FIXED — 2026-11-12 fix run.

**What was actually wrong:** exactly as diagnosed — `server/routes/sessions.js`
mounted the raw `createJsonEntityRouter('sessions', …)` result plus a custom
per-row PUT lane with zero origin checks. Confirmed live pre-fix (fresh repro,
this run): visitor-Host GET → 200 full plan dump; visitor whole-array POST
append → 200 + persisted to `data/sessions.json`; visitor PUT upsert → 200
tamper landed; visitor DELETE → 200 row removed. Also confirmed honestly
through the real transport: a fresh Playwright tab on `http://192.168.0.44:5173`
(Vite proxy keeps the real Host, `changeOrigin:false`) selecting test-campaign
got 200 on an in-tab `fetch('/api/campaigns/test-campaign/sessions')`.

**Triage resolution of the "product call":** the WHOLE lane (reads AND writes,
every method) is now GM-only. The sidebar already marks Sessions
`localhostOnly: true` and a grep census found no visitor read consumer
(`src/routes/config.js` view entry + `sessionsService.js` are reached only
from the gated Sessions view; the visitor tab made ZERO sessions fetches on
its own), so a visitor 200 plan dump was inconsistent with the doctrine and
nothing breaks by 403-ing GETs — unlike notes.js, whose reads stay open behind
the `isPrivate` filter.

**What changed:**
- `server/routes/sessions.js` — mirrors the shipped notes.js wrapper shape
  (commit 8d93705a5): `isLocalhost(req)` + `refuseUnlessGm` returning
  `403 { error: 'Access denied: GM-only feature' }` with the `[sessions]
  BLOCKED non-localhost <METHOD> <URL> — GM-only` dev-log; a new `Router()`
  mounts a path-scoped `/api/campaigns/:campaign/sessions` gate (NO method
  exemption) before `router.use(baseRouter)` — the factory offers no write
  hook and per-route `use()` after creation lands too late. The shared
  `jsonEntityCrud.js` factory was NOT touched (per-lane wrapper is the
  shipped pattern; the factory-option idea was rejected in triage for scope).
- `server/routes/sessions-localhost-guard.test.js` (NEW) — mirrors
  `notes-write-localhost-guard.test.js` setup (real factory, fs/campaignPaths/
  changeData mocked, IPv4 supertest helper). Pins across 5 honest LAN Host
  values: GET list 403 (no plan-dump/label leak), GET one row 403 (existence
  unprobed), POST 403 disk-inert + no broadcast, PUT 403 disk-inert, DELETE
  403 row survives; plus localhost legs: GET list/row 200, whole-array POST
  200 stamped + `replaced` broadcast, PUT upsert 200 + `created` broadcast,
  DELETE 200 + `deleted` broadcast.
- Docs corrected in place: `docs/test-setup-playbook.md` §36 (sessions
  "NO guard AT ALL" clause → GM-gated + new Sessions-UI ride recipe) and
  `docs/app-exploration.md` (run-header (a), Priority Targets 1(b), Depth
  Seed "Visitor write truth", Coverage row).

**Verification:**
1. `npx vitest run server/routes/sessions-localhost-guard.test.js` → 30/30 pass.
2. `npx vitest run server/routes` → 104 files / 1597 tests pass (existing
   sessions suites ride the default 127.0.0.1 supertest Host — unaffected).
3. `npm run lint` → clean, zero warnings.
4. Live re-verify (API restarted, change live): visitor-Host curl matrix
   GET/POST/PUT/DELETE → 403 `Access denied: GM-only feature` ×4, disk bytes
   unchanged, 4 `[sessions] BLOCKED` dev-log lines; fresh LAN-IP Playwright tab
   (header verified `test-campaign`, Sessions button absent from its sidebar) →
   in-tab GET 403 + POST 403, follow-up read shows nothing appended (the tab
   itself made zero sessions fetches — visitor surface fully inert); GM
   localhost UI end-to-end: list renders seeded row, `New Session` modal →
   create lands (`Edit session: OP Fix Verify Session`), edit-summary saves,
   Delete fires the byte-pinned native `Delete Session Plan "OP Fix Verify
   Session"?` (recorded via window.confirm override) and evicts the row.
5. Cleanup: sessions.json restored to baseline bare `[]` (md5
   d751713988987e9331980363e24189ce), change-data + campaign log admin-cleared,
   `git status --porcelain public/campaigns/` empty, servers killed by port-PID.

**Related family (not fixed here):** commit ac4b2238d filed
`bug-quests-write-lane-no-gm-guard-leaks-hidden-quest-labels` — same no-guard
family on the quests lane; open tracker owns it.
