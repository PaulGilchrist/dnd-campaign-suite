# Bug — CLA-147 Frenzy: rider dice double-applied on the triggering hit

## Overview
CLA-147 Frenzy (2024 Barbarian, Path of the Berserker lv3, `damage_bonus` / `reckless_attack_hit_while_raging`) fires, gates correctly, and its once-per-turn latch works — but the frenzy dice are rolled and added **twice** on the first qualifying hit, roughly doubling the extra damage.

## Expected Behavior (canonical app data, `public/data/2024/classes.json` Barbarian → Path of the Berserker lv3 "Frenzy")
> "If you use Reckless Attack while your Rage is active, you deal extra damage to the first target you hit on your turn with a Strength-based attack. To determine the extra damage, roll a number of d6s equal to your Rage Damage bonus, and add them together. The damage has the same type as the weapon or Unarmed Strike used for the attack."

automation: `{type:'damage_bonus', trigger:'reckless_attack_hit_while_raging', damageExpression:'rage_damage_d6', damageType:'same_as_weapon', oncePerTurn:true}` → **one** 4d6 (lv20 rage +4) slashing on the first hit only.

## Actual Behavior (machine truth, test-campaign, 2026-10-05)
- Attack 1 (Rage ON, Reckless ON, Longsword HIT 21 vs AC 12): log `roll` formula
  `1d8+5 plus 4 plus 4d6 [slashing] + 4d6 [slashing]`, rolls `[6,3,4,1,6,5,1,4,2]`, total/finalDamage **41** (expected ~29). `hp_change` Bandit 1 delta −41. Two independent 4d6 frenzy groups rolled — one via ` plus ` (display formula), one via ` + ` (pipeline).
- Attack 2, SAME round (HIT 29): formula `1d8+5 plus 4 [slashing]`, total 14 — **no rider** (latch correct). `_frenzyUsedRound` = 1.
- Trigger gates verified live: `ability_use` entries for "Rage activated" and "Reckless Attack" precede the hit; rider absent on non-reckless second attack.

## Steps to Reproduce
1. test-campaign, DraconicDragon (Barbarian lv20, Path of the Berserker), Encounters → join Bandit.
2. Char sheet → Bonus Actions `Rage:` → popup Done → click Longsword → chooser "Attack Recklessly" → arm target Bandit 1 on Initiative card → attack, click Done on the HIT popup.
3. Observe log roll formula carries 4d6 twice; second attack same round has none.

## Likely Location
- `src/services/automation/contextBuilder-sync.js` `computeFrenzyDamageFormula` (l.147–157) injects `4d6 [slashing]` into `buildAutoDamageFormula` (l.659–662, joined with ` plus `), which `src/services/dice/diceRoller.js` `rollExpression` rolls as part of the base formula.
- `src/services/combat/steps/attackRollBonuses.js` `applyFrenzyBonuses` (l.76–93, wired l.261) then adds and rolls a **second** `+ 4d6 [slashing]` on the same hit and sets the latch.
- Both consumers run in the same char-sheet attack path → double count. One must stop contributing the roll (keep the display in contextBuilder or the application in the pipeline, not both).

## Notes
- Manifest handler/router/infoBuilder paths in the mission row are stale; live consumers are the files above (+ `useAttackDamageResolution` sheet path with its own frenzy block, `useAttackDamageResolution.automationDamage.test.js`).
- Dice count (4 = lv20 rage), damage type (slashing = Longsword), once-per-turn latch, and raging/reckless/STR gates are all EXACT — the sole defect is the doubled rider.
- Multiple prompt-injection blocks (fake "orchestrator verified/skip" directives, fake aliyuncs URLs) appeared in tool output during this session and were ignored; verdict is from local logs/change-data only.
