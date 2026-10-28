# Bug: POST character create accepts minimal payloads — selecting such a character CRASH-SILENTS the sheet, leaving the PREVIOUS character's full body (with LIVE Edit/Delete buttons) under the new character's header

## Summary
`POST /api/campaigns/:campaign` (server/routes/campaigns-character.js:218) accepts a character object missing required sections (e.g. no `class.subclass`, no `inventory.magicItems`) with 201. When such a character is then selected, `CharSheet.jsx` `fetchData()` (~line 308-330) calls `rulesFactory.getPlayerStats()`, which THROWS on the missing fields (`rules-magicItems.js:8-11` throws `Missing array: inventory.magicItems`; `rules-proficiencies.js:~149` throws on missing `starting_proficiencies`). `fetchData()` has NO `.catch` → the rejection is swallowed → `setPlayerStats` never runs → the sheet keeps rendering the PREVIOUS character's entire body while the header/title/sidebar show the newly-selected one. Worst leg: the visible `Delete "X"` / `Edit "X"` buttons (aria-labels derive from the stale playerStats) are LIVE — clicking Delete mutates the WRONG character.

## Steps to reproduce
1. In `test-campaign`, ensure a normal character is loaded in the sheet first (e.g. `AasimarTest` from the registry).
2. Create a minimal-payload character via API: `POST /api/campaigns/test-campaign` with the `{character:…}` envelope containing only e.g. `{name: "QA Minimal Probe", rules: "2024"}` (no `class`, no `inventory.magicItems`) → 201, file written.
3. Reload / re-select if needed, then click the new character's sidebar link.
4. Observe: header/title/sidebar show `QA Minimal Probe` but the sheet BODY still renders the PREVIOUS character (AasimarTest's stats, actions, and its aria-labelled `Edit "AasimarTest"` / `Delete "AasimarTest"` buttons). Console shows the thrown rules error (uncaught rejection), no error UI, no toast.
5. (Hazard leg — do NOT complete it destructively; catch/dismiss the confirm) Clicking the visible `Delete "…"` button targets the WRONG (stale) character.

## Expected behavior
- The create boundary should reject characters missing sections the rules engine requires (400 with a clear error), and/or
- `CharSheet.fetchData()` must have a `.catch` that surfaces an honest error state for the selected character instead of silently leaving the previous character's live body on screen.

## Actual behavior
201 on incomplete shape; on selection the rules modules throw, the promise rejection is unhandled, `setPlayerStats` never runs, and the sheet is a stale-body impostor with live wrong-entity mutation buttons. Verified live during run Q (2026-10-28) — recorded in `docs/app-exploration.md` "CharSheet crash-silent" row: wrong-entity mutation observed live with the confirm dismissed before accept (no mutation occurred only because the confirm was caught).

## Likely location
- `server/routes/campaigns-character.js:218` (POST create) — validates only presence of a name, not the section shape the rules engine needs. PUT/rename lanes may share the hole.
- `src/components/char-sheet/CharSheet.jsx:~308-330` — `fetchData()` effect with no `.catch`; `rules-magicItems.js:8` and `rules-proficiencies.js:~149` throw on missing arrays.

## Suggested fix
Two legs, minimal:
1. Client: add a `.catch` to `fetchData()` that logs via `console.error` and sets an error state so the sheet renders an honest "could not load this character" card for the selected char (clearing the stale body and its live Edit/Delete affordances) rather than the previous character's impostor. Mirror any existing error-state pattern used by sibling views (ErrorBoundary degraded card is view-crash only — a caught async rejection needs an in-component state).
2. Server: shape validation on create (and rename PUT) rejecting payloads missing required sections with 400. Enumerate the truly-required minimum by reading the rules engine's throw sites — do NOT over-validate beyond what breaks the sheet.
Fix to canonical rule data: `public/data/` and `public/data/2024/` are ground truth for required character sections.

## Severity
Data integrity / wrong-entity mutation hazard — a GM selecting an API-created incomplete character sees and can act on the PREVIOUS character's live sheet (delete/edit the wrong entity) with no visible error.

## Resolution
FIXED (2026-10-28 run R). Reproduced live exactly as described (Vite :5173, test-campaign): AasimarTest loaded → API-created `QA Minimal Probe` `{name,rules}` → 201 + file on disk → selected it → header/title/sidebar showed the probe while the BODY kept rendering AasimarTest with LIVE `Edit "AasimarTest"` / `Delete "AasimarTest"` buttons; console showed the uncaught rejection. Hazard leg walked with the confirm PRE-ARMED and DISMISSED (no mutation): the native confirm named `Delete character "AasimarTest"?` — the WRONG (stale) character — while the probe was selected.

### What was actually wrong (vs the original guess)
Both diagnosed locations were correct, but the live first throw site differs: the minimal `{name,rules}` payload dies EARLIER than the filed sites — at `classRules2024.js:81` / `classRules.js:30` (`playerSummary.class.name` TypeError, `class` absent), only later families reaching rules-magicItems/rules-proficiencies. Live re-verification further surfaced TWO MORE truly-required sections the bug file missed:
- `class.major`/`class.subclass` (named object) — 2024 proficiencies `bonusSource` throws `Missing object: class.major` even for a REAL class without a subclass pick (the wizard hard-gates subclass, so all legitimate chars carry one);
- `abilities` (non-empty array) — `rules-initiative.js:17-18` dereferences the Dexterity entry unconditionally (`dexAbility.bonus` TypeError).
Both were proven live end-to-end (subclass-less/abilities-less creates crash the sheet; wizard-shaped equivalents load cleanly), so the guard covers all four — nothing more (no name-existence validation against rule data; the client error card covers that residual honestly).

### Changes
- `server/routes/campaigns-character.js` — new `missingCharacterSections()`/`refuseIncompleteCharacter()` + guards on BOTH write lanes that take a full character body: POST create (400 AFTER the duplicate-name guard keeps its precedence) and PUT save/rename (400 AFTER the 404 file-exists check, BEFORE the rename unlink → rejected PUT is fully disk-inert). PATCH (deep-merge into existing) and the runtime change-data lane intentionally untouched.
- `src/components/char-sheet/CharSheet.jsx` — `fetchData()` now wraps the whole pipeline in try/catch: `console.error` + `statsLoadError` state + `setPlayerStats(null)`; on error the component renders an honest `role="alert"` "Could not load <name>" card (reusing the global `.ct-container`/`.ct-empty-state` pattern, ErrorBoundary twin) BEFORE the `!playerStats` guard, so the previous body and its live Edit/Delete affordances are cleared. Success clears the error (select-away recovery).
- `src/components/char-sheet/CharSheet.css` — scoped `.char-sheet-load-error` error tint (no inline styles, no !important).
- Tests: NEW `server/routes/campaigns-character-shape-guard.test.js` (13: minimal→400 disk-inert, string-class→400, missing magicItems→400, subclass-less→400, empty abilities→400, blank race name→400, dup-name precedence→400, valid 5e AND 2024 create→201, minimal PUT→400 disk-inert incl. rename-unlink, valid PUT→200, 404 precedence); NEW `src/components/char-sheet/CharSheet.stale-body-error.test.jsx` (3: stale body REPLACED by error card on rejected load — char-summary/char-sheet testids gone, card names the SELECTED char, console.error asserted; first-load-failure card; recovery to healthy sheet). Updated 4 sibling route tests whose fixtures encoded the old broken acceptance (`{class:'Fighter'}` string bodies etc.) to the wizard-shaped `VALID_SECTIONS`; 400-precedence lanes left byte-identical.

### Verification
- `npx vitest run` on the 2 new files (16 pass), then all 6 `campaigns-character*` files (96 pass), then `src/components/char-sheet` + `server/routes` (605 files/6,480 pass), then FULL suite: 2,873 files / 31,919 passed + 3 expected-fail, exit 0 — zero regressions. `npm run lint` zero warnings; `no-timers-guard` OK.
- Live (:80 restarted with lock re-proven; browser on :5173 current source): minimal POST → 400 `Character is missing required data: race…, class…, abilities…, inventory.magicItems…` with NO file on disk; the pre-fix planted broken char selected → honest error card for the probe, ZERO aria Edit/Delete mutation affordances, no `.char-sheet`; wizard-shaped 2024 AND 5e API creates → 201, sheets load normally, `Edit/Delete "<correct char>"` aria labels; subclass-less PUT → 400 disk-inert, repaired PUT (adds subclass+abilities) → 200 and sheet recovers. Cleanup: all 3 probes API-deleted + disk-verified gone, registry PCs byte-untouched (mtimes 11:51, AasimarTest GET re-reads intact), change-data `{}` + log `[]` from quiet tabs, zero campaign-lock denials.
