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
