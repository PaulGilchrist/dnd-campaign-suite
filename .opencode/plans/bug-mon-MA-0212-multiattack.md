# BUG MA-0212 — Ancient Gold Dragon Weakening Breath grants 1d6 subtract-die (data: 1d10)

Verdict scope: MA-0212 multiattack replace (B). FAIL-grade numeric defect on the failed-save grant state/log. All other legs PASS (see table in return).

## Evidence (self-issued localhost fetches, test-campaign, 2026-09-15 UTC)
- Data truth (monsters.json ancient-gold-dragon actions[4] save_effect, verbatim):
  "Failure: The target has Disadvantage on Strength-based D20 Tests and subtracts 5 (1d10) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically."
- 10:57:26Z cone picker opened via `DC 24 Strength` chip; picker note rendered "subtracts 1d10" (parseWeakeningBreathClause captured `1d10` correctly — MonsterCardHelpers.js:87 regex).
- 10:58:28Z /change-data targetEffects after LightfootHalfling auto-fail (saveResult 16+1=17 vs DC 24):
  `{"target":"LightfootHalfling","effect":"weakening_breath","source":"Ancient Gold Dragon 1","duration":"1_minute","rounds":10,"dc":24,"saveType":"Strength","strCheckDisadvantage":true,"damageSubtractDie":"1d6"}` ← WRONG die
- 10:58:28Z condition log: "…subtracts 1d6 from damage rolls…" ← WRONG die in player-facing text
- Comparison: Adult Gold Dragon (MA-0102) data uses 1d6 — the service was authored for Adult and reused unparameterized.

## Root cause
- `src/services/rules/features/weakeningBreathService.js:33` — `const die = '1d6';` hardcoded; used for te `damageSubtractDie` and both log strings.
- `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx:483` — calls `grantWeakeningBreath({…})` WITHOUT forwarding `weakeningBreath.damageSubtractDie` (the parsed per-monster die is available in `ctx.weakeningBreath` at :482 and even displayed in `weakeningPickerCopy` :613).
- `targetEffectDefinitions.js:264` default `damageSubtractDie:'1d6'` is fine as Adult default, but grant overwrites te with the hardcoded value regardless of clause.

## Fix recipe (code+test, no data edit needed)
1. `grantWeakeningBreath({…, die})`: accept `die = parsed.damageSubtractDie || '1d6'`; use it in registerTargetEffect `damageSubtractDie` and in both log descriptions ("subtracts ${die}").
2. SaveAttackAoeModal.jsx:483: pass `die: weakeningBreath.damageSubtractDie`.
3. Repeat-save log text in `applyWeakeningBreathTurnEnd` — no die text present today (OK); keep byte-identical.
4. Tests: extend `weakeningBreathService.test.js` + `SaveAttackAoeModal.weakening-breath.test.jsx` — clause with `(1d10)` → te `damageSubtractDie:'1d10'`, condition log contains "subtracts 1d10"; Adult clause `(1d6)` stays byte-identical (regression lock).
5. Consumer note: `handlePlainDamage.js` + `d20RollComputation.js` read `te.damageSubtractDie`/`strCheckDisadvantage` generically (MA-0207/MA-0102 chains, `weakeningBreathReduction`/`weakeningBreathRoll` fields observed live on damage logs) — fix is producer-side only, no consumer change.

## Also recorded (honest gaps, NOT bug-graded per brief pre-cite)
- Guiding Bolt lv4 hit-rider ("next attack roll against target has advantage") — NO te producer anywhere (grep-zero; follow-up Rend live mode:normal, targetEffects []). Same §7 zero-consumer family; replace LEG itself works (+16 prose-fallback bonus, 7d6 lv4 formula, exact math).
- Miss boundary unobservable on AC-14 victim (nat-min 1+17=18 ≥ 14); popup AC truth 14 = log targetAc 14.
- Cosmetic (cited family MA-0168): lastAttack.secondaryDamage mislabeled Slashing/14 while log carries Fire 12 correctly.
- Repeat-save-at-end-of-turn: LIVE (not the MA-0118 inert family) — prompt "(Disadvantage) DC 24" rolled 2d20 [3,16], save-weakening-repeat log mode:disadvantage, te kept on fail.

## READ BACK
- Re-read after fix: `grantWeakeningBreath` signature + SaveAttackAoeModal:483 call site + new test names.
- Live re-probe: Ancient Gold Dragon cone save-fail → te `damageSubtractDie:"1d10"` + condition log "subtracts 1d10"; Adult Gold control stays 1d6.
- Host state to restore: LightfootHalfling GM-set HP (150 → drained to 10 live) — Admin clear resets to max-fallback; halfling was NOT edited on disk.
