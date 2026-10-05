# Bug CLA-110 — Elemental Affinity: chosen-type Resistance is render-only (+CHA bonus leg works)

## Title
Elemental Affinity (Draconic Sorcery lv6): chosen damage type renders on the sheet Resistances line but is never folded by applyDamage — full damage lands; the +Charisma bonus leg is live.

## Overview
Feature at `public/data/2024/classes.json:11296`: `{damageTypes:[Acid,Cold,Fire,Lightning,Poison], effect:'elemental_affinity', casting_time:'passive'}`. Verified on AberrantSorcerer (temp swap to Draconic Sorcery, reverted after). The 5-radio chosen-type modal, persistence, +CHA damage fold, and type-scoping all work. The Resistance clause does not: applyDamage never reads the chosen-type key, so matching-damage hits deal full damage.

## Expected Behavior
Feature text (classes.json:11296 description / manifest): choose one damage type; you have Resistance to that type; when you cast a spell that deals damage of that type, add your Charisma modifier to one damage roll of that spell. Resistance = half damage (apply-time ledger `resisted:true`, `floor(raw/2)`).

## Actual Behavior
- PASS legs: Fire spell with EA=Fire → log formula `4d10 [fire] + 3 [Elemental Affinity]`, NPC hp_change −33 (4d10=30 +3 CHA); re-pick EA→Cold (disk `_AberrantSorcerer_Elemental_Affinity_chosenType:'Cold'` GET) → same Fire Bolt deals `4d10 [fire]` only (−19), no bonus (type-scope clean, automationPassives.js:283-299 strict equality); modal persists across reload; no spurious uses counter (data passive — RAW-correct).
- FAIL leg: divination wizard's Fire Bolt at host with EA=Fire chosen → hp_change −21 full, HP 62→41, NO halve, NO resist log. Sheet shows "Resistances: Fire" (rulesFactory.js:179 merge) but `src/services/rules/combat/applyDamage.js` live-folds Boon-Energy chosen keys (:225) with NO reader for `_Elemental_Affinity_chosenType`; PC combatSummary entries carry no resistances array either. Render-only resistance = FAIL(a) per CLA-019 precedent (CLA-022 proved aura DAMAGE resistances CAN be live-consumed — applyDamage.js:636-638; this lane opts out).

## Steps to Reproduce
1. test-campaign, AberrantSorcerer → Edit wizard step-7 → Draconic Sorcery → Save, reload.
2. Click "Elemental Affinity:" row → choose Fire → GET chosenType='Fire'; sheet Resistances shows Fire.
3. Second caster (DivinationWizard) hits host with Fire Bolt → full damage in ledger + change-data hp_change, no resisted:true.

## Likely Location
- `src/services/rules/combat/applyDamage.js` (~:225 Boon Energy fold site) — add chosen-type reader for `_Elemental_Affinity_chosenType` mirroring the Boon lane; or register chosen-type resistance as computed `playerStats.resistances` push at choice-time (race-rules/2024.js:118 build-push precedent) so the existing CLA-022 lane consumes it.

## Notes
- CHA mod note: host stored CHA base 8 (−1) pre-run; wizard point-buy raised to 15 (+3) to make bonus visible, then REVERTED (CHA 9) — bonus is invisible at chaMod≤0 (`Math.max(0,...)` guards); check stored ability composition before probing "+N".
- Subclass reverted + disk/UI verified; change-data/log cleared GET-verified.
- Verified 2026-10-04.
