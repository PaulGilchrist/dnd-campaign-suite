# Characters whose name contains spaces (or any non-alphanumeric char) are permanently undeletable from the UI

## Summary
The UI character-delete lane derives the on-disk filename with a **different recipe** than the one creation uses. Creation sanitizes `name.replace(/[^a-zA-Z0-9]/g, '_') + '.json'` (e.g. `QA RunP Wizard` → `QA_RunP_Wizard.json`), but delete builds `name.toLowerCase().replace(/\s+/g, '-') + '.json'` (→ `qa-runp-wizard.json`). The DELETE hits a nonexistent path, the server 404s, and the user just gets an alert — the character can never be removed from the UI.

## Steps to reproduce
Starting from a clean state in **test-campaign** (localhost, dev:locked):
1. Sidebar → **Add Character** → complete the 16-step wizard with any name **containing a space** (walk used: 5e → name `QA RunP Wizard` → race Human → class Fighter + subclass Champion → defaults through steps 7–16 → Save). The wizard creates `public/campaigns/test-campaign/QA_RunP_Wizard.json` (verify: `GET /api/campaigns/test-campaign` lists `QA_RunP_Wizard.json`).
2. With the new character's sheet open, click **Delete**, then accept the native confirm `Are you sure you want to delete this character? This action is irreversible.`
3. Observe: `alert("Failed to delete character: Failed to delete character: Not Found")`, console `DELETE http://localhost:5173/api/campaigns/test-campaign/qa-runp-wizard.json → 404`, and the character file still on disk and still in the sidebar.
4. Control: `DELETE /api/campaigns/test-campaign/QA_RunP_Wizard.json` (the TRUE filename) → 200 `{"message":"Character deleted successfully"}` and every connected tab live-removes the sidebar link (no reload) — proving the server lane and the SSE delete-mirror work; only the client filename recipe is wrong.

## Expected behavior
UI Delete removes the character (server call uses the same filename the create/save lane produced).

## Actual behavior
`DELETE /api/campaigns/:campaign/qa-runp-wizard.json` → 404 `Character file not found`; alert shown; character stays. **No retry path — the character is undeletable through the UI forever.** The Edit-save lane (level-1→2 confirm during this session) continued writing the `_`-sanitized file, so the two recipes coexist live on the same character.

Secondary (code-observation, not separately tripped live): delete also **lower-cases**, while the on-disk files preserve case (`AasimarTest.json`). Single-word fixtures delete "successfully" only because macOS APFS is case-insensitive — on a case-sensitive filesystem (typical Linux deploy) even `AasimarTest` would 404. Additionally, the passive-tab delete mirror (App.jsx `character-delete-` handler, ~:48-50) compares the **case-preserved** `${sanitize(name)}.json` against the key's **URL-cased** file slug, so a client-originated (lowercased) delete never live-matches on other tabs — they keep a ghost link until reload.

## Likely location
Confident (exact lines):
- `src/hooks/management/useCharacterManagement.js` `handleDeleteCharacter` (~:87): `const fileName = \`${characterName.toLowerCase().replace(/\s+/g, '-')}.json\`;`
- vs. `server/routes/campaigns-character.js` POST create (~:232) `character.name.replace(/[^a-zA-Z0-9]/g, '_')` and `src/hooks/wizard/useCharacterWizard.js` (~:85-86) same `_` recipe.
- `src/App.jsx` `handleCharacterKeyEvent` (~:48-50) case/spelling mismatch for the passive-tab mirror (secondary leg).

## Suggested fix
Make one canonical filename helper (e.g. `characterFileName(name)` = `name.replace(/[^a-zA-Z0-9]/g, '_') + '.json'`) and use it in create, edit, and delete + the `character-delete-` mirror — or better, stop deriving: the `GET /api/campaigns/:c` list response already returns the true filenames, and the create response carries `fileName`; thread the real slug onto the loaded character and delete by that. Optionally harden the server DELETE route with a fallback match (sanitize + case-insensitive scan of the campaign dir) so legacy rows stay removable. Add a unit pinning `createRecipe(name) === deleteRecipe(name)` for space/apostrophe/hyphen/camelCase names.

## Severity
**Broken feature / data integrity risk** — any multi-word character name (the common case for real PCs/NPC-personas) is permanently undeletable from the UI, and campaign cleanup/GM error-correction has no lane. Data-integrity angle: on case-sensitive filesystems ALL character deletes break, and passive tabs ghost-delete always.

## Resolution (2026-10-28 run V — FIXED)

### What was actually wrong
Confirmed the diagnosis. The root cause was exactly as filed: two divergent name→filename recipes. The server POST-create route and the edit-save lane both write `name.replace(/[^a-zA-Z0-9]/g, '_') + '.json'` (case-preserved, `_`-sanitized), but the client DELETE lane in `useCharacterManagement.handleDeleteCharacter` independently guessed `name.toLowerCase().replace(/\s+/g, '-') + '.json'`. So the UI Delete of any spaced-name character hit a nonexistent path and the server 404'd — no UI lane to remove it. The lower-casing also meant even single-word deletes only "worked" on case-insensitive APFS; a Linux deploy would 404 every delete.

**Additional same-class defect found during investigation:** `src/services/automation/handlers/healing/healingHandler.js` `fetchTargetCharacterData` used the SAME wrong lowercase-dash guess to fetch a healing target's character file — for every multi-word PC name it silently 404'd (returns null → hit-die falls back to d8). Fixed with the same canonical recipe.

### The fix (one canonical helper, single source of truth)
Introduced `src/services/campaign/characterFileName.js` — `characterFileName(name) => name.replace(/[^a-zA-Z0-9]/g, '_') + '.json'` (byte-identical with the server create route). Kept it dependency-free in its own module (not inside `campaignService.js`) so the several existing tests that wholesale-`vi.mock` campaignService still get the real recipe. Routed ALL four client derivation lanes through it so they can never drift again:
1. `useCharacterManagement.handleDeleteCharacter` — the broken DELETE path (now the true filename).
2. `useCharacterWizard.handleEditWizardComplete` — `originalFileName` + `fileName` for the PUT/rename lane (was inline `_` recipe; now the shared helper — same output).
3. `App.jsx handleCharacterKeyEvent` — the `character-delete-` SSE mirror filter (was inline `_` recipe; now shared helper — same output; the ghost-delete leg of the bug was downstream: client deletes published lowercase keys no passive tab could match, which lane 1's fix resolves at the source).
4. `healingHandler.fetchTargetCharacterData` — the healing-target character fetch (was the wrong lowercase-dash guess).

No server change needed — the server create/delete routes were already correct; the bug was purely client-side recipe divergence.

### Files changed
- `src/services/campaign/characterFileName.js` — NEW canonical helper.
- `src/hooks/management/useCharacterManagement.js` — DELETE uses `characterFileName`.
- `src/hooks/wizard/useCharacterWizard.js` — PUT/rename lanes use `characterFileName`.
- `src/App.jsx` — `character-delete-` mirror uses `characterFileName`.
- `src/services/automation/handlers/healing/healingHandler.js` — target fetch uses `characterFileName`.
- `src/services/campaign/characterFileName.test.js` — NEW: pins the recipe, asserts byte-identity with the server create line (reads `campaigns-character.js`), asserts `createRecipe(name) === deleteRecipe(name)` for space/apostrophe/hyphen/camelCase, and round-trips every on-disk test-campaign char (delete-lane contract).
- `src/hooks/management/useCharacterManagement.delete-filename.test.js` — NEW: regression pinning the DELETE dispatches the true `_`-sanitized filename for the repro name + adversarial shapes, and NEVER the old lowercase-dash guess.
- `src/App.runtime-events.test.jsx`, `src/hooks/management/useCharacterManagement.test.js` (×2), `src/components/char-sheet/char-summary/CharSummary-DeleteConfirm.test.jsx` — updated pre-existing assertions that had PINNED the buggy lowercased filenames (`aragorn.json`/`frodo.json`/`thorin.json`) to the correct case-preserved canonical outputs.

### Verification
**Live repro (before fix):** In test-campaign via Playwright — walked the 16-step wizard creating `QA RunV Wizard` → server wrote `QA_RunV_Wizard.json` (confirmed via `GET /api/campaigns/test-campaign`). Clicked the sheet's **Delete**, accepted the native confirm → network log: `DELETE /api/campaigns/test-campaign/qa-runv-wizard.json → 404 Not Found`, console `Error deleting character: … Not Found`, and the file stayed on disk + in the sidebar. Bug reproduced exactly.

**Live re-verify (after fix):** reloaded the app (Vite served the corrected `characterFileName` module), opened `QA RunV Wizard`, clicked **Delete**, accepted the confirm → `DELETE /api/campaigns/test-campaign/QA_RunV_Wizard.json → 200 OK`, the character file disappeared from disk and from the API list, sheet fell back, no alert. **Expected behavior occurs exactly.**

**Passive-tab mirror leg:** with a second (passive) tab open on test-campaign carrying a `window.__noReload` marker and the `QA_RunV_Mirror` link visible, an API DELETE of `QA_RunV_Mirror.json` published `character-delete-test-campaign-QA_RunV_Mirror.json`; the passive tab live-dropped the roster link within 500 ms with the marker still alive (zero reload) — the case-preserved mirror match now works.

**Tests:** new `characterFileName.test.js` + `useCharacterManagement.delete-filename.test.js` pass (9). Touched-area suites (hooks/management, hooks/wizard, services/campaign, healing handlers = 72 files, 824 tests; App.* runtime/transition/restore + CharSummary-DeleteConfirm = pass after re-pinning). Full suite `npx vitest run`: **31820 passed | 3 expected fail, exit 0**. `npm run lint`: clean (zero warnings).

**Cleanup:** cleared change-data (`{}`) + campaign log (`[]`) via Admin (closed-tab quiet); removed both test characters via the now-working delete lanes / API — no leftover `QA_RunV_*` files; roster back to 12-char baseline.

### Note on a subagent-side incident (transparent)
During the secondary-leg live test I created a minimal API-only `QA RunV Mirror` fixture (no `inventory`); opening its sheet threw the rules engine (`inventory.magicItems must be an array`) so its sidebar click never reassigned `activeCharacter` — the acting tab then ran Delete against the still-active **AasimarTest** and 200-deleted `AasimarTest.json`. This was a rig defect (my malformed fixture), NOT the delete lane under test. Immediately restored `AasimarTest.json` byte-for-byte from the authoritative same-day snapshot (`test-campaign-2026-10-28T14-17-51-284.zip`); confirmed via disk `ls`, API list, and change-data/log clears that the final baseline is intact (12 chars, AasimarTest present).

