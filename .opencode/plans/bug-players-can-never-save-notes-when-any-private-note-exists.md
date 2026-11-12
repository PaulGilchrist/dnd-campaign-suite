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
