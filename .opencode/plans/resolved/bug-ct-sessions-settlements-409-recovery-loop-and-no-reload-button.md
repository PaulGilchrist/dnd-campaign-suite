# bug-ct-sessions-settlements-409-recovery-loop-and-no-reload-button.md

## Summary
The `9cee7bfa2` close-consumes-skipped-SSE recovery machinery and the `ee4f9f177` one-click "Reload list" banner button were wired into the four `.ct-*` array lanes (NPCs, Notes, Factions, Quests) but NOT into Sessions or Settlements. A 409 concurrent-edit conflict in those two lanes therefore dead-ends: closing and reopening the editor in-view re-seeds the STALE row, so the banner's own instruction ("reload the list and re-apply your edit") loops the same 409 indefinitely until a full page reload or view remount.

## Steps to reproduce
(In `test-campaign`, single browser tab on `http://localhost:5173`; server on :80 or Vite proxy.)

1. Sidebar → Sessions. Create a session (or `PUT /api/campaigns/test-campaign/sessions/QA%20Sess%20UI2` body `{name:"QA Sess UI2", date:"2026-10-27"}`).
2. Click the session row to open its editor.
3. While the editor is OPEN, from another "tab" (curl/Code Mode) bump the row on disk: `PUT /sessions/QA Sess UI2` with a fresh-echo body changing `date` to `2026-11-09` → 200 (disk re-stamps synchronously; the SSE list refresh is skipped while the editor is open).
4. In the open editor, make any live edit and press **Save** → **409**, inline banner `.sessions-form-error` reads `Session "QA Sess UI2" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.` — note there is **no "Reload list" button** (compare `.npcs-error-reload-btn` on the NPCs lane).
5. Press **Cancel**, then click the same row again to reopen — the date field re-seeds `2026-10-27` (the STALE pre-bump value), not `2026-11-09`.
6. Press **Save** again → the **same 409** repeats. Repeat step 5-6: identical 409 forever.

Settlements lane reproduces identically (`.settlements-form-error`, reopen re-seeds stale fields, second Save 409s again). All steps live-proven 2026-10-27 (run I). Only a full `page.reload()` (or sidebar→character→back view remount) breaks the loop.

## Expected behavior
Parity with NPCs/Notes/Factions/Quests: the 409 banner carries a "Reload list" button, and closing any `.ct-*` editor consumes the list broadcast that was skipped while editing so a reopen seeds fresh stamps and the re-applied edit saves 200.

## Actual behavior
- Banner text instructs "reload the list" but offers no button and no in-view refetch on close.
- Reopen re-seeds stale stamps → guided recovery loops the identical 409 (reproduced live in BOTH Sessions and Settlements lanes).
- Drafts are preserved (no data loss), but the user's edit is unsavable without discovering an undocumented page reload.

## Likely location
High confidence (grep-proven): `missedListBroadcast` appears 10× in `src/components/npcs/NPCs.jsx` and 8× in `src/components/factions/Factions.jsx` but **0×** in `src/components/sessions/Sessions.jsx` and `src/components/settlements/Settlements.jsx`; neither renders `errorConflict && onReloadList`. The playbook itself flagged this as the "natural follow-up pair" after `ee4f9f177`. Services already set `err.conflict` (dce3b5249), so the discriminator reaches the components — only the render + close-refetch legs are missing.

## Suggested fix
Port the two proven pieces from the Factions lane:
1. Track `missedListBroadcast` on the save-409 and on session/sse list events while an editor is open; on editor close, if missed, refetch the list (the `9cee7bfa2` pattern).
2. Render the banner through a `showError(message, conflict)` choke point and add `errorConflict && <button className="sessions-error-reload-btn">Reload list</button>` (settlements twin) wired to `{ missedListBroadcast.current = true; handleClose(); }`.

## Severity
Minor UX issue with data-frustration risk: no silent corruption (the guard correctly refuses and drafts survive), but the sanctioned recovery is a proven infinite loop on two lanes — the exact dead-end `9cee7bfa2` was created to eliminate, just un-shipped there.

## Resolution

**FIXED 2026-10-27 (fix run J).** Root cause confirmed as diagnosed — with one correction to the mechanism.

### What was actually wrong
The `9cee7bfa2` stale-close machinery and the `ee4f9f177` "Reload list" banner button live **per-component** (duplicated verbatim in NPCs/Factions/Notes/Quests — there is NO shared `.ct-*` hook carrying them; `useCrudList`/`useEntityManagement` were never involved), and neither leg was ever added to Sessions or Settlements. A rejected 409 save therefore left the in-memory list stale, and Cancel→reopen re-seeded the stale row → identical 409 forever.

**Correction to "Likely location":** the SSE "skipped-while-editing" leg is structurally inapplicable to these two lanes — `server/routes/sessions.js` and `server/routes/settlements.js` publish **no** `sessions-list-*`/`settlements-list-*` SSE broadcasts at all (grep-proven; only npcs/factions/quests/notes/maps/encounters routes `publish()` list events). A `Subscriber` would have been dead code. The **rejected-save leg** alone is the live staleness signal and fully closes the loop; this is documented in a comment at each `missedListBroadcast` declaration. Cross-tab live-mirroring of these two lanes (server broadcasts + `Subscriber` legs) remains separate un-shipped improve territory.

### Files changed
- `src/components/sessions/Sessions.jsx` — added `errorIsConflict` state, `showError(message, conflict)` choke point, `missedListBroadcast` ref (set on rejected save / move-link / mark-played; cleared on success/delete), `handleCloseModal` (consumes the miss → `loadItems()`), `handleReloadList`; wired `errorConflict`/`onReloadList`/`onClose=handleCloseModal` into the modal.
- `src/components/sessions/SessionPlannerModal.jsx` — banner now renders `errorConflict && onReloadList && <button className="ct-btn sessions-error-reload-btn">⟳ Reload list</button>` (NPCFormModal pattern verbatim).
- `src/components/sessions/Sessions.css` — `.sessions-error-reload-btn` (mirrors `.npcs-error-reload-btn`; `!important`-free, rides global `.ct-btn`).
- `src/components/settlements/Settlements.jsx` / `Settlements.css` — settlements twin (inline `SettlementModal`, `.settlements-error-reload-btn`).
- NEW tests: `src/components/sessions/Sessions.conflict-reload.test.jsx`, `src/components/settlements/Settlements.conflict-reload.test.jsx` — 4 lanes each (close-after-409 refetch + fresh reopen seed; Reload-list one-click closes+refetches then re-applied edit saves; non-conflict error shows NO button; clean close / successful save add no redundant fetches), mirroring `NPCs.stale-list-recovery.test.jsx` / `Quests.conflict-reload.test.jsx` conventions.

### Verification
- **Repro re-run pre-fix (live, :5173, header `test-campaign`):** Sessions — curl-bump date while editor open → Save → 409 banner verbatim, **no** Reload button; Cancel→reopen re-seeded stale `2026-10-27`; second Save → identical 409. Settlements — same on Ironhaven (stale notes re-seed, identical 409 repeat). Bug 100% real on both lanes.
- **Post-fix live walk, BOTH lanes:** 409 banner carries working `Reload list` button → one click closes editor + refetches (list row shows other-tab value) → reopen seeds FRESH (form shows the other-tab value) → re-applied edit **saves 200** (disk-verified: session date `2026-12-01`, settlement notes coexist). Negative control: dup-name New Settlement → banner `already exists` with **no** Reload button. NPCs lane sanity: Marta row/editor open fine. Console: only Chrome's own un-suppressable `409` status lines from deliberate probes; zero app-level errors.
- **Tests:** new files 8/8 pass; `src/components/sessions` + `src/components/settlements` 16 files/108 pass; siblings untouched (npcs/factions/quests/notes) 22 files/223 pass; full `npm run test:run` green (see run log). `npm run lint` zero warnings.
- **Baseline restored:** `QA Sess UI2` deleted (sessions `[]`); Ironhaven content byte-restored from pre-run capture (permanent `updatedAt` bootstrap from my accidental legacy-lane probe save is by-design run-G behavior); Admin clear-change-data + clear-log accepted (native confirms handled), API-verified `{}` / `[]` from closed-tab quiet; zero campaign-lock denials in dev log.

### Summary
Ported the 9cee7bfa2 stale-close recovery + ee4f9f177 "Reload list" banner button into the two lanes that never received them (Sessions, Settlements): rejected 409 saves now mark the list stale, editor close consumes the refresh so a reopen re-seeds fresh stamps, and the conflict banner offers one-click recovery. (No SSE Subscriber leg — these routes publish no list broadcasts.) Live-proven both lanes: 409 → Reload list → fresh reopen → re-applied edit saves 200; non-conflict errors show no button. 8 new regression tests; lint clean.
