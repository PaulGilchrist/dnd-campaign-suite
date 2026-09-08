# Bug FT-094 — Telekinesis (feat, 2024): Telekinetic Shove fires unlimited per turn — no bonus-action/once-per-turn gate

**Verdict: FAIL** (2026-09-08, test-campaign, host EvasiveFighter)

## What works (live-proved)
- Feat row renders live & clickable in Bonus Actions on sheet (featBuffService bonus_action branch → CharBonusActions `b.clickable`).
- Click → `pendingSavePrompts` STR save on armed target Thug 1, **DC 17 EXACT** = 8 + INT+3 (feat ASI INT, INT 15→17, key `Telekinesis-3`) + PB+6 (lv18).
- Hit/miss boundary exact: totals 10/7/16/15 FAIL, 17 SUCCESS (saveBonus +2 = Thug STR 15).
- Fail + success branches both log: `ability_use` "Telekinetic Shove triggered… DC 17… pushed 5 feet" + `save_result rollType:save-telekinetic_shove` "Pushed 5 feet."/"No effect." Generic `save_result` row also present (characterName:"Unknown").
- Handler/mapping real (not inert): `src/services/automation/handlers/feats/telekineticShoveHandler.js`, `src/services/automation/index.js:614`, router `automationRouter.js:622` → bonusActions, info builder `class-feature-handlers.js:7`.
- 5e feats.json has NO Telekinesis feat row — 2024-only.

## Bugs
1. **NO bonus-action economy / once-per-turn gate (primary FAIL).** 6 consecutive row-clicks in the SAME EvasiveFighter turn each fired a full new trigger: 6 `ability_use` logs + 6 STR-DC17 save prompts, zero refusals, no `oncePerTurn` stamp, no latch key, no resource spend. feats.json benefit carries no oncePerTurn flag; handler (`telekineticShoveHandler.js`) has no latch. Violates "As a Bonus Action" — verdict policy: ungated trigger = FAIL.
2. **DC ability hardcoded in data.** feats.json `automation.saveAbility:"INT"` fixed; handler/info-builder compute DC from that, not from the ASI actually chosen (`featAbilityChoices "Telekinesis-3":"Intelligence"` is never consulted). DC is correct ONLY because ASI happened to be INT; WIS/CHA ASI would silently give wrong DC.
3. **Push is prose-only.** No targetEffect, no position/move consumer, no movement state — log text "Pushed 5 feet" only (gridless-tolerable per playbook, but nothing to model "toward or away").
4. Minor: trigger logs `promptId` on ability_use but resolved-save generic `save_result` row logs `characterName:"Unknown"`.

## Repro
lv18 Fighter (EvasiveFighter, Telekinesis feat + ASI INT) vs EB Thug 1, DC 17; walk initiative to fighter, arm Thug via card target-select, click "Telekinetic Shove:" in Bonus Actions repeatedly same-turn → every click rolls a fresh save.

## Fix pointers
Latch `<Feature>_usedRound` on `playerStats.name` stamped at trigger (canonical `_Slow_Fall_usedRound` family: initiative.jsx + navigationHandlers.js round-wrap clear lists); refuse re-click with `telekinetic_shove_refused` log. Derive saveAbility from featAbilityChoices for "Telekinesis" instead of hardcoded INT.
