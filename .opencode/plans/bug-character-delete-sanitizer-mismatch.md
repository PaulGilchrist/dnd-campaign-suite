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
