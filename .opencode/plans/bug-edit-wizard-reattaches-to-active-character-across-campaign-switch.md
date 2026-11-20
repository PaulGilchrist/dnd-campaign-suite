# Bug: edit wizard silently reattaches to the first roster character after a campaign re-select

## Summary
If the edit wizard is open when the GM leaves the campaign (sidebar `Campaigns`) and re-enters, the wizard silently re-opens as an **Edit Character** session for whichever character becomes `activeCharacter` on re-entry (in practice the first roster entry, e.g. `AasimarTest`) — not the character it was originally opened for. Saving in that state writes the re-seeded character's file with the GM's in-wizard edits intended for the original character. Confirmed live twice (fresh unmodified wizard for `War_Cleric` and a dirty wizard for `TL Switch QA`), deterministic.

## Steps to reproduce
1. In `test-campaign` (localhost:5173), open any character's sheet (e.g. click `War_Cleric` in the Characters sidebar).
2. Click the sheet's `Edit "War_Cleric"` button — the edit wizard opens on `Step 2: Basic Information` with the name field showing `War_Cleric`. Touch nothing (no edits needed — the leak does not require a dirty draft).
3. Click the `Campaigns` sidebar header (deselects the campaign, lands on campaign selection). No dialog appears; the wizard view unmounts.
4. Click `test-campaign` again to re-enter.
5. Observe: within ~2 s the **Edit Character wizard auto-opens by itself**, and the Character Name field reads `AasimarTest` (the first roster character that becomes `activeCharacter` on re-entry) — not `War_Cleric`. Closing it with × fires no discard confirm (it considers itself a clean AasimarTest edit).
6. Escalation face (witnessed live): with the auto-reattached wizard open, clicking the original character's roster link and its `Edit "<Name>"` button under the backdrop re-binds the SAME mounted wizard's data prop, producing a MIXED draft — name input `AasimarTest` + duplicate-name error, while the Spells/Feats steps and the ruleset-switch ledger enumerate the OTHER character's rows (witnessed: ledger "51 kept, 19 removed / Spells — 47 kept, 17 removed / Telepathy — not in the 5th Edition (5e) feat data", which are `TL Switch QA`'s rows). Saving such a draft PUTs to `characterFileName(form name)` (i.e. `AasimarTest.json`) — the wrong character.

6b. Sibling face (lower severity, same seam, confirmed live): with the CREATE wizard open (Add Character, untouched), leave + re-enter the campaign — the empty "Create New Character" wizard silently re-opens too (`showCharacterWizard` is the same never-reset `useState`). No wrong-target risk (no `characterData` binding), but the session resurrection itself is unintended.

## Expected behavior
Re-entering a campaign must not resurrect a stale wizard session. At minimum, `handleCampaignSelect` (the same reset that already clears `activeView`/`activeCharacter` per the campaign-switch law) must close `showCharacterWizard`/`showEditCharacterWizard`; the reopened wizard can never re-seed from an `activeCharacter` that is not the character `Edit` was clicked on.

## Actual behavior
The wizard is unmounted on deselect but its open-flag survives; on re-entry it remounts and re-seeds from `activeCharacter` (first roster char). The session's title ("Edit Character") carries no character name, so the swap is silent. Only luck prevented a wrong-file overwrite in this session: the mixed draft's duplicate-name validator blocked Save during the escalation ride.
Related console/network evidence from the same lane (self-attributed fixture artifact, not this bug's fault, but it exposed the attribution split): a save failure alerted `Failed to update character: Failed to update character: Not Found` (`PUT /api/campaigns/test-campaign/TL_Switch_QA.json` → 404, for a non-canonical disk filename) — while `originalCharacterRef` still held the originally-edited character, i.e. the PUT URL (from the form name) and the server's `sourceFile`/level-confirm copy (from the ref) can name DIFFERENT characters.

## Likely location
High confidence (read the code after live repro):
- `src/App.jsx:997` — `{showEditCharacterWizard && <CharacterCreationWizard ... characterData={activeCharacter} isEditing={true} .../>}`: the edit wizard is bound to the LIVE `activeCharacter`, not to the character `handleEditCharacter(...)` was called with (that snapshot only lives in `originalCharacterRef` inside the hook).
- `src/hooks/wizard/useCharacterWizard.js:24-25,63-65` — `showEditCharacterWizard` is plain `useState` on the never-unmounted App; nothing resets it on campaign switch.
- `src/App.jsx:620-625` — `handleCampaignSelect` resets `combatSummaryLoaded`/`activeView`/`activeCharacter` but not the two wizard flags. This is the same family the campaign-switch law closed for stale sheets ("FIXED, App.jsx: handleCampaignSelect resets activeView+activeCharacter") — the wizard open-state was overlooked.

## Suggested fix
Close both wizard lanes at the campaign seam: either (a) in `handleCampaignSelect` (and the deselect path) call `handleEditWizardCancel()`/`handleWizardCancel()` (or expose a `closeWizards()` from `useCharacterWizard`), or (b) bind the edit wizard to a captured `editingCharacter` state set by `handleEditCharacter` (instead of `activeCharacter`) so a remount can never re-target a different character. Prefer doing BOTH — (a) kills the silent auto-reopen, (b) removes the reattach hazard class. Add a live two-tab-free pin: open edit for char B → campaign switch → re-select → assert no `.character-creation-wizard-overlay` mounts. Also worth a look while in there: the doubled `Failed to update character:` prefix (`campaignService.updateCharacter` throws the prefixed copy and `useCharacterWizard` alerts prefix it again).

## Severity
Data integrity risk — a GM can unknowingly hold and save an edit session bound to a different character than the one they opened; the save lane can write that other character's file (and the level-change confirm/sourceFile derive from yet another snapshot).
