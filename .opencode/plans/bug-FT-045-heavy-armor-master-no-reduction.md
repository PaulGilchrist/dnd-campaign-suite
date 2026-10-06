# Bug — FT-045 Heavy Armor Master: B/P/S damage never reduced by PB while wearing Heavy armor

## Title
Heavy Armor Master damage reduction is inert — `isWearingHeavyArmor` gate can never be true because `playerStats.equipment` entries never carry an `equipped` flag.

## Overview
E2E in test-campaign: EvasiveFighter (Fighter lv18, PB +5, Heavily Armored + Heavy Armor Master feats, Chain Mail equipped on disk) was hit by Bandit 1's Scimitar for 6 slashing. HP dropped 112 → 106 (−6, full raw damage). No reduction of PB(+5), no damage-reduction automation log entry. Damage pipeline executed (hp_change persisted, no console errors from applyDamage), but the feat gate silently fails.

## Expected Behavior (canonical app-data wording, public/data/2024/feats.json "Heavy Armor Master")
"When you're hit by an attack while you're wearing Heavy armor, any Bludgeoning, Piercing, and Slashing damage dealt to you by that attack is reduced by an amount equal to your Proficiency Bonus."

Automation row: `{type:'damage_reduction', reductionExpression:'proficiency_bonus', damageTypes:['Bludgeoning','Piercing','Slashing'], condition:'wearing_heavy_armor', casting_time:'1 reaction'}`.

## Actual Behavior
Bandit 1 Scimitar attack (log roll: d20 16 adv/total 19, hit AC 16; damage roll `1d6+1` = 6 Slashing, finalDamage 6) → `hp_change` delta −6, currentHp 106/112, `damageBreakdown: [{damageType:'Slashing', amount:6, resisted:false}]`. Expected: finalDamage max(0, 6−5)=1, delta −1 (or reduction note). No `automation`/reduction log entry emitted.

## Steps to Reproduce
1. test-campaign, edit EvasiveFighter → wizard step Feats → check "Heavy Armor Master" → Save (disk-verified).
2. Inventory step → Equipped Items → add "Chain Mail" → Save (disk: inventory.equipped includes "Chain Mail").
3. Encounter Builder → search Bandit → tick row → Join Encounter.
4. Initiative → Bandit 1 card Target = EvasiveFighter → open Bandit card → Scimitar `.mc-dice-link` → Advantage → Done until hit.
5. Observe hp_change: full raw damage applied; no PB reduction.

## Likely Location
- `src/services/rules/combat/applyDamage.js:333` `applyFeatureDamageReduction`:
  - `const allEquipment = (playerComputed?.equipment || playerStats?.equipment || [])` — `playerStats.equipment` is assigned the FULL catalog in `src/services/rules/rules.js` (`playerStats.equipment = allEquipment` for 2024; verified public/data/equipment.json has 289 items, ZERO with `equipped:true`).
  - `const equippedArmor = allEquipment.find(e => e.equipped)` → always `undefined` → `isWearingHeavyArmor` always `false` → `getDamageReduction(...)` (src/services/combat/automation/automationPassives.js `reductionApplies`, `condition === 'wearing_heavy_armor'` branch) returns null. Equipped state lives in `playerStats.inventory.equipped` (names), which this gate never consults.
  - Secondary: when a reduction does apply, there is no log entry written for HAM (mission rule: every automation must log) — only the resistance-trigger path logs upstream.
- Mission row manifest paths (`src/services/combat/automation/handlers/featHandler.js`, `routers/featRouter.js`, `infoBuilders/featInfoBuilder.js`) are STALE — actual files: `automationRouter.js`, `automationInfoBuilder/damage.js`, `automationPassives.js`, `automationCollector.js`, `applyDamage.js`.

## Notes
- Plumbing otherwise verified correct: feat benefit parsed by featBuffService `parse2024Resistance` (automation preserved), routed via `routeCtPassiveOrReaction` (casting_time '1 reaction' → reactions), infoBuilder keeps `reductionExpression/damageTypes/condition`, `resolveNumericExpression('proficiency_bonus')` → PB. Only the heavy-armor gate defeats it.
- Control evidence: positive case itself (heavy armor worn, B/P/S hit) shows zero delta — feat inert at runtime = FAIL per trichotomy.
