# Bug — CLA-237 Nature's Ward (2024 Druid, Circle of the Land, lv10)

## Canonical (public/data/2024/classes.json:3943)
> "Immune to Poisoned condition. Resistance to a damage type based on land choice: Arid=Fire, Polar=Cold, Temperate=Lightning, Tropical=Poison."

automation: `{ type: "land_resistance", conditionImmunity: "poisoned", landMappings: {arid:Fire, polar:Cold, temperate:Lightning, tropical:Poison}, casting_time: "passive" }`

## Verified working
- Land picker: "Circle of the Land Spells" feature → Temperate → runtime `_circleOfTheLandType:"Temperate"` + `ability_use` log.
- Stamp/badges: sheet Summary live shows **"Resistances: Lightning"** + **"Immunities: Poisoned"**; header "circle of the land-temperate".
- Poisoned immunity: GM Add→Poisoned→Apply on host = refused, `activeConditions` never written, no badge.
- Live resolver probe (in-page ESM import): `getDamageResistances({name:'Wild_Sage_Druid', automation:{passives:[land_resistance]}})` → `["Lightning"]`.
- Typed gate: Bandit Scimitar Slashing 5 (pre-land) and 3 crit (post-land) both `resisted:false` full — correct (not Lightning).

## DEFECT: zero delta on elemental save-damage lane
Lightning Bolt (Self, DC 17 DEX, 10d6) self-targeted at host with Lightning resistance stamped:
- Save failed (total 2 vs DC 17) → damage roll raw **25** → applied `finalDamage: 25`, `hp_change -25` (138→113). Expected floor(25/2)=**12**. No "Damage Resistance" automation log, no `resisted:true` breakdown.

Root cause (static + live):
- Lane = `SaveAttackAoeModal.applyPlayerSaveDamage` (src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx:1617,1647): calls `applyDamageToTarget(..., ignoreResistance:false, characters)` where `characters = combatSummary.creatures.filter(c => c.type==='player')` — persisted cs PC entries are **minimal stubs** (`{name,type,currentHp,maxHp,initiative,concentration,targetName}`; disk GET-confirmed: no `automation`, no `computedStats`, no `resistances`).
- In applyDamage.js:704 `resolveCreatureDefenses` → :710 `getPlayerPassiveResistances` reads `playerComputed?.automation || playerStats?.automation` → both undefined on stubs → `[]` → CLA-336 live land_resistance fold never fires. Same CLA-119 cs-stub family already annotated in-file (see comment at :1657 "combatSummary-stub computedStats read was ALWAYS undefined on persisted player entries").
- Monster-attack lane (charactersRef full stats) folds resistances correctly (breakdown lane emits `resisted` flags); untestable with Bandit (Slashing/Piercing only, monsters.json bandit).

## Fix suggestion
In `applyPlayerSaveDamage` (and twin `applySecondaryPromptDamage`:1613) resolve full player stats (charactersRef / getCharacter by name) instead of cs creature stubs before `applyDamageToTarget`, or live-read `_circleOfTheLandType` at the applyDamage chokepoint for player targets (CLA-336/FT-009 live-fold twin shape).

## Repro recipe
test-campaign → Wild_Sage_Druid (lv20 Circle of the Land) → feature "Circle of the Land Spells" → Temperate → sheet shows Resistances: Lightning → cast Lightning Bolt (Self) → tick self in AoE picker → Roll Save (fail) → Done → hp_change −full 10d6 unhalved.

Session state: Bandit 1 in initiative, host HP 110/143; cleared via Admin post-verification.
