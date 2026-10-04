# BUG CLA-063 — Corona of Light: sunlight_aura save-Disadvantage INERT

**Automation ID:** CLA-063 — Corona of Light — Cleric (2024) Light Domain lv17
**Verdict:** **FAIL (INERT)** — activation plumbing works; the Disadvantage-gate never fires on any live save lane.

## Canonical (public/data/2024/classes.json, Cleric major "Light Domain", lv17)

> "As a Action, you cause yourself to emit an aura of sunlight that lasts for 1 minute. You emit Bright Light in a 60-foot radius and Dim Light for an additional 30 feet. Your enemies in the Bright Light have Disadvantage on saving throws against spells that deal Fire or Radiant damage."

Automation: `type: temp_buff, effect: sunlight_aura, duration: 1_minute, action: action, range: 60_ft, enemies_disadvantage_saves: ["Fire","Radiant"]`

## Live evidence (test-campaign, War_Cleric lv17, Bandit 1 npc CON save via save-prompt lane)

CONTROL — pre-corona, Divine Spark Harm, Radiant, CON save DC 14:
```
roll save-damage  rolls:[3] bonus:1 total:4  saveResult:"failure"          ← 1 die = NORMAL mode
save_result "Bandit 1 failed CON save (DC 14, rolled 3 +1 = 4)"
```
DIFFERENTIAL — post-corona (activeBuffs stamped `effect:'sunlight_aura', duration:'1_minute', enemiesDisadvantageSaves:['Fire','Radiant']`, `coronaOfLightEnemies:['Bandit 1']`, same caster/target/damage type):
```
roll save-damage  rolls:[6] bonus:1 total:7  saveResult:"failure"          ← 1 die = NORMAL mode (EXPECT 2 dice, lower-taken)
save_result "Bandit 1 failed CON save (DC 14, rolled 6 +1 = 7)"
```
Save prompt UI showed "d20 (6) + 1" — single die, no disadvantage stamp, no mode:"disadvantage".

Activation itself verifies correctly:
- buff stamp on runtime exact: `{name:'Corona of Light', effect:'sunlight_aura', duration:'1_minute', enemiesDisadvantageSaves:['Fire','Radiant'], sourceCharacter:'War_Cleric'}` ✓
- popup: "Corona of Light activated! Enemies with disadvantage on saves vs Fire/Radiant: Bandit 1." ✓
- log: "War_Cleric activated Corona of Light. Enemies: Bandit 1." ✓
- enemy-selection modal (`coronaEnemySelection`) → `coronaOfLightEnemies:['Bandit 1']` ✓

## Root cause (static, exact)

`src/services/combat/auras/coronaAuraUtils.js:20` `getCoronaSaveDisadvantage` is **async**, but EVERY consumer treats it as sync AND omits `mapData` which it mandates:

1. **Missing `await` (Promise → `.disadvantage` always undefined):**
   - `src/hooks/combat/handlers/handleNpcSaveDamage.js:109-110` (the exact lane exercised — GM "Roll Save" for joined npc)
   - `src/services/rules/combat/aoeService.js:42` (sync fn `resolveNpcSaveDisadvantage`) and `:100`
   - `src/services/automation/contextBuilder-map.js:182`
   - `src/services/automation/contextBuilder-sync.js:493`
2. **Missing `mapData`:** consumers pass `{targetName, campaignName, damageType, skipRangeCheck:true}`; the util destructures `{targetName, mapData, damageType}` and short-circuits `{disadvantage:false}` at `coronaAuraUtils.js:21-22` when `mapData.players` is empty. The `skipRangeCheck` flag it receives is ignored (util uses `await isWithinRange(...)` instead).

Even if awaited, every skipRangeCheck caller without `mapData` returns false ⇒ aura is dead on all four save lanes (npc save-prompt, aoe npc, player save, no-map context).

## Scoping check

Damage-type normalization/gate inside the util (`coronaAuraUtils.js:35-40`, Fire/Radiant only) is **correct as written** — never exercised live because disadvantage is never returned. Gate is inert, NOT too broad.

## Expiry note

`pendingExpirations` stamped with `expiryRounds:null` (buff still active at end, round 1) — known §46k-family clock-truncation; cited, not re-filed.

## Secondary observation (host-lane, out of CLA-063 scope — do not file here)

Divine Spark Harm (both casts, failed saves) produced **no damage roll/log/HP change** on Bandit 1 (save rolls logged `rollType:'save-damage'` but no damage application; also logged DC 14 vs sheet 18 — stale DC in the divineSpark modal lane).

## Suggested fix shape

Make consumers await: `const coronaResult = await getCoronaSaveDisadvantage(...)` in handleNpcSaveDamage/contextBuilder-map/aoeService paths — or provide a sync variant that honors `skipRangeCheck` (no `isWithinRange`) and iterates combatSummary participants (or accepts `coronaOfLightEnemies` + damageType directly) so no mapData required. Gate logic itself can stay.
