# bug-players-can-never-save-notes-when-any-private-note-exists

## Summary

The Notes view is visible to LAN players (the sidebar does NOT mark it
`localhostOnly`, unlike npcs/quests/sessions/etc.), the "New Note" button and
editor render for them, and Save is enabled — but the server's
private-note VISIBILITY filter makes a player's whole-array save structurally
impossible whenever the campaign holds at least one `isPrivate` note: the
player's loaded snapshot can never contain the private row, so the
concurrent-save guard reads its absence as "deleted elsewhere" and returns a
permanent 409. "Reload list" re-loads the same filtered (private-less) list,
so retrying can never succeed. The conflict banner additionally LEAKS the
private note's row label (its partyLocation, or a 40-char excerpt of its
private description when unlabeled) to the player.

## Steps to reproduce

1. In test-campaign as GM, ensure at least one private note exists (the owner
   fixture "Skull Creek Cave" has `isPrivate: true`).
2. Open a LAN-origin tab: browse `http://<en0-ip>:5173` (e.g.
   192.168.0.44:5173) — the Vite proxy forwards the real Host, so the server
   honestly treats this tab as a visitor.
3. Select test-campaign, open the Notes view. The list shows only the public
   notes (private row filtered — that part is correct).
4. Click "New Note", fill Description + Party Location (Save enables — both
   gates satisfied), click Save.

## Expected behavior

Either (a) Notes is a GM-authoring lane (consistent with the Private checkbox
being localhost-only, the list filtering, and the GM-only doctrine) — then the
sidebar should mark it `localhostOnly` (or the visitor UI should hide
New/Save as read-only) and the server should refuse non-localhost note writes
with a clear 403; or (b) players may author notes — then their save must
succeed (the write lane must merge just the delta rows instead of requiring a
full-fidelity snapshot they are not permitted to hold).

## Actual behavior

Confirmed live 2026-11-12 (explore run OP) on a LAN-IP tab against
test-campaign: Save → red banner
`Note "Skull Creek Cave" was created or deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.`
with a "Reload list" button; `POST /api/campaigns/test-campaign/notes` → 409
`conflict:true`; the row is never saved; reloading the list and retrying
produces the identical 409 forever (the player can never include a row the
server deliberately hides from them). Screenshot: `op-visitor-notes-409.png`.
Console shows the 409 as the only error. The leaked label comes from the
server-side `noteRowLabel` (partyLocation, else 40-char description excerpt —
notes.js:11-22), i.e. a player can mine private-note content one probe at a
time.

## Likely location

- `src/components/sidebar/Sidebar.jsx` — notes entry lacks `localhostOnly: true`
  (compare npcs/quests/sessions/settlements entries).
- `server/routes/notes.js` — `transformList` hides private rows from players
  (:40-45) while the whole-array POST/DELETE lanes inherited from
  `server/utils/jsonEntityCrud.js` (~:282-315, blind-overwrite guard
  `findConcurrentWrite`) demand the sender's snapshot include every disk row —
  the two designs are mutually unsatisfiable for a visibility-filtered lane.
- `conflictErrorBody` labels the invisible row by its private content.

## Suggested fix

Decide the lane's authority (GM-only is the consistent reading). GM-only fix:
add `localhostOnly: true` to the sidebar entries list for Notes AND a
`refuseUnlessGm`-style gate on the notes POST/PUT/DELETE lanes (reads stay as
is), so players get an honest read-only view instead of a doomed editor.
Player-authoring fix (if chosen instead): key the concurrent-save guard only
on rows VISIBLE to the requester (the factory would need to run the writer's
`transformList` filter before diffing), and stop labelling conflict rows from
content the sender was never allowed to see. Either way, add a player-origin
regression test alongside `notes-localhost-guard.test.js`.

## Severity

Broken feature (a player-visible button can never succeed, with an unrecoverable
retry loop) plus a minor data-integrity/privacy leak (private-note labels
exposed in the conflict copy).

## Resolution

**FIXED 2026-11-12 (fix run) — option (a) shipped: Notes is a GM-authoring
lane**, consistent with the GM-features-localhost-only doctrine and the
recommendation above. The triage's diagnosis was confirmed exactly (live repro
before touching code): visitor-origin New Note → Save → `POST
/api/campaigns/test-campaign/notes` → 409 `{"conflict":true}` naming the
private fixture ("Note \"Skull Creek Cave\" was created or deleted in another
tab or session…"), the banner rendered in the visitor tab, and "Reload list"
could never fix it.

### What was wrong

As diagnosed: `server/routes/notes.js` filtered `isPrivate` rows out of
non-localhost READS (`transformList`) while the whole-array POST/DELETE lanes
inherited from `server/utils/jsonEntityCrud.js` demand the sender's snapshot
include every disk row (`findConcurrentWrite`'s dropped-row leg) — mutually
unsatisfiable for a visibility-filtered lane — and the sidebar entry lacked
`localhostOnly`, so players got a doomed editor whose rejection copy leaked
the hidden row's label.

### What changed

- `server/routes/notes.js` — the factory router is now wrapped by a
  `refuseUnlessGm` gate (mirrors `maps.js` / `campaigns-character.js` /
  `inventory.js`: canonical `403 {"error":"Access denied: GM-only feature"}` +
  `[notes] BLOCKED non-localhost …` dev-log line). Non-GET requests to
  `/api/campaigns/:campaign/notes*` (whole-array POST, per-row DELETE, and any
  future PUT) are refused BEFORE the concurrent-save guard ever runs; reads
  keep the existing `isPrivate` filter/403 behavior unchanged. The wrapper
  pattern (guard middleware + `router.use(baseRouter)`) was required because
  the shared factory exposes no write-hook; the shared util was left untouched
  so no sibling lane's behavior changes.
- `src/components/sidebar/Sidebar.jsx` — notes nav entry gains
  `localhostOnly: true` (visitors simply don't get the Notes button — the
  established sibling behavior for npcs/quests/sessions/etc.; no new read-only
  face invented).
- `src/components/sidebar/Sidebar.test.jsx` — mirrored NAV_BUTTONS table:
  Notes marked `localhostOnly` (existing GM/PLAYER split tests now cover the
  visibility contract).
- `server/routes/notes-write-localhost-guard.test.js` — NEW regression test
  alongside `notes-localhost-guard.test.js`: LAN/foreign Hosts POST (exactly
  the player's private-less snapshot) / DELETE / PUT ⇒ 403 GM-only, disk byte-
  inert, no `notes-list` broadcast, and the body NEVER contains the private
  row's label ("Skull Creek Cave"/secret description); localhost POST/DELETE
  unchanged (200, stamped rows, broadcasts); visitor GET lanes stay open with
  the filter intact.
- `docs/test-setup-playbook.md` — §2 Planner-CRUD bullet write-authority
  clause corrected IN PLACE (was "notes has NO origin write gate").

### Leak follow-up (checked as instructed)

With writes gated, no visitor-reachable Notes lane can trigger the conflict
copy (POST/DELETE 403 first; GET-by-private-id still answers the label-free
`Access denied: private note`), so THIS lane's leak is dead. But the same
probe against the sibling **quests** lane still leaks: reads hide every row
from visitors (`transformList` ⇒ `[]`) while its POST is ungated, so a
visitor-origin `POST {quests:[]}` 409s naming the hidden row — LIVE-PROVED
against test-campaign (`Quest "The Lost Artifact" was created or deleted…`,
probe inert). Filed as `bug-quests-write-lane-no-gm-guard-leaks-hidden-quest-labels.md`.
Sessions has the whole-array-write shape but NO visibility filter at all
(reads return the full list), so it cannot deadlock nor leak hidden labels —
its zero-guard exposure remains the separate open
`bug-sessions-lane-no-gm-write-guard.md` (suggested fix there now has a
copyable pattern in `notes.js`).

### Verification

- Live repro (pre-fix, LAN-IP tab :5173): 409 + leaked label, as above.
- Live re-verify (post-fix, LAN-IP tab): sidebar shows NO Notes button
  (nav = Campaigns/Initiative/Inventory/Log/Map/Music/Rules); in-tab
  `POST /api/campaigns/test-campaign/notes` → 403 `Access denied: GM-only
  feature`; curl matrix from Host `192.168.0.44:5173`: POST 403, DELETE 403,
  GET private id 403 `Access denied: private note` (unchanged), GET list 200
  filtered `{"notes":[]}`; dev log shows the three honest `[notes] BLOCKED`
  census lines.
- GM sanity (localhost tab): Notes present; UI create "Fixverify Tower"
  landed (list + disk), UI delete rode the byte-pinned native confirm
  `Delete Note "Fixverify Tower"?` and removed the row; fixture row restored
  byte-exact — `notes.json` md5 `836a3fb683ad480c39ee61a68be00707` (baseline).
- Tests: `notes-write-localhost-guard` 18/18; touched folders
  (`server/routes` + `src/components/sidebar` + `src/components/notes`)
  115 files / 1724 tests PASS; full `npm run test:run` green; `npm run lint`
  zero warnings.
- Exit state: change-data `{}` + log `[]` (curl admin clears), notes fixture
  intact, `git status --porcelain public/campaigns/` empty, servers killed by
  port-PID.

