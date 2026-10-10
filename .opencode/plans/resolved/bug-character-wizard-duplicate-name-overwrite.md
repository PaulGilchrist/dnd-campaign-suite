# Character creation wizard silently overwrites an existing character with the same name

### Summary
The "Add Character" wizard does not enforce the duplicate-name rule used everywhere else in the app. Creating a new character named "AasimarTest" (an existing lv20 Rogue in test-campaign) succeeded and immediately replaced the existing character's JSON on disk with the new lv1 Wizard — silent data loss, no confirmation, no error.

### Steps to reproduce
1. On localhost, in test-campaign, click "Add Character" in the sidebar.
2. On Step 1 (Ruleset), click Next **without selecting a ruleset** (it also skips — see notes).
3. Step 2: type `AasimarTest` (an existing character name) in Character Name. No inline "already exists" error appears; Next is enabled.
4. Click Next, choose Race Human, Class Wizard (step 6), Subclass Evocation (step 7), leave defaults through to the last step ("Step 12: Special Actions"), click "Create Character".
5. Observe: no duplicate-name rejection; the app returns to the sheet, now showing "Orc, Rogue, Level 20" header briefly but the sheet renders as the new wizard build (passives all 9, 20 cantrips).
6. Verify server: `GET /api/campaigns/test-campaign/AasimarTest.json` returns `class: Wizard, level: 1` — the original file was overwritten.

### Expected behavior
Duplicate character names should be rejected (case-insensitive inline error + Save blocked, matching NPCs/Quests/Factions/Maps/Settlements/Sessions behavior), or at minimum a "A character with this name already exists. Overwrite?" confirmation should be required.

### Actual behavior
Save succeeds with HTTP 200 (`{"message":"Character updated successfully"}` for the PUT to `/api/campaigns/test-campaign/AasimarTest.json`) and the previous character is destroyed. No console error, no warning, no confirmation dialog.

### Likely location
Confident: the wizard's create/save handler PUTs straight to the character JSON route `/api/campaigns/:campaign/:Name.json`, and the name field in Step 2 only checks non-empty/whitespace (Next disabled on empty/whitespace). Compare with `server/utils/jsonEntityCrud.js` / NPCs and Quests routes which do duplicate checks server-side — the character file route (`server/routes/campaigns-character.js` or similar) evidently treats PUT as upsert with no existence guard, and the wizard client (`src/components/wizard/` / character wizard components) has no client-side duplicate check either.

### Suggested fix
Add a duplicate-name gate on Step 2: on blur/next, fetch the campaign character list and show an inline error if a name already exists; additionally, make the create endpoint 400 when the target file already exists unless an `overwrite=true` flag is sent. Recovery note: the overwritten JSON could be restored from a snapshot/disk backup — real users have no such option.

### Severity
Data integrity risk — destroys a player character irrecoverably with zero feedback.

## Resolution
FIXED 2026-10-10.

**What was actually wrong (diagnosis differs from the guess):** the wizard's create flow never touches the PUT route. Clicking "Create Character" issues `POST /api/campaigns/:campaign` (`campaignService.createCharacter` → `server/routes/campaigns-character.js`), which generates `${name}.json` from the submitted name and `writeFileSync`-es unconditionally — the overwrite is an upsert in the **POST create route**, not a PUT. The wizard client had no duplicate check either (Step 2's `validateBasicsStep` only checked non-empty name), and `campaignService.createCharacter` threw on `response.statusText` only, so even a future 400 body would never reach the user. Live repro confirmed the POST path: request log shows `POST /api/campaigns/test-campaign → 201 Created`, disk flipped from Orc/Rogue/lv20 to Human/Wizard/lv1, no console error.

**Fix (mirrors the established NPCs/Quests/Factions/Settlements duplicate-name pattern):**
- `server/routes/campaigns-character.js` — POST create route now 400s `{"error":"A character with that name already exists"}` when the target file already exists (canonical sibling message; also catches distinct names sanitizing to the same filename). No overwrite flag, no confirmation — hard reject, matching siblings.
- `src/config/utils.js` — exported `hasDuplicateCharacterName` + `DUPLICATE_CHARACTER_NAME_ERROR`; Step 2 validator (`validateBasicsStep`) and `validateFinalFormData` reject case-insensitive duplicates via `context.existingNames` / new second arg (ruleset-agnostic — covers both 5e and 2024 create flows; sibling rules modules need no twin change).
- `src/hooks/wizard/useWizardNavigation.js` — threads `existingNames` into `validateStep`, so Step-2 **Next** and the step-prefix **Save** gate block duplicates.
- `src/components/character-creation/CharacterCreationWizard.jsx` — new `existingCharacters` prop, memo of existing names (self-exempt in edit mode, mirroring the NPC self-edit exemption), live inline `.error-message` on Step 2 while the name collides.
- `src/App.jsx` — passes `characters` into both wizard instances.
- `src/services/campaign/campaignService.js` — `createCharacter` now surfaces the server's JSON `error` message (try/catch fallback to statusText preserves the existing no-body error test).

**Files changed:** `server/routes/campaigns-character.js`, `server/routes/campaigns-character.test.js` (POST tests' blanket `existsSync=true` mocks made path-aware: dir exists / target file absent), `src/config/utils.js`, `src/hooks/wizard/useWizardNavigation.js`, `src/components/character-creation/CharacterCreationWizard.jsx`, `src/components/character-creation/CharacterCreationWizard.submission.test.jsx` (extended partial `vi.mock` of config/utils with the two new exports; `validateFinalFormData` assertion updated for the new second arg), `src/services/campaign/campaignService.js`, `src/App.jsx`.
**New tests:** `server/routes/campaigns-character-duplicate-name.test.js` (400 + original file untouched, filename-sanitizer collision, unique-name 201), `src/config/utils.duplicate-name.test.js` (Step-2 duplicate/case-insensitive/required-name-precedence/2024, final-submit gate).

**Verification:**
- Live (Playwright, test-campaign): Add Character → Next (ruleset skipped) → Step 2 type `AasimarTest` → inline "A character with that name already exists" + **Next disabled**; lowercase `aasimartest` also blocked (case-insensitive); unique name clears the error and re-enables Next. Full unique-name creation still works end-to-end (`QA_Unique_Hero.json` created, then deleted via the app's DELETE route). Direct API bypass: `curl POST` duplicate → HTTP 400 `{"error":"A character with that name already exists"}`, `AasimarTest.json` shasum byte-identical to pre-repro snapshot throughout.
- Tests: new tests pass; touched folders green — `src/config` + `src/hooks/wizard` + `src/components/character-creation` + `src/services/campaign` + character routes: 78 files / 1257 tests passed. `npm run lint`: zero warnings.
- Cleanup: AasimarTest restored (shasum match), QA character deleted, Admin change-data `{}` and campaign log emptied via API.

**Known adjacent residual (out of scope):** an edit-mode wizard **rename** onto another existing character name still routes through PUT (with `originalFileName`) and can overwrite the target file — the maps rename guard has no character twin. Create-flow overwrite (this ticket) is closed.
