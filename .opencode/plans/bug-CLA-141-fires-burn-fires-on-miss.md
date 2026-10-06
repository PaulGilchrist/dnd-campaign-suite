# Bug — CLA-141 Fire's Burn fires on a MISS (hit-gate missing)

## Overview
CLA-141 "Fire's Burn – Goliath" (Fire Giant subrace trait) triggers, rolls 1d10 Fire damage, spends a use, and logs even when the triggering attack roll is a **MISS**. The trait must trigger only "When you hit a target with an attack roll and deal damage to it."

## Expected Behavior (canonical app-data wording, public/data/2024/races.json, Fire Giant trait)
> "When you hit a target with an attack roll and deal damage to it, you can also deal 1d10 Fire damage to that target. You can use this a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest."

MISS → no offer / no fire damage / no use spent / no fire log.

## Actual Behavior
Machine truth from test-campaign after a ✗ MISS:
- change-data `lastAttack`: `{attackerName:"ElderPaladin", targetName:"Disciplined_Monk", d20:7, bonus:11, total:18, targetAc:22, hit:false}`
- Log entry recorded anyway: `roll | ElderPaladin | Fire's Burn Damage | Fire | total 4 | "ElderPaladin used Fire's Burn to deal 4 fire damage to Disciplined_Monk."` followed by `hp_change`.
- `firesBurnUses` decremented 6 → 5 despite the miss.

The hit side works correctly: HIT popups (21/30/16 vs AC 12) → Fire's Burn action chip → 1d10 rolls 8,11,4,5,9,3 applied to Bandit 1, uses 6→0, exhaustion refusal popup at 0, Long Rest re-arm restores 6/6 (null-key max fallback).

## Steps to Reproduce
1. test-campaign, ElderPaladin (Goliath/Fire Giant, lvl 20, +11 to hit).
2. Encounters page → search "Bandit" → tick row checkbox → Join Encounter.
3. Initiative page → ElderPaladin card → target-select → `Disciplined_Monk` (AC 22).
4. ElderPaladin sheet → click Longsword cell → roll a MISS (e.g. d20 7 +11 = 18 vs AC 22) → click **Done**.
5. Click the "Fire's Burn:" chip in the Actions/feature list.
6. Observe Fire's Burn damage popup, fire `roll` + `hp_change` log entries, and `firesBurnUses` decrement — despite `lastAttack.hit === false`.

## Likely Location
- `src/services/automation/handlers/class-other/giantAncestryUtils.js:181` — `attackerRollGate()` validates attackEvent presence, attackerName, rollType==='attack', targetName, but **never checks `lastAttack.hit`**.
- Consumers: `handleFiresBurn` (`giantAncestryDispatch.js:51`) and `handleFiresBurnDirect` (`giantAncestryTraits.js:51`) — both call this shared gate.
- Same hole affects `frostsChillAttackerGate` (delegates to the same function) — Frost's Chill likely has the identical miss bug.
- Note stale manifest paths in the mission row (`src/services/combat/automation/...`); live code is under `src/services/automation/...`.

## Notes
- No "Use Fire's Burn" rider ever renders inside the HIT/MISS attack popup; the Actions-panel feature chip is the only trigger, and it is always clickable — there is no HIT-conditional offer UI.
- Regression test `giantAncestry-firesBurn.regression.test.js` locks runtime key + target handling but evidently does not assert the miss-control (zero-delta on miss).
- Control probes: uses=0 → refusal popup, zero damage ✓; Long Rest → uses restored 6/6 ✓; MISS → **fires** ✗ (proves FAIL: triggered but behaved wrong).
