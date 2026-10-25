# Admin campaign rename prompts TWICE — modal input is silently discarded

## Summary
The Admin "Rename Campaign" modal collects the new name in `#rename-campaign-input`, but the shared `handleRenameCampaign` handler ignores that value and fires a second native `window.prompt('Enter new campaign name:')`. Whatever the user typed in the modal is thrown away (the modal closes before the prompt appears), and the rename is executed from the prompt's value instead.

## Steps to reproduce
1. In test-campaign, go to Admin → "Rename Campaign".
2. Type `test-campaign-renamed` into the modal input ("New Campaign Name") and click `Rename`.
3. Observe: the modal closes immediately AND a native prompt "Enter new campaign name:" (pre-filled with the OLD name) appears.
4. Type the new name into the native prompt and accept.

## Expected behavior
One input surface: the name typed into the modal's `#rename-campaign-input` is the name that gets renamed.

## Actual behavior
Two sequential prompts. The modal value is discarded (`CampaignAdmin.handleRenameSubmit` closes the modal and calls `onRenameCampaign()` with NO arguments; the App-level handler `handleRenameCampaignRaw` then runs its own `prompt(...)` and uses that value). Confirmed live 2026-10-25: accepted prompt with `test-campaign-renamed` → folder renamed; accepted prompt with the default/old value after typing something else in the modal → nothing happened, no error. UX trap: a user who typed in the modal and then hits Enter/OK on the pre-filled native prompt silently renames to the OLD name (server `fs.renameSync(dir, dir)` no-ops 200) — or, since the campaign-select list re-rendered, appears to have done nothing.
Server-side rename itself is SOUND (round-trip test-campaign → test-campaign-renamed → test-campaign: folder, quests, npcs, log, runtime all followed; `migrateCampaignMemoryMaps` + imagePath migration verified; duplicate target name → 400 "Campaign already exists").

## Likely location
CONFIDENT: `src/components/campaign-admin/CampaignAdmin.jsx:241-246` (`handleRenameSubmit` drops `newName` when calling `onRenameCampaign`), `src/App.jsx:556-563` wires `handleRenameCampaign` (no-arg) → `src/hooks/management/useCampaignManagement.js:23-42` `handleRenameCampaign` re-prompts via `window.prompt`. The hook is also used by a legacy prompt-only caller, hence the duplication.

## Suggested fix
Make the shared handler accept an optional pre-collected name: `handleRenameCampaign(newName)` — when called with a non-empty string, skip the `prompt()` and PUT directly; `CampaignAdmin.handleRenameSubmit` passes `newName.trim()` and only closes the modal on success (surface the server 400 "Campaign already exists" in-modal instead of a raw `alert`). Add a duplicate-name check/disable in the modal as a backstop.

## Severity
Minor UX issue — the underlying rename works and data integrity is fine, but a double prompt where the first input is silently discarded is confusing and one Enter-press away from a no-op the user can't distinguish from failure.

## Resolution
FIXED 2026-10-25.

**What was actually wrong** (root cause differs slightly from the initial guess): `CampaignAdmin.handleRenameSubmit` had ALREADY been threading `newName.trim()` into `onRenameCampaign(...)` — the value was NOT dropped at the component. The drop happened one layer up: the App.jsx wrapper `handleRenameCampaign` was defined with **no parameters**, so it swallowed the argument and called `handleRenameCampaignRaw()` bare; the hook then always re-prompted via `window.prompt('Enter new campaign name:', campaignName)` and used the prompt's value. Confirmed live pre-fix: typed `test-campaign-renamed` in the modal, clicked Rename → modal closed, `window.promptCalls` captured exactly one native prompt pre-filled with the OLD name; prompt value decided the rename.

**Changes:**
- `src/hooks/management/useCampaignManagement.js` — `handleRenameCampaign(preCollectedName)`: a non-blank pre-collected name skips the `prompt()` and PUTs directly; blank/absent arg keeps the legacy prompt path (Sidebar prop wiring).
- `src/App.jsx` — `handleRenameCampaign(newName)` forwards the name to the raw hook handler; on failure, alert is kept ONLY for the legacy no-arg prompt path, modal path rethrows so CampaignAdmin can render the error in-modal (mirrors MapsManager inline "already exists" pattern).
- `src/components/campaign-admin/CampaignAdmin.jsx` — `handleRenameSubmit` awaits success before closing (draft + server error stay in-modal on failure); `RenameModal` gains inline error rendering (`admin-status--error`), a live "The campaign already has this name" notice + disabled Rename for case-insensitive same-name backstop, and a "Renaming..." busy state. No new CSS (reuses existing `.admin-status--error`).
- Tests: `CampaignAdmin.rename.test.jsx` (+3 regression tests: modal value passed straight with **zero** `window.prompt` calls; failed rename keeps modal open with draft + shows "Campaign already exists"; same-name submit blocked) and `useCampaignManagement.test.js` (+2: pre-collected name PUTs without prompting; blank arg falls back to prompt).

**Verification:**
- Vitest: `npx vitest run src/components/campaign-admin src/hooks/management` → 16 files / 186 tests passed. `npm run lint` → clean (zero warnings).
- Live re-repro in test-campaign (localhost:5173): modal → type `test-campaign-renamed` → Rename → **zero native dialogs captured** (Playwright `page.on('dialog')` listener), modal closed, folder renamed to `test-campaign-renamed` (disk + `GET /api/campaigns`). Duplicate attempt → `Frostfall` → modal stayed open, inline "Campaign already exists", no alert/prompt. Same-name (`Test-Campaign-Renamed`) → Rename disabled + "already has this name" notice. Reverted via modal → back to `test-campaign`, header re-verified `test-campaign` at every hop.
- Cleanup: Admin → Clear Campaign Log + Clear Change Data (adjacent flow sanity-checked; both fired their native confirms, log `[]`, change-data `{}` post-rename round-trip). Ghost-folder sweep per playbook: `ls public/campaigns/` + `GET /api/campaigns` diffed vs baseline twice (immediately + ~2 min after, past the 10s debounce + resurrection window) — no ghost folders; quests (The Lost Artifact) + npcs (Marta Copperkettle) survived the round-trip intact.
