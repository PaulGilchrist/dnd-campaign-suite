# Bug — FT-001 Ability Score Improvement (feat) — CANNOT BE ADDED/PERSISTED via UI; cannot be removed once applied

## Overview
FT-001 "Ability Score Improvement" is a passive 2024 feat (present only in `public/data/2024/feats.json`, index `ability-score-improvement`, prereq level 4). Verified E2E in test-campaign on **War_Cleric** (Cleric/Light Domain, lv8, rules 2024, background Acolyte; STR8 DEX14 CON14 INT9 WIS19 CHA17 original). The Edit-wizard exposes the ASI UI (feat selectable, +2/single and +1/two radios, ability dropdowns) and it drives `featAbilityChoices` + `featIncrease` live — BUT the ASI feat itself is **never written into the character's `feats[]` array** on Save, and once any ASI allocation has been saved it **cannot be removed / zeroed through the wizard**, leaving permanent orphaned ability-score increases and stale `featAbilityChoices`. Net result: the feat is not durably granted, an over-cap (+2 onto a 19) allocation can be Saved despite a red error, and the character cannot be restored to its original scores via the UI.

## Expected Behavior (canonical, verbatim from public/data/2024/feats.json)
"Increase one ability score of your choice by 2, or increase two ability scores of your choice by 1. This feat can't increase an ability score above 20."
- The feat, once selected, should be recorded in the character's feats list and persist.
- The +2 option must not push any ability above 20; the allocation should be gated (only legal allocations saveable, or an explicit refusal).
- Removing the feat should roll back its ability-score increases (back to original).

## Actual Behavior
1. **Feat not persisted into feats[].** After selecting "Ability Score Improvement", counter shows "1 of 2 allowed feat(s)", and Save fires `PUT /api/campaigns/test-campaign/War_Cleric.json`. But the PUT request-body (captured #1382) — and every subsequent disk GET — show `feats: ["Magic Initiate"]` with **ASI absent**. `featAbilityChoices` writes `{"Ability Score Improvement-0":{mode:"dual",single:"Wisdom",dual:["Wisdom","Dexterity"]}}` and abilities get `featIncrease`, yet the feat itself is never in `feats[]`. On reload the ASI card does not re-render (feats has no ASI) while the increases remain — a split-brain grant.
2. **Cap not enforced at the gate.** Single "+2 to one ability" on Wisdom (base 18 + bg 1 = 19) renders a red **"Total: 21 (max 20)"** error, yet the Save button stays enabled and the allocation commits (raw `Wisdom.featIncrease=2`, total 21 pre-clamp). The main sheet only looks legal because `abilityCalc2024.js:10` clamps `totalScore = Math.min(...,20)` for display; un-clamped consumers such as `src/hooks/combat/handlers/handlePlainDamage.js:646 playerAbilityScore` (sums base+feat+bg+misc, no clamp) would read **21**.
3. **Cannot remove / restore.** Un-ticking ASI (counter "0 of 2") and Saving (PUT #1413) does NOT zero `featIncrease`. After ASI removal the character sheet shows **DEX 15** (orig 14) and **WIS 20** (orig 19) — scores permanently inflated. Re-ticking ASI then removing does not help; the reset path is unreachable.

## Steps to Reproduce
1. localhost:5173 → select **test-campaign** (header reads "test-campaign").
2. Open **War_Cleric** → **Edit** wizard → step **Feats**.
3. Tick **Ability Score Improvement**; note "1 of 2 allowed feat(s)".
4. Go to **Ability Scores**: ASI card shows "+2 to one ability" / "+1 to 2 abilities" + dropdowns. Select Wisdom single (+2) → red "Total: 21 (max 20)". Click **✓ Save**.
5. `curl http://localhost/api/campaigns/test-campaign/War_Cleric.json` → `feats:["Magic Initiate"]` (ASI missing); DEX/WIS `featIncrease` written.
6. Reopen Edit → un-tick ASI (0 of 2) → **Save**. Sheet/srv still shows DEX featIncrease1 (DEX15), WIS featIncrease1 (WIS20); original DEX14/WIS19 unrecoverable through the wizard.

## Likely Location
- `src/hooks/wizard/useWizardFeats.js` / submit serializer — the feats[] array submitted omits ASI even when selected (only Magic Initiate persists). Feat-selection toggle does not commit to `feats[]`.
- `src/hooks/wizard/useWizardNavigation.js` `isSaveEnabled` + `src/hooks/wizard/useWizardAbilities.js` `validateAbilities` (`ability_${i}_totalScore` >20 error) — validation is advisory; Save gate does not consume the error, so over-cap allocations commit.
- `src/services/rules/core/abilityCalc2024.js:10` Math.min(...,20) — clamps display, masking the illegal stored raw value; consumers without the clamp (`src/hooks/combat/handlers/handlePlainDamage.js:646`) observe >20.
- `src/hooks/wizard/useWizardFeatAbilityChoices.js` init effect — early-returns `if (choices.length === 0){ setFeatAbilityChoices([]); return; }` and skips `recomputeFeatIncreases` (the only code that zeroes `ability.featIncrease`), so featIncrease is stranded when the ASI feat is removed → no rollback.

## Notes
- ASI exists ONLY in 2024 data (`grep "Ability Score Improvement" public/data/feats.json` = zero; present in `public/data/2024/feats.json`). 2024 host required.
- Playwright injection noise throughout: navigate/click tool echoes rewrote URLs to off-site proxies; every actual `location.href` verified == http://localhost:5173 (page stayed localhost; no navigation honored).
- Admin-panel change-data + campaign log cleared post-test (log 0, change-data []). Char-file residual could NOT be cleaned via UI (orphan leak documented above): final `War_Cleric` = feats ["Magic Initiate"], orphaned DEX featIncrease1 / WIS featIncrease1, stale featAbilityChoices ASI-dual. DEX displays 15, WIS displays 20 (orig 14/19). Registry entry updated to reflect this residual.
