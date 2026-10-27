# bug-ct-editor-concurrent-save-silently-drops-other-tabs-edits

## Summary
Two tabs open on the same campaign edit the same `.ct-*` entity (e.g. an NPC). Tab B saves its field; Tab A — whose form was populated BEFORE B's save — then saves, and B's persisted edit is silently overwritten. There is no conflict detection, no freshness refresh of the open editor, and no feedback in either tab. Because the underlying save lane (`server/utils/jsonEntityCrud.js`) POSTs the ENTIRE entity array, a stale tab can also drop entities another tab created after the stale tab's list was fetched.

## Steps to reproduce
1. In `test-campaign`, create/rely on an NPC (e.g. "Marta Copperkettle") via NPCs page.
2. Tab A: NPCs page → select Marta → type `TAB-A-EDIT-DESC` into "Additional notes…" (do NOT save).
3. Tab B (new browser tab, same campaign): NPCs page → select Marta (form loads with notes empty) → type `TAB-B-EDIT-NOTES` into the same field → click Save (`.ct-btn-primary`). Verify persisted: `GET /api/campaigns/test-campaign/npcs` → notes == `TAB-B-EDIT-NOTES`.
4. Back to Tab A (never reloaded — verified via a planted `window.__tab='A'` marker): additionally type `TAB-A-EDIT-APPEARANCE` into "Physical description…", then click Save.
5. `GET /api/campaigns/test-campaign/npcs` (cache: reload).

## Expected behavior
Either B's saved edit survives (merge/per-field write), or at least one tab shows a conflict/stale-data warning ("this NPC was modified elsewhere — reload before saving").

## Actual behavior
Disk shows `notes: "TAB-A-EDIT-DESC"`, `appearance: "TAB-A-EDIT-APPEARANCE"`. B's persisted notes are gone. No toast, no error, no console message, no SSE-driven refresh of A's open editor fields (A's editor still showed its own stale content when B's save landed — the `npcs-list-<campaign>` broadcast updates the LIST but the open editor form is never re-based). Proven live 2026-10-27 with the exact values above.

## Likely location
- `server/utils/jsonEntityCrud.js` POST `/api/campaigns/:campaign/[entityName]` — "overwrite entire array" semantics (writeFileSync of the client-sent array, no version/ETag/updatedAt guard). Shared factory → same exposure for every consumer: npcs, factions, quests, settlements, sessions, notes (whatever uses createJsonEntityRouter).
- Client editors (e.g. `src/components/npcs/`) build the save payload from their mount-time snapshot and POST the whole list; the live-broadcast subscription updates the list pane but not the open form, and does not mark it dirty/stale.
Confidence: high on the server lane (read the route); medium on exactly which client component composes the whole-array payload (did not read the NPC client save call, but disk effect matches whole-array overwrite semantics).

## Suggested fix
Cheapest honest mitigation: refuse blind overwrites. Add an `updatedAt`/rev stamp per entity (or per file) returned by GET and required in the save; on mismatch return 409 and have the editor surface "changed elsewhere — reload". Alternative lane: switch saves to per-entity PUT (`/npcs/:id` exists for GET/DELETE already) so only the touched entity is written, and re-base any open editor whose entity is touched by an SSE `action:'replaced'`/`'updated'` broadcast when the form is not dirty. A full per-field merge is NOT needed — just don't let one tab's save rewrite rows it never read.

## Severity
Data integrity risk — a confirmed silent loss of already-persisted user data on any `.ct-*` entity lane when two tabs/GM sessions overlap. Uncommon in single-tab use, but campaigns are multi-session by design (SSE sync exists precisely for that), and there is zero feedback when it bites.

## Resolution
**FIXED 2026-10-27** (conflict detection: per-entity `updatedAt` stamp + 409 on mismatch + client surfaces "changed elsewhere — reload"; no full per-field merge, per the suggested minimal mitigation).

### What was actually wrong
The black-box guess was close but one lane off: the NPC page's main save is **not** the whole-array POST anymore — it is the hand-rolled per-entity **PUT** in `server/routes/npcs.js` (`NPCs.jsx handleSave → saveNPC → PUT /npcs/:name`). The PUT replaces the whole row object from the tab's mount-time form snapshot, so a stale tab still silently clobbers fields on the row it *did* read (exactly what the repro showed: B's notes rewritten by A's last-writer-wins PUT). The shared `jsonEntityCrud.js` whole-array POST (used by **factions, quests, notes**) additionally allowed dropping rows a tab never read. Neither lane had any freshness token; and Notes swallowed save failures entirely (`console.error` only).

### Changes
- `server/utils/jsonEntityCrud.js` — shared lane (protects every `.ct-*` consumer):
  - Every row written through the lane now carries `updatedAt` (epoch ms), returned verbatim by GET list/id so editors can echo it.
  - Whole-array POST refuses blind overwrites with **409** + `{ error, conflict:true }`: a row re-sent with an echoed stamp older than disk ("was modified in another tab or session … NOT saved"), or an omission of a disk row the snapshot never knew ("was created or deleted in another tab or session").
  - Stamps are monotonic per row and churn-free: unchanged content keeps its old stamp (tabs editing *other* rows never false-conflict); new/changed/legacy-unstamped rows get a strictly-greater stamp (a content-identical first save still closes the bootstrap gap).
  - Exports `hasUpdateConflict` / `sameEntityContent` / `stampForSave` / `conflictErrorBody` for the hand-rolled PUT lanes.
- `server/routes/npcs.js` — PUT checks the stamp **before** any image side effect (rejected save fully inert), then writes the stamped row and returns it.
- `server/routes/settlements.js`, `server/routes/sessions.js` — same guard/stamp on their hand-rolled PUTs (parity).
- `src/components/notes/Notes.jsx` + `Notes.css` — Notes was the only `.ct-*` page that swallowed save errors; added the `error` state + `.notes-form-error` modal banner (mirrors `.factions-form-error` etc.). NPCs/Factions/Quests/Sessions/Settlements already surfaced `err.message` from their services, which now carries the server's conflict prose verbatim — no client flow changes were needed elsewhere (forms spread the loaded entity, so the stamp rides through automatically).
- `docs/architecture.md` — jsonEntityCrud lane description updated.

### Verification
- **Live repro re-run** (test-campaign, dev:locked, :5173, two real tabs, `window.__tab` marker proving no reload): B saves notes → disk `TAB-B-EDIT-NOTES` + fresh stamp; stale Tab A (stamp S1, still showing its own draft) saves → **409**, modal shows verbatim `NPC "Marta Copperkettle" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.`, modal stays open, disk unchanged (B's notes survive). Recovery leg: reload → editor re-bases to B's notes → normal save succeeds, both fields persist. Broadcast sanity: temp NPC create/delete in Tab A mirrors live in Tab B's list without reload; baseline restored (Marta notes/appearance `''`, temp NPC deleted).
- **New tests** (all passing): `server/utils/jsonEntityCrud.concurrent-save.test.js` (11), `server/routes/npcs.concurrent-save.test.js` (6), `src/components/notes/Notes.concurrent-save.test.jsx` (3).
- **Folders**: server `.ct-*` lanes 455/455; whole `server/` suite 1607/1607; client npcs/notes/factions/quests/sessions/settlements + services 644/644; `npm run lint` zero warnings. Pre-existing "blind whole-array overwrite = 200" test expectations in 6 files were updated to assert the new 409/stamp contract (they lock the exact semantics this fix intentionally changed).
- **Accepted residuals**: (1) rows never saved under the fix are un-stamped until their first post-fix write (bootstrap; a no-op save closes it — factions/quests/notes lanes additionally had the drop-guard active immediately); (2) a stale save can *resurrect* a row another tab deleted (opposite anomaly, no stamp to compare); (3) open editors are still not auto-re-based by SSE while dirty — the conflict banner tells the user to reload (auto-rebase of clean forms was left out as beyond the minimal fix).
