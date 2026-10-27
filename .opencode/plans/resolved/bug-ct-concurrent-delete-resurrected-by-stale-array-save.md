# Bug: concurrent-delete resurrection — stale `.ct-*` whole-array save silently revives a row deleted in another tab

## Summary
The 876f95f33 concurrent-save guard checks disk rows MISSING from the sender's array (409 "created or deleted"), but has no symmetric leg for incoming rows that no longer exist on disk. A tab holding a stale list (SSE refresh is intentionally skipped while its editor modal is open) that saves the whole array after another tab DELETED a different row re-creates the deleted row with HTTP 200 and zero feedback.

## Steps to reproduce
Confirmed twice live in test-campaign (2026-10-27, run G) — via UI, and via pure API:

UI leg (Notes lane):
1. Tab A: Notes view — list shows note Y. Remount the view so the list contains Y and probe note "QA RunG UI-resurrection probe" (id `qa-rung-x2`).
2. Open Y's editor (row click) and leave it open.
3. While the editor is open, DELETE the other note from another session: `curl -X DELETE /api/campaigns/test-campaign/notes/qa-rung-x2` → 200 success. (Tab A never learns: `Notes` skips the SSE list refresh while `modalOpen`.)
4. In Tab A, edit the description and click Save.
5. Observe: PUT/POST returns **200 `{"success":true}`**, no conflict banner.
6. GET `/api/campaigns/test-campaign/notes` → `qa-rung-x2` is back on disk, resurrected.

API leg (identical result, exact bytes):
1. `GET /notes` → snapshot [Y, X] (both carry current `updatedAt`).
2. `DELETE /notes/qa-rung-x` → 200.
3. `POST /notes` with the stale snapshot array (Y's description edited, both stamps fresh, X included) → 200.
4. `GET /notes` → X exists again.

Positive-controls (same session, all behaved correctly): omitting a disk row → 409 "Faction \"qa-dup\" was created or deleted…"; stale echoed stamp → 409 "…was modified…"; identical-content echo → 200 with stamp PRESERVED (no false conflict). So the guard is asymmetric by omission, not broken overall.

## Expected behavior
A whole-array POST whose payload still contains a row (with a numeric echoed `updatedAt`) that no longer exists on disk proves the sender read that row before it was deleted elsewhere — the write would undo someone else's delete. It should 409 with the same "reload the list and re-apply" guidance, exactly mirroring the existing missing-disk-row leg.

## Actual behavior
HTTP 200, `{"success":true}`, broadcast of a create, deleted entity resurrected — no console error, no UI feedback in either tab.

## Likely location
Confident: `server/utils/jsonEntityCrud.js` → `findConcurrentWrite()`. It builds `diskById`, flags (a) stale-stamp echoes and (b) disk ids absent from the incoming set — but never flags incoming ids absent from disk that carry an echoed `updatedAt` (a brand-new row has no `updatedAt`, so that discriminator is safe). Same file, guard block added by 876f95f33. Lane confirmed live for Notes (`Notes.jsx:288 saveNotesList(updatedNotes)` → whole-array POST); factions/quests ride the same factory + `useEntityManagement.saveItems`, so all `.ct-*` whole-array lanes are exposed. (NPCs save via per-entity PUT, unaffected.)

## Suggested fix
In `findConcurrentWrite`, after building `diskById`, add a third check while iterating incoming entities: if `existing === undefined` AND `incoming[idField] != null` AND `typeof incoming.updatedAt === 'number'` → return `{ id, reason: 'created or deleted' }` (or a new 'deleted elsewhere' reason). New-row creation (no echoed stamp) still passes untouched. One unit test twin of the missing-disk-row case; `sameEntityContent` unchanged.

## Severity
Data integrity risk — a peer session's delete is silently reverted with no conflict signal, defeating the exact race class 876f95f33 was filed to close; needs no special input, just the standard edit-open/other-tab-delete interleave.

## Resolution
FIXED 2026-10-27. The "Likely location" diagnosis was confirmed exactly: `findConcurrentWrite()` in `server/utils/jsonEntityCrud.js` had the stale-stamp leg and the missing-disk-row leg but no symmetric leg for an incoming row that disk no longer has.

**Fix (server-side, shared by every factory lane):** while iterating incoming entities, a row with a non-null id that is ABSENT from `diskById` AND echoes a numeric `updatedAt` now returns `{ id, reason: 'created or deleted' }` → 409 with the same "reload the list and re-apply your edit — it was NOT saved." copy as the existing legs (mirrors `conflictErrorBody` sibling; no new reason type, no client changes — `saveItems` throws the server message and the existing `.notes-form-error`/`.ct-*` banner renders it verbatim). Brand-new rows never echo a stamp (client `openNew` forms and `applyWorldProposal` quest drafts set no `updatedAt`; grep confirms no client sets it), so creation is untouched. Legacy unstamped ghosts stay writable (bootstrap contract from 876f95f33). Whole-array POST lanes covered: notes, factions, quests, sessions, settlements, npcs-POST.

**Files changed:**
- `server/utils/jsonEntityCrud.js` — resurrection leg in `findConcurrentWrite` + header comment.
- `server/utils/jsonEntityCrud.resurrected-save.test.js` — NEW regression lock (4 tests: resurrect→409+disk-inert; new-row no-stamp→200; deleted row with a still-fresh echoed stamp→409 (freshness proves nothing once disk forgot it); legacy unstamped ghost→200+stamped).

**Live verification (test-campaign, before/after):**
- PRE-fix repro: UI leg — Notes view with rows [Y, x2], opened Y's editor, `curl DELETE /notes/qa-resurrect-x2` → 200, edited description + Save → **POST 200 `{"success":true}`, zero banner, and the post-save list refetch showed x2 RESURRECTED** (disk-confirmed). Pure-API leg identical: stale snapshot POST after delete → 200, ids back on disk.
- The :80 API (plain `node server.js`, no watcher) was restarted in place (with express permission) to load the fix; Vite on :5173 untouched.
- POST-fix matrix (curl, exact bytes): resurrect attempt → **409 `note "qa-postfix-p1" was created or deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.`**, delete survives, rejected edit fully inert. Controls: legit fresh save → 200; omit-disk-row → 409 `created or deleted`; stale stamp → 409 `modified`; identical echo → 200 stamp PRESERVED; new-row creation → 200.
- POST-fix UI leg: same interleave → POST 409, `.notes-form-error` banner verbatim, modal + draft preserved, disk inert; recovery leg: close modal → broadcast-miss refetch drops the ghost row → reopen → save **200** no banner.
- Tests: `npx vitest run server/utils/` 11 files/414 pass; adjacent lanes (`server/routes/`, notes/quests/factions components, `useEntityManagement`) 70 files/1246 pass. `npm run lint` clean (zero warnings).
- Cleanup: all probe notes deleted, notes baseline byte-restored (permanent `updatedAt` stamp drift = run-G normal), change-data `{}` + log `[]` API-verified from quiet state, factions/quests/npcs baselines untouched, zero campaign-lock denials.

**Known residual (out of scope here, worth a follow-up):** the per-entity PUT-upsert lanes (`npcs`/`sessions`/settlements `PUT by :name`) still recreate a row deleted elsewhere when the sender echoes a stamp — `hasUpdateConflict(existing, incoming)` is null-safe against `existing === null`. The bug file's claim that NPC PUT is "unaffected" is therefore only UI-mitigated (delete broadcasts auto-close the stale editor + 9cee7bfa2 close-refetch narrow the window), not server-guarded. A one-line `existing === null && typeof incoming.updatedAt === 'number' → 409 'created or deleted'` in those three PUT handlers would close it symmetrically (rename flows are safe: PUT looks up by the OLD URL name).

