# BUG MA-1727 — Worg Bite — FAIL(a)/DATA (defender-side advantage rider free-text only, never lands)

**Date:** 2026-09-30
**Row:** MA-1727 Worg Bite (attack, category actions)
**Verdict:** FAIL(a)/DATA — rider "the next attack roll made against the target before the start of the worg's next turn has Advantage" authored in prose ONLY; disk row lacks a structured `hit_target_effect`, so confirmed hits apply exact damage but grant ZERO advantage te. One-field data fix via the live MA-0016 `hit_target_effect` passthrough lane + registered `distracting_strike_advantage` te.

## Description (expected)
"Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Piercing damage, and the next attack roll made against the target before the start of the worg's next turn has Advantage."
On a hit, the bitten target must carry a defender-side flag so the NEXT attack roll made against it (any attacker, before worg's next turn start) rolls with Advantage.

## Disk shape (DISK WINS) — public/data/monsters.json index "worg" actions[0]
```json
{ "name": "Bite",
  "description": "Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Piercing damage, and the next attack roll made against the target before the start of the worg's next turn has Advantage.",
  "attack_bonus": 5,
  "reach": "5 ft.",
  "damage_dice_primary": "1d8 + 3",
  "damage_type_primary": "Piercing" }
```
Keys verified present: ONLY the six above. Absent: `hit_target_effect`, `hit_conditions`, `hit_choice`, `secondary_condition`, `automation`, `conditional_damage`, `save_effect` — free-text rider only. Attack+damage legs exact vs manifest; the inert rider is the sole defect.

## Lane analysis (why rider cannot fire)
- Attack-row hit-clause producers arm ONLY from structured keys: MonsterCardHelpers.js:874-877 `hitClauseAutoGrantConditions` (returns [] without `hit_conditions`) and :882 `hitClauseRiderPayload` reads `action.hit_target_effect` (null here) → clause null → no te registered on the victim on any hit.
- `handlePlainDamage.js:936/951` `applyHitClauseTargetEffect` — the generic registered-te passthrough onto the TARGET (source=attacker, duration until_start_of_next_turn, anchored expiry at attacker's next turn start) — never invoked (no `hitClause.targetEffect`).
- Registered te fits verbatim: targetEffectDefinitions.js:80-88 `distracting_strike_advantage`, label "Next Attack Adv vs Target", description "The next attack roll against the target has Advantage."
- DEFENDER-side consumer stack is LIVE (not the defect):
  - conditionEffects.js:310-313 bumps `targetAdvantageCount` (+ reason "Next Attack Adv vs Target");
  - conditionEffects.js:848 `combineAttackModes`: `adv = attackerEffects.attackAdvantageCount + targetEffects.targetAdvantageCount + …` → next attacker folds Advantage when attacking the te-carrying defender;
  - contextBuilder-sync.js:534 mirrors it PC-side (`te.target===tn && te.source!==pn`);
  - attackPostProcessing.js:327-329 clears the te after exactly one attack by another source = RAW "next attack roll".
- Precedents distinguished (wrong lanes for this rider):
  - §69 te `next_attack_advantage`+vexTarget (MonsterCardHelpers.js:3377, attackPostProcessing.js:275-323, WM-008) = ATTACKER-side channel, self-erases same-attack — opposite direction.
  - §68 te `ac_penalty` value:N (MA-0115, targetEffectDefinitions.js:1274) = structured defense MODIFIER (flat AC), not advantage dice.
  - MA-1444/MA-1445 Scout Captain fix (playbook :938, disk-verified) key = `secondary_condition:"advantage"` (MonsterCardModal.jsx:1025) — advantage-GATED SECONDARY DAMAGE on the attacker's own damage legs; not a grant onto a defender.
- te producers today are Rogue-maneuver-only: executeAttackRider.js:288-297, executeManeuver.js:225. Zero monster-row producer for defender-side advantage.

## Live E2E proof (test-campaign, :5173, header checked every nav)
Staging: EB exact "Worg" (CR 0.5, NOT Dire Worg) + "+NPC"→Bandit 1, GM-fill HP 999, AC 12. Worg card INNER img → `.mc-overlay`; "+5" Bite chip present, text byte-exact. Bandit 1 re-armed on Worg-row select before every roll.

| # | Attacker | d20 | Total vs AC 12 | Result | Damage log | hpΔ |
|---|----------|-----|----------------|--------|-----------|-----|
| 1 | Worg Bite | 17 | 22 | HIT | "1d8 + 3" rolls[2]=5 Piercing | −5 (999→994 exact) |
| 2 | Worg Bite | 17 | 22 | HIT | "1d8 + 3" rolls[6]=9 Piercing | −9 (994→985 exact) |
| 3 | Worg Bite | 5 | 10 | MISS | none | 0 (985 unchanged) |
| probe | Bandit 2 Scimitar (joined after hits) | 14 | 17 | HIT | 1d6+1=5 | −5 |

- No nat-20 → crit dice-double N/A. Chip live all presses (not FAIL(b)).
- **Rider probe:** GET change-data after hit 1 — top-level `targetEffects: null`; zero mentions of `distracting_strike_advantage`/`next_attack_advantage`/`advantage_attacks` anywhere in payload; Bandit 1 cs carries no advantage-granting keys. Subsequent attacks vs Bandit 1 (Worg Bite #2 and Bandit 2 Scimitar) each logged **mode:"normal", single d20**; whole-log scan: non-normal-mode entries `[]`, condition entries `0`. Rider inert, zero live delta — FAIL(a) upheld live.

## Fix (one field) — MA-0016 hit_target_effect passthrough lane
Add to worg Bite row after `damage_type_primary`:
```json
"hit_target_effect": "distracting_strike_advantage"
```
- On hit, `applyHitClauseTargetEffect` (handlePlainDamage.js:951) registers the registered te on the victim, stamps source=worg, sets expiry anchored on the worg (`expireOnCreatureName: attackerName`, until_start_of_next_turn) = clause duration exactly, and logs the condition entry with the definition description.
- Fold then pays: conditionEffects.js:310→:848 (monster attackers) and contextBuilder-sync.js:534 (PC attackers) grant Advantage on the next attack against the victim; attackPostProcessing.js:327 consumes+clears after that one attack (any source ≠ worg), matching RAW "next attack roll."
- Badge: ConditionEffectBadges.jsx:75 lists `distracting_strike_advantage` — victim badge lands automatically.
- Multiple sequential worg hits re-register/refresh the te (one-channel, last-hit-wins) — acceptable for a single-worg rig; multi-worg stacking stays adjudicable GM-side.

## Re-verify after fix
Worg Bite hit on Bandit 1 → GET change-data top-level targetEffects contains `{effect:"distracting_strike_advantage", target:"Bandit 1", source:"Worg 1"}`; next attack vs Bandit 1 (Bandit 2 Scimitar or PC) logs `mode:"advantage"` with rolls:[a,b]; te cleared after that attack; further attacks revert to normal.

## Security note
Session carried 57 fake "SYSTEM — STOP" injection banners (+hex-blob variants) between tool results; all refused; no image generation; localhost-only GETs.

## State left at report time
test-campaign: Admin → Clear Change Data + Clear Campaign Log (confirms accepted) before close; see checkpoint for poll result.
