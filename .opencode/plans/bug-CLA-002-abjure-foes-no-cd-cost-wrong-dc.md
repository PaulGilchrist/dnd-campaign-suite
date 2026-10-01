# CLA-002 Abjure Foes — Channel Divinity never spent; save DC uses WIS instead of CHA

## Overview
Abjure Foes (2024 Paladin, app data = base-class lv9 feature, `automation.type:'set_condition'`) runs a live, working WIS-save AoE chooser that applies Frightened to failed savers and correctly caps targets at CHA modifier (min 1). Two core gates are nevertheless broken: the feature never costs a Channel Divinity use (no spend, no latch, no refusal at 0), and the save DC is computed from WIS instead of Charisma. Verified E2E 2026-10-01 in test-campaign on ElderPaladin (lv20 Oath of the Ancients, CHA 20/+5, WIS 8/−1, PB +6).

## Expected (canonical quote, public/data/2024/classes.json class_levels[8].features[0])
> "As a Action, expend one use of Channel Divinity. Target creatures equal to Charisma modifier (minimum 1) within 60 feet. Each makes Wisdom save or has Frightened condition for 1 minute or until taking damage. While Frightened, can only do one of: move, take action, or take Bonus Action."

Channel Divinity DC = 8 + PB + CHA = 8 + 6 + 5 = **18**. Cost = **1 CD use** (3/3 → 2/3).

## Actual
1. **FAIL(a) — no Channel Divinity cost.** Runtime `channelDivinityCharges` = 3 before AND after a successful 5-target cast (GET change-data). No `Channel Divinity charge` spend log. Modal never shows a CD line (handler passes `channelDivinityCharges:null`). At 0 charges the feature would still run ungated (gate branch unreachable for this data shape).
2. **FAIL(b) — wrong save DC.** Modal renders, save-result logs stamp, and `activeConditionMeta.frightened.dc` all show **DC 13** = 8 + PB(+6) + WIS(−1). Canonical CD DC is 18 (8+6+CHA+5).
3. PASS halves (evidenced): Frightened applied to exactly the 4 failed savers (Bandit 1, Thug 1, Rug, Berserker 1), Acolyte 1 (saved 13 vs DC 13) untouched; picker cap live at **max 5** = CHA +5, 6th checkbox click refused ("5/18 (max 5)" frozen); logs exist: `ability_use` activation ("WIS save DC 13, up to 5 targets within 60 ft."), 5 per-target `roll/save-damage` entries with `saveDc/saveType/saveResult`, 4 `condition/applied Frightened` entries.
4. Gap (noted, not FAIL per brief): duration metadata has no clock — `pendingExpirations[].expiryRounds:null`, no until-damaged consumer → Frightened expiry is GM-enforced only (data `automation` has no `duration` field; `resolveDurationRounds` returns undefined).
5. Gap (advisory): "can only do one of move/action/bonus action" has ZERO consumers app-wide (grep `abjure` in src/ hits only modal CSS class names + tests; no te/te-registry key/action-gate; targetEffectDefinitions has no abjure/frightened-restricted entry).

## Steps (repro)
1. test-campaign, ElderPaladin sheet: "Abjure Foes:" row clickable in Actions; sheet "Channel Divinity Charges: 3/3".
2. Encounter Builder: tick Thug, Bandit, Berserker, Acolyte, Animated Rug of Smothering → Join Encounter (→ Initiative).
3. Click "Abjure Foes:" → modal reads "WIS saving throw (**DC 13**) ... (max 5)" (canonical: DC 18).
4. Tick 5 NPCs (6th click refused — cap correct), click "Abjure Foes (5 targets)", Done.
5. Saves auto-roll inline; 4 fail → Frightened + logs. GET change-data: `ElderPaladin.channelDivinityCharges` still **3**; `activeConditionMeta.frightened.dc:13`.

## Likely Location
- `src/services/automation/handlers/buffs/conditionHandler.js:11-16` — `buildConditionAutoDefaults` detects Channel Divinity only via `auto.resourceCost==='channel_divinity'` / `auto.cost` regex / `auto.type==='channel_divinity'`; Abjure Foes data (`public/data/2024/classes.json`: `{type:'set_condition',target:'targets_in_range',range:'60 ft',condition:'frightened',effect:'add_condition',bonusExpression:'CHA modifier',casting_time:'1 action'}`) carries NONE of these → `isChannelDivinity=false` → `saveAbility` defaults to **WIS** for `buildSaveDc('ability')` → 8+PB+WIS, and `channelDivinityCharges:null` is handed to the modal.
- Consumer that WOULD work if fed: `SetConditionModal.jsx:69-78` spends 1 CD charge + logs when `channelDivinityCharges != null && > 0`.
- Fix options: add `resourceCost:"channel_divinity"` (+ optionally `duration:"1_minute"`) to the 2024 classes.json automation block, or have the handler/Paladin feature detection recognize CD features by feature-name/category (note `src/services/character/featureCategories.js:29` has "Channel Divinity: Abjure Enemy" commented out).

## Notes
- Manifest paths (classFeatureHandler.js/classFeatureRouter.js/classFeatureInfoBuilder.js) do not exist; live chain = automationRouter.js:203 (`pushTo('actions')`) → automation/index.js:307 (`set_condition`) → conditionHandler.js → SetConditionModal via CharActionModals.jsx:154.
- `maxTargets = Math.max(1, chaMod)` (conditionHandler.js:49) + AreaEffectTargetModalBase.jsx:164-168 toggle cap = exact and live (CHA 20 → 5; min-1 branch code-pinned).
- Caster correctly excluded from picker (`includeCaster=false`); no 60ft grid gate (gridless-lenient, accepted per playbook §42).
- Turn gate absent (row clickable outside Paladin's initiative turn) — consistent with app-wide leniency.
- Save type WIS itself is correct; only the DC ability source is wrong.
- Runtime + log admin-cleared after verification; Channel Divinity charges left at 3 (never consumed — nothing to restore).
