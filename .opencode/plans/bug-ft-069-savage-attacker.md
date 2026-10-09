# FT-069 Savage Attacker — FAIL (keep-reroll delta never applied)

**Date:** 2026-10-09 · **Campaign:** test-campaign · **Host:** EvasiveFighter (lv18 Battle Master 2024, Savage Attacker PERMANENT, Glaive equipped) · **Verdict: FAIL**

## Summary
The HIT damage popup correctly offers a "Savage Attacker" button (melee-only, gated by `_Savage_Attacker_usedRound`, cleared at owner turn-start). Two-roll display and choose-either buttons render. But clicking **Keep Reroll applies ZERO delta damage** — the kept reroll has no effect on HP. The log honestly admits "+0 damage" and the victim's `currentHp` never changes.

## Live evidence (log + combatSummary, own curl)
Attack: Glaive vs Bandit 1 (AC12), HIT 17+8=25.
- `roll damage` Glaive total **10** — popup "1d10+2 [slashing] + 6 [Heavy Weapon Mastery]: 2 +2" (original d10 = 2; adjustedTotal 10 includes mastery rider +6).
- `hp_change` Bandit 1 delta **-10**, currentHp 15.
- `ability_use` Savage Attacker: "rolled 2 (2) then rerolled 8 (8). Awaiting choice of which total to keep."
- Popup: "Savage Attacker: 2 → 8 — choose which total to keep (2 or 8)" + buttons `Keep First (2)` / `Keep Reroll (8)` — affordance present ✓.
- After clicking `Keep Reroll (8)`: popup display updates ("8 +2", "Reroll kept (+6)") BUT:
  - `ability_use`: "kept Savage Attacker reroll total 8 over original 2 (**+0 damage** to Bandit 1)"
  - NO further `hp_change`; combatSummary Bandit 1 `currentHp` stays **15** (expected 9, i.e. delta −6).
Final applied damage = original total (10), NOT chosen set (dice 8 + mod 2 + mastery 6 = 16). Missing delta = +6.

## Root cause (code)
- `src/components/char-sheet/DiceRollResult.handlers.js:192` — `handleSavageAttacker` passes `rawDamage: total`, where popup `total` = `adjustedTotal` **including mastery/feature rider bonuses** ("+ 6 [Heavy Weapon Mastery]").
- `src/components/char-sheet/CharSheet.handlers.js:305` — `damageDifference = (newTotal + (modifier || 0)) - rawDamage` reconstructs from **dice + flat modifier only**, excluding the riders already baked into rawDamage: `(8 + 2) − 10 = 0`, so the `damageDifference > 0` guard skips `applyDamageToTarget`.
- Any weapon whose damage popup total includes rider bonuses beyond the flat modifier (all Heavy/Shaving mastery-graze weapons, GWM, elemental adepts riders) zeroes or inverts the difference → feat inert despite offer + logs.

## Working aspects (recorded)
- Offer present on melee HIT damage popup; NOT offered on MISS popup ✓.
- Once-per-turn cap holds: 2nd same-turn hit popup `savage:false` (latch `_Savage_Attacker_usedRound=True`) ✓; re-armed on owner turn-start (`turnStartEffects.js:258` clear → latch null, re-offered round 2) ✓.
- Control (no click): original dice applied (−10), popup closes normally, no spend, latch stays null, option re-offered on next hit same turn ✓.
- No HEAL leak (2026-09-04 defect fixed): lower-reroll auto-keeps original with zero delta, no negative-damage heal ✓.
- Reroll touches only WEAPON dice; flat mod +2 and mastery +6 unchanged in display ✓.

## Secondary gaps (not primary FAIL)
- No choose-either UI when reroll ≤ original (`awaitingChoice = newTotal > originalTotal`, handlers.js:185/276) — feat auto-keeps original but still consumes the latch; RAW allows picking either roll.
- Popup post-choice display lies: "Reroll kept (+6)" printed while applied delta is +0.

## Fix direction
Compute the difference on a consistent basis: reroll delta = `newTotal − originalTotal` (dice-vs-dice), applied on top of the already-applied adjustedTotal; or thread the RAW dice total through instead of the rider-inflated popup total.

## Lane state
- EvasiveFighter feats temporarily stripped of `Charger` + `Shield Master` during verification (their attack_rider auto-modals hijacked/paused the damage pipeline — FT-074 collateral, weapon damage lost on every melee hit). RESTORED to disk post-run (backup /tmp/ef-backup.json, disk-verified).
- Monsters removed, change-data + log admin-cleared (GET-verified), campaign deselected.
