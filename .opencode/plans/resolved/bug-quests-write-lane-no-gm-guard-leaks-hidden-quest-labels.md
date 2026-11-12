# bug-quests-write-lane-no-gm-guard-leaks-hidden-quest-labels

## Summary

The Quests lane (`server/routes/quests.js`) is fully GM-only ON READS —
`transformList` returns `[]` for non-localhost and `authorizeRead` 403s every
by-id GET ("Access denied: GM-only feature") — but its factory write lanes
(whole-array POST, per-row DELETE) carry NO origin gate, exactly the shape
that made the sibling Notes lane unsatisfiable (now fixed as
GM-authoring in bug-players-can-never-save-notes-when-any-private-note-exists,
resolved 2026-11-12). Two consequences for a visitor origin:

1. **Hidden-label leak:** any visitor-origin whole-array POST (every disk row
   is invisible to the sender, so the snapshot can never include them) 409s
   with `conflictErrorBody` naming a row the sender is forbidden to know
   exists — leaking GM quest titles one probe at a time.
2. **Ungated writes:** a visitor POST/DELETE that happens to satisfy the
   concurrent-save guard (e.g. replacing an empty quests.json, or after any
   state where the sender's snapshot can match disk) would WRITE GM planning
   data outright — same family as the open bug-sessions-lane-no-gm-write-guard.

## Steps to reproduce

Confirmed live 2026-11-12 (notes fix-verify run) against test-campaign with
one GM quest row on disk:

1. As GM (localhost) the list has a row, e.g. name "The Lost Artifact".
2. From a visitor origin read:
   `curl -H 'Host: 192.168.0.44:5173' http://localhost/api/campaigns/test-campaign/quests`
   → HTTP 200 `{"quests":[]}` (fully filtered — correct).
3. From the same visitor origin POST the snapshot that read returned:
   `curl -X POST -H 'Host: 192.168.0.44:5173' -H 'Content-Type: application/json' -d '{"quests":[]}' http://localhost/api/campaigns/test-campaign/quests`
   → HTTP 409 `{"error":"Quest \"The Lost Artifact\" was created or deleted
   in another tab or session since you loaded it — reload the list and
   re-apply your edit — it was NOT saved.","conflict":true}` — the hidden
   quest title LEAKED, and the save can NEVER succeed (the sender can never
   hold the rows the read lane hides).

## Expected behavior

Consistent with the GM-only read filter and the app doctrine (GM features
localhost-only): refuse non-localhost quests WRITES with 403 "Access denied:
GM-only feature" before any conflict logic runs (no label can surface), like
the notes lane now does (notes.js refuseUnlessGm wrapper +
notes-write-localhost-guard.test.js, and the sidebar entry is already
localhostOnly so no UI change is needed).

## Actual behavior

POST/DELETE from a visitor origin reach the jsonEntityCrud lanes: guaranteed
permanent 409 (unrecoverable) naming hidden GM quest rows; writes ungated as
a structural matter (in test-campaign the 409 happens to block appends, but
for an empty/blank-state campaigns quests.json a visitor POST LANDS — no
origin check exists to stop it).

## Likely location

- `server/routes/quests.js` — factory options gate reads only
  (`transformList`/`authorizeRead`); no write gate.
- `server/utils/jsonEntityCrud.js` — POST/DELETE lanes have no origin hook;
  `findConcurrentWrite` labels dropped rows from DISK content the sender was
  never allowed to see (the dropped-row leg has no sender copy to fall back on).

## Suggested fix

Mirror the notes resolution exactly: wrap the quests factory router in a
`refuseUnlessGm` gate for non-GET methods (canonical 403 copy + BLOCKED
dev-log line), and pin with a `quests-write-localhost-guard.test.js`
(POST/DELETE from LAN hosts ⇒ 403 + disk inert + body never contains hidden
quest names; localhost write lane byte-unchanged). The same wrap fits the
open bug-sessions-lane-no-gm-write-guard fix — one consistent GM-write-guard
for every planner CRUD lane (npcs/factions/settlements included).

## Severity

Data-integrity/privacy leak (hidden GM quest titles exposed to any network
client via one-probe-at-a-time 409 copy) plus an ungated GM-data write lane;
no player-visible UI path (sidebar already hides Quests) but the API is
reachable directly.

## Resolution

FIXED 2026-11-12 (fix run). The bug file's diagnosis was accurate on both
counts; live repro confirmed first: visitor-Host GET → 200 `{"quests":[]}`
(correct), visitor POST of that snapshot → 409
`Quest "The Lost Artifact" was created or deleted…` (hidden title LEAKED),
and a visitor DELETE of a GM probe-row id → 200 (ungated write LANDED,
row gone from disk).

**Face shipped: whole-lane GM gate (the sessions face, not notes-writes-
only).** Grep of the client found NO visitor read consumer for `/quests`:
consumers are `Quests.jsx` (sidebar `localhostOnly` — verified, no UI change
needed), the `Sessions.jsx` picker (Sessions is GM-only and its own lane
already 403s GET), CampaignBuilder drafts (GM-only), `applyWorldProposal.js`
(AI routes are localhost-only), and `seededCampaign.js` starter seeds —
whose ONLY runner is campaign creation, itself refuseUnlessGm
(`campaigns-admin.js:57`), so seeds never execute from a visitor tab. The
read lane already surfaced nothing useful to visitors (`[]` + per-row 403),
so gating the list GET behind the same 403 is consistent and strictly safer.

**Files changed**
- `server/routes/quests.js` — wraps the factory router exactly like
  `sessions.js`: `Router()` + path-scoped `refuseUnlessGm` on
  `/api/campaigns/:campaign/quests` BEFORE `router.use(baseRouter)`; 403
  copy `Access denied: GM-only feature` + `[quests] BLOCKED non-localhost
  <METHOD> <URL> — GM-only` dev-log, on EVERY method. The factory
  `transformList`/`authorizeRead`/`forbiddenMessage` options were REMOVED —
  unreachable once the wrapper intercepts all non-localhost requests
  (sessions has none either). Shared `jsonEntityCrud.js` untouched.
- `server/routes/quests.test.js` — the two pins that locked the OLD visitor
  GET-list face (200 `[]`) updated to the new 403 face (intentional behavior
  change; LAN GET-by-id 403 pins pass unchanged via the wrapper).
- `server/routes/quests-localhost-guard.test.js` — NEW, mirrors
  `sessions-localhost-guard.test.js` conventions (real factory; fs +
  campaignPaths + changeData mocked): 5 LAN hosts × {GET list, GET by id,
  POST empty snapshot (the leak-409 leg — asserts no hidden title, no
  `conflict` key), POST full-content append (the pre-fix LANDS leg),
  DELETE} all ⇒ 403 + disk inert + zero broadcast; plus 4 localhost faces
  byte-unchanged (list/row 200, POST stamp + `replaced` broadcast, DELETE +
  `deleted` broadcast). 29 pins.

**Verification**
- Unit: `npx vitest run server/routes/quests-localhost-guard.test.js` 29/29;
  `npx vitest run server/routes` 105 files / 1626 tests green; `npm run lint`
  zero warnings; `no-timers-guard` OK.
- Live (API restarted post-change, dev pair on :5173/:80, visitor simulated
  with forged `Host: 192.168.0.44:5173` AND a genuine `http://<en0-ip>:5173`
  request through the Vite proxy): GET list / POST snapshot / GET by id /
  DELETE all **403 `Access denied: GM-only feature`** — no quest title in
  any body, disk md5 inert, `[quests] BLOCKED` logged for all four methods.
- GM sanity (localhost Playwright tab, test-campaign): Quests UI create
  `OP Guard Probe Quest` → row + 200; edit description → landed; modal
  `.ct-btn-danger` delete behind native `Delete quest "OP Guard Probe
  Quest"?` → row gone. Console: 0 errors/warnings.
- Cleanup: `quests.json` byte-identical to pre-run baseline (md5
  5055fb78ca48941f1370ec97b9f6fe64), probe rows removed, change-data `{}` +
  log `[]` (closed-tab two-pass admin clears, disk files absent), servers
  killed by port-PID.

**Out-of-scope note (not changed):** `npcs.js` / `factions.js` /
`settlements.js` route files carry ZERO origin guards (grep: no
`isLocalhost`/`refuseUnlessGm` anywhere in them) — the same ungated
planner-write family the sessions/quests fixes closed; npcs pre-made rows are
protected by the bestiary CRUD guard but custom-NPC lanes and factions/
settlements planner data remain visitor-writable/leakable via the same
whole-array 409 mechanism (empty-state campaigns land writes).
