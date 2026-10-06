# Bug — CLA-144 Flurry of Healing and Harm: Hand of Healing always rolls 0, Hand of Harm effect never fires

## Overview
CLA-144 (2024 Monk Warrior of Mercy lv11 passive) was verified live on `test-campaign` with Disciplined_Monk (Warrior of Mercy lv20, WIS 24/+5→+7). The plumbing is LIVE: passive uses counter registers at turn start (= Wisdom modifier, exactly 7), the Flurry lane opens a "Select Target for Hand of Healing" chooser, healing strikes consume the WIS pool (7→5 on two hits), flurry strikes cost ZERO Focus Points (focusPoints stayed 20 across three flurry executions), and the ability_use log tags "(Flurry of Healing and Harm)". However BOTH numeric halves of the feature are broken: every Hand of Healing strike rolls the malformed formula `1d12 + WIS modifier + 7` which `rollExpression()` cannot parse → total 0 → actualHeal 0 on a damaged ally; and on the harm path (Skip chooser), the Hand of Harm effect (CON save vs spell DC → 3d6 Necrotic + disadvantage) NEVER triggers — zero save prompts, zero `saveResult-*` change-data keys, zero Hand of Harm log entries across two full flurry rounds with all 6 strikes hitting.

## Expected Behavior (canonical app data, `public/data/2024/classes.json`, Warrior of Mercy lv11)
> "When using Flurry of Blows, replace each Unarmed Strike with Hand of Healing without expending Focus Points. When making Unarmed Strike with Flurry and dealing damage, use Hand of Harm without expending Focus Point. Uses equal to Wisdom modifier (minimum once)."
Hand of Healing healExpression: `martial_arts_die + WIS modifier`. Hand of Harm: CON save or 3d6 Necrotic (lv17 scaling) + disadvantage on next attack.

## Actual Behavior (machine truth, 2026-10-06)
- ✅ Turn-start passive: runtime `flurryHealingHarmUses` = 7 (= WIS mod +7) at rounds 2, 3, 4 (`change-data.Disciplined_Monk.flurryHealingHarmUses`; lane `turnStartEffects.js:25` → `rules/effects/turnStartEffects.js:273 applyFlurryHealingHarmTurnStart`).
- ✅ Free flurry: `focusPoints` = 20 → 20 unchanged across all flurries (FP-skip `useCharActionsAutomation.js:47-50,82`). Control probe exact.
- ✅ Heal/damage substitution + uses decrement: hits with healing target logged `hp_change … "Heightened Flurry of Blows — Hand of Healing" isHealing:true` and `flurryHealingHarmUses` decremented 7→5 (2 hits = 2 uses), enemy took 0 strike damage (`delta:0` inline).
- ❌ **Heal amount always 0**: `roll` entries `name:"Hand of Healing" formula:"1d12 + WIS modifier + 7" total:0` (×2), hp_change `delta:0` on AasimarTest who was at 10/143 (verifiably healable). `resolveHealingStrikeFormula` (bonusAttacksHandler.js:12-17) substitutes `martial_arts_die` but leaves the literal token `WIS modifier` in the string; `rollExpression()` (diceRoller.js:77) `parseExpression` fails → null → healAmount 0, deterministically.
- ❌ **Hand of Harm never fires**: rounds 3+4 harm flurries (Skip on the chooser), 3+3 strikes, all hit (d20 10/10/10 vs AC 12), damage applied (Bandit 80→57, 9→0 via deferred writes) — yet ZERO CON-save prompts, no `saveResult-Bandit 1` key in change-data, no `Hand of Harm` roll/hp_change/condition entries. `registerHandOfHarmSave` is guarded by `finalDamage <= 0` return (bonusAttacksHandler.js) and the in-handler `applyDamageToTarget` returns finalDamage 0 (all in-handler flurry `hp_change` rows logged `delta:0` with actual damage landing via a deferred lane); additionally `handOfHarmAuto` may be null since Hand of Harm is categorized as a Reaction — both candidate mechanisms produced zero observable harm effect live.
- ⚠️ Carried-over CLA-143 gaps still present: flurry damage rolls `1d6+5` (Quarterstaff die via `resolveFlurryWeaponStats` reading `attacks[0]`) instead of unarmed 1d12+5; `after_attack_action` gate unenforced (not re-probed this mission — Attack was performed in all rounds).

## Steps to Reproduce
1. test-campaign, Disciplined_Monk (Warrior of Mercy lv20, WIS 24). Edit wizard step 7 subclass → Warrior of Mercy (or any lv11+ Mercy monk).
2. EB: tick Bandit → Join Encounter. Walk initiative (Next → polling `__initiative__.lastAppliedTurnStartCreature`) to a Disciplined_Monk turn; verify `flurryHealingHarmUses` = 7 in change-data.
3. Drop an ally low (e.g. AasimarTest → 10 via initiative card). Take the Attack action vs Bandit 1 (arm target on monk card first; resolve Empowered Strikes chooser + Done).
4. Click "Heightened Flurry of Blows" row → "Strike All" → chooser "Select Target for Hand of Healing" → pick the wounded ally → Heal (its button sits outside viewport; element-dispatch click works).
5. Observe logs: `hp_change … Hand of Healing delta:0`, `roll Hand of Healing formula "1d12 + WIS modifier + 7" total:0`, `flurryHealingHarmUses` −1 per hit, `focusPoints` unchanged.
6. Next monk turn: Flurry → Skip → strikes deal damage but NO CON save prompt ever appears.

## Likely Location
- `src/services/automation/handlers/combat/bonusAttacksHandler.js:12-19` — `resolveHealingStrikeFormula` leaves literal `WIS modifier` unresolved (fallback string), so `rollExpression('1d12 + WIS modifier + 7')` → null → heal 0. `wisBonus` is appended separately but the raw token breaks parsing.
- `src/services/automation/handlers/combat/bonusAttacksHandler.js` `registerHandOfHarmSave` (~:196-224) — `finalDamage <= 0` guard + in-handler `applyDamageToTarget` returning 0 against a stale/over-max combatSummary suppresses all Hand of Harm saves; verify `resolveFlurryHealingHarm` (:382) finds `Hand of Harm` in `playerStats.specialActions` (it renders under Reactions — may be absent → `handOfHarmAuto` null).
- Row manifest paths in mission JSON (classFeatureHandler/Router/InfoBuilder) are stale — real consumers are `rules/effects/turnStartEffects.js:131` and `automation/handlers/combat/bonusAttacksHandler.js` (grep-mangled "ln" names = noise; confirmed by file content + live logs).

## Notes
Control probe exact: FP pool 20→20 through three flurry executions (zero FP spend) and uses pool = WIS modifier exactly (7). Substitution chooser + uses-decrement lane is structurally correct — the numeric payoff of both named halves (heal total, harm save effect) is dead, so the feature as shipped does nothing observable beyond consuming a counter. Also seen: flurry `hp_change` inline `delta:0` with damage applied via deferred writes (cs mirror lag) — same family as CLA-143 §.
