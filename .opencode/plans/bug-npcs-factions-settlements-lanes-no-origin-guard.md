# bug-npcs-factions-settlements-lanes-no-origin-guard

## Summary

Three planner/management CRUD lanes — `server/routes/npcs.js`,
`server/routes/factions.js`, and `server/routes/settlements.js` — carry NO
origin guard of any kind (grep-zero for `isLocalhost`/`refuseUnlessGm`/403 in
all three files), while all three sidebar entries are `localhostOnly: true`
(`src/components/sidebar/Sidebar.jsx`: factions :38, npcs :47, settlements :51).
A network (LAN/visitor) client can therefore GET the full lists and
POST/PUT/DELETE rows outright — violating the AGENTS.md doctrine "GM features
are localhost-only: … map editing, quest/faction/NPC management … network
clients get read-only view." This is the same family fixed three times in one
session (notes → 8d93705a5 GM-writes gate, sessions → 2081e3a65 whole-lane
gate, quests → eced35cf6 whole-lane gate); discovered by the quests fix run
(grep census reported in its return message, re-verified by the primary 2026-11-12).

Where a lane has a visibility filter on reads, the missing write gate also
reproduces the hidden-label 409 leak mechanism documented in
bug-players-can-never-save-notes-when-any-private-note-exists and
bug-quests-write-lane-no-gm-guard-leaks-hidden-quest-labels (a visitor's
snapshot can never include rows the read lane hides, so the concurrent-save
guard 409s naming hidden GM content).

## Steps to reproduce

1. In test-campaign, as GM (localhost), ensure at least one row exists in each
   lane (NPC / Faction / Settlement list views, or the equivalent whole-array
   POST).
2. From a visitor origin, read:
   `curl -H 'Host: 192.168.0.44' http://localhost/api/campaigns/test-campaign/npcs`
   (and `/factions`, `/settlements`) → HTTP 200 with the full GM lists.
3. From the same visitor origin, POST a whole-array snapshot appending one row
   to any of the three lanes → 200 `{"success":true}` (when the snapshot
   matches disk, e.g. empty-state campaigns or after the GET in step 2), and
   GET on localhost shows the visitor row persisted to
   `public/campaigns/test-campaign/data/*.json`.
4. Per-row PUT/DELETE lanes likewise have no origin check.

(Steps 2–3 are the doctrine-level face and are code-confirmed grep-zero; the
live POST-lands witness must be confirmed in test-campaign by the fixer before
code changes, per the verify-then-fix protocol.)

## Expected behavior

Per the GM-only doctrine and the three shipped siblings, non-localhost clients
must be refused on the write lanes with 403 `Access denied: GM-only feature`
before any conflict logic runs; the read face per lane is a triage call the
fixer must ground in a client-consumer grep (see Suggested fix).

## Likely location

- `server/routes/npcs.js`, `server/routes/factions.js`,
  `server/routes/settlements.js` — all built on
  `server/utils/jsonEntityCrud.js` `createJsonEntityRouter` with no origin
  hook; any custom lanes mounted alongside have no gate either.
- Reference implementations (shipped this session): `server/routes/notes.js`,
  `server/routes/sessions.js`, `server/routes/quests.js` — path-scoped
  `refuseUnlessGm` wrapper `Router()` mounted BEFORE `router.use(baseRouter)`,
  canonical 403 copy + `[<lane>] BLOCKED non-localhost <METHOD> <URL> — GM-only`
  dev-log.

## Suggested fix

Mirror the sibling wrapper per lane (do NOT modify the shared
`jsonEntityCrud.js` factory — the per-route wrapper is the shipped pattern).
Read-face decision per lane: grep the client for every consumer of each
endpoint and check whether any visitor-visible view legitimately reads it
(the quests fixer's method). Precedent: lanes with no legitimate visitor read
consumer became whole-lane GM gates (sessions/quests); lanes where visitors
legitimately read but must not write get the writes-only gate (notes). Known
nuance to verify: npcs data may be consumed by player-side features (e.g.
runtime NPC references) — confirm each consumer's origin before gating GETs.
Pin each lane with a `<lane>-localhost-guard.test.js` mirroring
`notes-write-localhost-guard.test.js` / `quests-localhost-guard.test.js`.
Correct any stale read/write-authority claims about these lanes in
`docs/app-exploration.md` / playbook §36 in place afterwards.

## Severity

Data-integrity risk / enforcement hole — any LAN player can silently rewrite
the GM's NPC, faction, and settlement planning stores, and any visibility-
filtered read in these lanes leaks hidden GM labels via the 409 conflict copy.
No player-visible UI path (sidebar hides all three) but the API is directly
reachable.
