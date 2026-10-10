# Settlements duplicate-name save silently overwrites existing settlement

## Summary
Creating a second settlement with an existing name shows no duplicate-name error and silently overwrites the original settlement's data (description, population, services, NPCs, rumors all replaced). NPCs, Quests, Factions, Sessions and Maps all have duplicate-name guards; Settlements was missed in the validation-parity pass.

## Steps to reproduce
1. In test-campaign, open Settlements.
2. Click "New Settlement", name it `QA Riverside Hamlet`, size Town, add Population, a Service (tavern "The soggy eel"), an NPC, a Rumor. Save → appears in list and persists to `public/campaigns/test-campaign/data/settlements.json` with all fields.
3. Click "New Settlement" again, enter only the same name `QA Riverside Hamlet`, leave other fields empty. Click Save.
4. Wait ~12 s for cache debounce, inspect the record.

## Expected behavior
Inline error "A settlement with that name already exists" and modal stays open (identical to the guard shipped for Quests/Factions in the duplicate-name-validation-parity fix, and Sessions, which also guards).

## Actual behavior
Save succeeds with no warning; modal closes. The existing record is overwritten in place (list count stays 2):
```
QA Riverside Hamlet | pop: (empty) | tavern: []
```
— population, description, service, notable NPC and rumor all destroyed.

## Likely location
Client-side: `src/components/settlements/Settlements.jsx` — missing the `hasDuplicateName`-style inline guard that `Quests.jsx` / `Factions.jsx` use. Server-side: `server/routes/settlements.js` has no `findDuplicateNameError`/`validateList` wiring, while `server/routes/quests.js` imports `findDuplicateNameError` from `server/utils/nameUniqueness.js` and passes `validateList: (quests) => findDuplicateNameError(quests, 'quest')` into `createJsonEntityCrud` (`server/utils/jsonEntityCrud.js:24,63`). Confidence: high (verified by grep).

## Suggested fix
Mirror the quests pattern verbatim: in `server/routes/settlements.js` add `validateList: (settlements) => findDuplicateNameError(settlements, 'settlement')`, and in `Settlements.jsx` add the client inline error branch mirroring `Quests.jsx`.

## Severity
Data integrity risk — a mis-click on "New Settlement" can silently erase a fully-populated settlement.

## Resolution
FIXED 2026-10-10.

### What was actually wrong
The bug file's diagnosis was directionally right but incomplete on the server side. Settlements are saved via the **custom PUT upsert route** (`PUT /api/campaigns/:campaign/settlements/:name` in `server/routes/settlements.js`), not the POST full-array route — so `validateList`/`findDuplicateNameError` alone (the quests pattern) would never have fired for the repro. The correct server sibling pattern is the **npcs.js PUT rename guard** (same `idField: 'name'` upsert mechanic). Two gaps existed:
1. **Client:** `Settlements.jsx` had no `hasDuplicateName`-style inline guard at all — save went straight to the server.
2. **Server:** the PUT upsert overwrote in place whenever `existingIndex !== -1` (which covers both edits and accidental same-name creates), and rejected nothing; the POST route also lacked `validateList`.

### Files changed
- `src/components/settlements/Settlements.jsx` — added `error` state + `hasDuplicateName()` guard in `handleSave` (mirrors `Factions.jsx`/`Quests.jsx`: case-insensitive, self-edit exempt via `editingSettlement.name`), inline `.settlements-form-error` div in the modal body, error cleared on new/open/close, server-rejection message surfaced inline.
- `src/components/settlements/Settlements.css` — `.settlements-form-error` (mirrors `.quests-form-error`/`.npcs-form-error`).
- `server/routes/settlements.js` — PUT guard mirroring `npcs.js`: empty name → 400 "Settlement name is required"; case-insensitive rename collision against another settlement → 400 "A settlement with that name already exists" (data untouched); plus `validateList: (settlements) => findDuplicateNameError(settlements, 'settlement')` on the router factory for the POST seam (quests pattern).
- `server/routes/settlements-file-io.test.js` — the hand-replicated PUT router + its stale "case-sensitive matching allows duplicates" test updated to the parity guard (replica must mirror the real route).
- `server/routes/settlements-real-route.test.js` — same stale case-sensitivity pin updated to assert 400 + untouched data.
- NEW `server/routes/settlements-duplicate-name.test.js` — PUT rename-collision / self-edit / unique-rename / empty-name / create + POST validateList tests (mirrors `npcs-duplicate-name.test.js` + `quests-duplicate-name.test.js`).
- NEW `src/components/settlements/Settlements.duplicate-name.test.jsx` — locks the exact broken behavior: duplicate-name save shows the inline error, keeps the modal open with data intact, and never calls `saveSettlement`; self-edit and unique create still pass.

### Verification
- **Live repro (pre-fix, test-campaign):** created `QA Riverside Hamlet` (pop 1,200 souls, tavern "The soggy eel", NPC Mara Dockmaster, rumor) → new settlement, same name only, Save → no error, modal closed, disk record wiped to `pop: '' | tavern: [] | npcs: [] | rumors: []`. Bug confirmed exactly as filed.
- **Live re-verification (post-fix, test-campaign):** dup save → inline error `A settlement with that name already exists` (class `settlements-form-error`), modal stays open, name preserved, nothing saved. Case-insensitive variant (`qa riverside HAMLET`) also rejected inline. Original record intact on disk (`pop: '1,200 souls'`, tavern/NPC/rumor present). Sanity: legit edit of the settlement persisted; legit unique create (`QA Guard Hamlet`) succeeded and listed.
- **Tests:** `npx vitest run` on both new files + all settlements component tests + 4 settlements route files → **15 files / 164 tests passed** (exit 0). `npm run lint` → **0 errors, 0 warnings** (exit 0).
- **Cleanup:** both QA settlements deleted via UI (disk back to only pre-existing Ironhaven); Admin → Clear Change Data + Clear Campaign Log verified (`/api/campaigns/test-campaign/log` → 0 entries, `change-data` → 0 keys).
