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
