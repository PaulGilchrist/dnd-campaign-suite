# Bug: Toolbar Save with a loaded encounter silently PUTs over the saved file (no confirm, no update copy)

### Summary
When an encounter is loaded (toolbar Save title flips to `Update encounter`, `currentEncounterName` set), a single click on toolbar Save immediately `PUT`s the current draft over the saved encounter file on disk — with zero confirmation and a success toast copy (`Encounter saved`) identical to the create lane. A misclick silently overwrites durable campaign data, and the user gets no signal that an *update* (vs a fresh save) just happened. Live-proven 2026-10-28 improve run: one probe click overwrote `test-encounter`, dropping its `round`/`activeCreatureName`/`creatures` keys; recovery required reconstructing bytes from the page network log.

### Steps to reproduce
1. localhost:5173, campaign `test-campaign`, Encounters page.
2. Toolbar `Load encounter` → click `Load "<name>"` on an existing saved encounter → draft re-arms, toolbar Save title flips to `Update encounter`.
3. Optionally mutate the draft (change a qty, add/remove a monster).
4. Single-click toolbar `Save encounter`/`Update encounter`.

### Expected behavior
Either (a) a NAMED native confirm per house convention for overwrite-of-durable-data ("Overwrite encounter \"<name>\"? …"), consistent with delete/rename confirms across the app, or (b) at minimum an honest update-specific toast (`Encounter updated`) so the write is unmistakably surfaced. Judge which fits the current codebase during the fix (see Notes); (b) is the floor, (a) is preferred if it doesn't add friction to legitimate frequent saves.

### Actual behavior
Direct `PUT /api/campaigns/:c/encounters/:name` on one click, no confirm, toast reads `Encounter saved` (same as create). The update also *replaces* the stored record body with only `{selectedMonsters, description, effectiveXP}` + preserved `name`/`savedAt` — any extra keys previously stored on the encounter are silently dropped server-side.

### Likely location
Confident: `src/components/encounter/EncounterBuilder.jsx` `handleSaveEncounter` (:355–378) — `if (currentEncounterName) { await updateEncounter(...); showToast('Encounter saved'); } else { openSaveModal(); }`. Service: `src/services/encounters/encountersService.js` `updateEncounter` (PUT). Server replace-semantics: `server/routes/encounters.js` PUT handler (:64+).

### Suggested fix
- Toast honesty: update lane shows `Encounter updated` (create lane keeps `Encounter saved`). Pin both in tests.
- Overwrite protection: NAMED confirm on the update lane before the PUT (`Overwrite encounter "X"? This replaces the saved encounter.`), handled with the standard MCP dialog lane; Cancel leaves draft + disk untouched. If the confirm is judged too heavy for frequent GM iteration, fall back to toast-honesty ONLY and record the adjudication in the Resolution.
- Do NOT change server replace-semantics in this ticket (key-preservation is a separate design question).

### Severity
Moderate — silent irreversible-ish overwrite of durable campaign data on a single misclick; unlike deletes (all NAMED-confirm per house canon) this lane has no friction at all.

## Notes (triage 2026-10-28)
House canon: every destructive/durable-data mutation carries a NAMED native confirm (character delete, map delete modal, encounter-delete row `Delete "X"?`, level-change confirm, faction/quest/session/settlement/NPC/note deletes). The update-save lane is the outlier. Adjacent already-fixed behavior: Apply-over-draft now toasts `Draft replaced by generator` (bad3f6e86) — same feedback-density doctrine.

## Resolution

**Status: FIXED — 2026-10-28 (update-save confirm + toast honesty, adjudicated option (a)+(b): named confirm AND honest update copy).**

### Root cause
`handleSaveEncounter` (`src/components/encounter/EncounterBuilder.jsx`) took the update lane
(`currentEncounterName` set) straight to `await updateEncounter(...)` on a single toolbar click —
no confirm anywhere on the path (unlike every other durable-data mutation in the app) — and
reused the create-lane toast copy `Encounter saved`, so an overwrite was both frictionless and
indistinguishable from a fresh save.

### Changes
- `src/components/encounter/EncounterBuilder.jsx` — `handleSaveEncounter` update lane now gates
  the PUT behind a NAMED native confirm at the click point (the toolbar button IS the click point
  for this lane — no leaf modal, so unlike delete, the confirm lives in the builder; same
  window-confirm house lane as the row delete at `EncounterModal.jsx:68` and the level-change
  wizard prompt). Exact final copy (formatted display name, mirroring the row-delete style):

  `Overwrite encounter "QA Update Bug"? This replaces the saved encounter.`

  Cancel → early return: zero network, draft + disk untouched, no toast. Accept → PUT proceeds,
  success toast is now `Encounter updated` (create lane + failure copy `Encounter saved` /
  `Failed to save encounter` byte-unchanged; create path never sees the confirm).
- `src/components/encounter/EncounterBuilder.update-save-confirm.test.jsx` — NEW lane: cancel leg
  (exact confirm bytes + zero `updateEncounter` + zero toast after load-toast auto-hide), accept
  leg (confirm once → `updateEncounter` once → `Encounter updated`, negative-pinned against
  `Encounter saved`), create lane unaffected (name-modal opens with ZERO confirm, modal save
  toasts `Encounter saved`, `updateEncounter` never called).
- `src/components/encounter/EncounterBuilder.toast.test.jsx` — update-toast expectation flipped to
  `Encounter updated` (confirm stubbed true; copy shape regex-pinned since `formatEncounterName`
  is mocked in that lane); update-PUT-failure leg stubs confirm too.
- `src/components/encounter/EncounterBuilder.additional-interactions.test.jsx` — in-place-update
  leg stubs confirm true and pins exact formatted copy `Overwrite encounter "Crag Mole Lair"? …`.
- `server/routes/encounters.js` — NOT touched (criterion 3: replace-semantics stay out of scope).

### Tests / lint
- New+adjacent EB lanes: 8 files / 31 tests green.
- Full suite (`npx vitest run`): **2880 files passed, 31,963 passed + 3 expected-fail, 0 failed**.
- `npm run lint`: zero warnings.

### Live evidence (test-campaign, :5173, throwaway rig — no pre-existing encounter ever written)
- Empty-draft Save (no monsters): inline `Encounter has no monsters to save`, ZERO confirm,
  ZERO network (fetch spy) — gate precedes the confirm and is unchanged.
- Create lane: drafted 1×Goblin → toolbar Save → name-modal (NO confirm fired) typed `QA Update Bug`
  → toast `Encounter saved`, 1 POST, disk row created; title flipped to `Update encounter`.
- Cancel leg (draft bumped to qty 2, `confirm→false` recorder): confirm shown with EXACT bytes
  `Overwrite encounter "QA Update Bug"? This replaces the saved encounter.`; network: `[]`;
  no toast; disk GET still `qty:1` (untouched); toolbar still `Update encounter`.
- Accept leg (`confirm→true`): same single confirm, exactly ONE
  `PUT /api/campaigns/test-campaign/encounters/QA%20Update%20Bug`, toast `Encounter updated`
  (no error class), disk GET `qty:2`/`effectiveXP:100`.
- Adjacent sanity: Load rows aria `Load|Rename|Delete QA Update Bug` (unquoted — playbook
  checkbox-aria family extends to these rows); `Load QA Update Bug` → toast `Encounter loaded` +
  title `Update encounter` + draft re-armed (Goblin qty 2); Generate modal opened/closed;
  Reset cleared draft (title back to `Save encounter`); Join → `Goblin 1`/`Goblin 2` on the
  Initiative board.
- Cleanup: Initiative Clear (named confirm accepted), row Delete fired
  `Delete "QA Update Bug"?` + 1 DELETE → GET 404, encounters back to baseline 31 (zero QA rows);
  browser closed, Admin clear-change-data + clear-log → `{}` / `[]` API-verified; pre-existing
  `test-encounter` never opened (snapshot untouched). Zero console errors/warnings all session.

### Adjudication
Bug filed "(b) toast honesty is the floor, (a) named confirm preferred". Chose **(a)+(b) together**:
the update PUT replaces durable campaign data with draft bytes (server replace-semantics DROP
extra stored keys — proven live in the filing run), i.e. it is destructive in exactly the sense
the house canon (character/map/encounter-row deletes, level-change, clear-combat) confirms for;
legitimate frequent GM saves are unaffected because the confirm only appears in the update lane
(loaded encounter + explicit toolbar Save), one Enter-key press, matching the sibling delete
confirm's density. Toast honesty rides along so the accepted write remains unmistakably surfaced.
Note: `formatEncounterName` title-cases per dash-word without lowercasing the rest
(`qa-update-bug` → `Qa Update Bug`), so the confirm shows the raw-case name for non-hyphenated
names and the dash-title-case of hyphenated ones — identical behavior to the row-delete confirm
(the formatter is the shared house display-name helper; unchanged here).

