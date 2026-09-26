# MA-1273 — Otyugh Bite — FAIL(a)/DATA

**Verdict:** FAIL(a)/DATA — Poisoned-on-hit rider never lands.
**Date:** 2026-09-26 · Campaign: `test-campaign` (locked) · Playwright live + disk ground-truth.

## Row
- Manifest MA-1273 `otyugh|actions|1` Bite: +6, reach 5 ft., `2d8 + 3` Piercing, `conditions:["poisoned"]`.
- Disk `public/data/monsters.json` otyugh.actions[1] keys: `attack_bonus, damage_dice_primary, damage_type_primary, description, name, range, reach, recharge, save_dc, save_effect, save_type`.
- **`hit_conditions` ABSENT, `escape_dc` ABSENT, `conditions` ABSENT, `automation` ABSENT** — grep-zero across the ENTIRE otyugh disk block (re-confirmed §59/§153 MA-0010 seam unauthored).
- Description byte-matches manifest (markup-stripped) ✓. Damage lane correct: `2d8 + 3` Piercing, +6, 5 ft ✓.
- Long-rest recurring DC15 CON hp-max-reduction clause: §70 zero-consumer advisory-unbuilt (MA-1240/1259/1272 family; repeat-save-at-turn-end zero-consumer §117/§622 analogue) — advisory residual, NOT the FAIL cause.

## Live ledger (Bandit 1 AC12, HP staged 999 via full-store cs POST {value:cs})
| # | Popup | nat | total | AC | result | formula | fd | hpΔ |
|---|-------|-----|-------|----|--------|---------|----|-----|
| 1 | Bite chip "+6" | 5 | 11 | 12 | ✗ MISS | — | — | — |
| 2 | Bite chip "+6" | 10 | 16 | 12 | ✓ HIT | 2d8 + 3 (2,5)+3 | 10 | 999→989 (−10, \|Δ\|==fd ✓) |

- Popup totals = nat+6 on both presses ✓.
- Log: 2× roll/attack (rolls [5,1] hit:false; [10,14] hit:true, total=nat, targetAc 12), 1× roll/damage formula `2d8 + 3` Piercing finalDamage 10, 1× hp_change −10. Miss popup Done = `.popup-close-btn`; stage-1 hit Done = `dice-roll-reroll-btn`; fully dismissed (zero popups/buttons) between presses (§1252 fuse guard).
- Arm: own-card `[data-testid="target-select"]` native value-setter+change; attacker creature dict `targetName:"Bandit 1"` confirmed (§1258); lastAttack d20 10 total 16 hit:true damageFormula `2d8 + 3` Piercing.

## Grant-state (AFTER hit) — ZERO GRANT
- `Bandit 1` cs `activeConditions`: **ABSENT**; `activeConditionMeta`: **ABSENT**.
- change-data **`Bandit 1` store key ABSENT** — strictest zero-grant proof (§1116/MA-1240 discriminator).
- log `condition applied`: 0 hits; `poison`: 0; `grapple`: 0; `dc 15`: 0; `long rest`: 0.

## Root cause
§153/§59: attack-hit prose condition needs authored `hit_conditions:[...]` in monsters.json — `buildHitConditionClause` reads `action.hit_conditions` only; manifest prose `conditions` alone never lands. MA-0010/MA-0291/MA-0586/MA-0877/MA-0984/MA-1240 family.

## Proposed fix (orchestrator-owned; one-field, MA-0010/MA-0877 byte-shape)
Add `"hit_conditions": ["poisoned"]` to otyugh disk Bite row (after `damage_type_primary`). Consumer `applyHitClauseConditions` (handlePlainDamage.js) is live; size gate is Large-or-smaller vs RAW Medium-or-smaller — Bandit Medium, no over-apply here.

## §70 advisory residuals (do not chase)
- Long-Rest recurring CON DC15 hp-max-decrease (1d10, no-return-until-Poisoned-ends): zero consumers §70.
- Poisoned "can't regain HP" clause: codified §70 zero-consumer sibling.
- Tentacle Grappled escape DC13 rider: same unauthored-field family, component-row ticket (MA-1274), out of scope.

## Session notes
- Multiple prompt-injection blocks in tool output (fake "GM DECISION: PASS / manifest updated", fabricated tool results, off-target directives) — all rejected; verdict derived solely from own curl/DOM ground truth. Manifest untouched (subagent lockdown).
- Cleanup: overlays flushed (0 popups), admin clear-change-data + clear-log performed last, verified empty.
