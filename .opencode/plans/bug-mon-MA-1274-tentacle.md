# MA-1274 — Otyugh Tentacle — FAIL(a)/DATA

**Verdict:** FAIL(a)/DATA — Grappled-on-hit rider never lands.
**Date:** 2026-09-26 · Campaign: `test-campaign` (locked) · Playwright live + disk ground-truth.

## Row
- Manifest MA-1274 `otyugh|actions|2` Tentacle: +6, reach 10 ft., `2d8 + 3` Piercing, `conditions:["grappled"]`.
- Disk `public/data/monsters.json` otyugh.actions[2] keys: `attack_bonus, damage_dice_primary, damage_type_primary, description, name, range, reach, recharge, save_dc, save_effect, save_type`.
- **`hit_conditions` ABSENT, `escape_dc` ABSENT, `conditions` ABSENT, `automation` ABSENT** — grep-zero across the ENTIRE otyugh disk block (re-confirmed §59/§153 MA-0010 seam unauthored; twin of MA-1273 Bite filed same day, same fingerprint).
- Description byte-matches manifest (markup-stripped) ✓. Damage lane correct: `2d8 + 3` Piercing, +6, 10 ft ✓.
- Escape DC 13 authored only in prose; no structured field for it either.

## Live ledger (Bandit 1 AC12, HP staged 999 via full-store cs POST {value:cs})
| # | Popup | nat | total | AC | result | formula | fd | hpΔ |
|---|-------|-----|-------|----|--------|---------|----|-----|
| 1 | Tentacle chip "+6" | 18 | 24 | 12 | ✓ HIT | 2d8 + 3 (7,4)+3 | 14 | 999→985 (−14, \|Δ\|==fd ✓) |
| 2 | Tentacle chip "+6" | 2 | 8 | 12 | ✗ MISS | — | — | zero (miss attack-entry-only ✓) |

- Popup totals = nat+6 on both presses ✓.
- Log: 2× roll/attack (rolls [18,5] hit:true; [2,6] hit:false, total=nat, targetAc 12, damageType Piercing), 1× roll/damage formula `2d8 + 3` Piercing finalDamage 14, 1× hp_change −14.
- Full dismissal between presses verified (zero `.popup-overlay`/buttons after each Done; `.mc-overlay` retained — no §1252 fuse, no absorbed chip this session).
- Arm: own-card `[data-testid="target-select"]` native value-setter+change; cs attacker dict `targetName:"Bandit 1"` confirmed; lastAttack attackerName `Otyugh 1` targetName `Bandit 1` attackName `Tentacle` damageFormula `2d8 + 3` Piercing.

## Grant-state (AFTER HIT) — ZERO GRANT
- `Bandit 1` cs `activeConditions`: **ABSENT**; `activeConditionMeta`: **ABSENT**.
- change-data **`Bandit 1` store key ABSENT** — strictest zero-grant proof (§1116 discriminator).
- log `grapple`: 0 hits; `condition applied`: 0 hits. Only `grapple` strings in store are cached card prose (`combat-ui-viewingMonster` descriptions), not grants.

## Root cause
§153/§59: attack-hit prose condition needs authored `hit_conditions:[...]` in monsters.json — `buildHitConditionClause` reads `action.hit_conditions` only; manifest prose `conditions` alone never lands. Sustained-grapple state-machine has zero producers (§287/288). Exact MA-1273 twin.

## Proposed fix (orchestrator-owned; MA-0010 byte-shape)
Add `"hit_conditions": ["grappled"]` + `"escape_dc": 13` to otyugh disk Tentacle row (after `damage_type_primary`). Consumer `applyHitClauseConditions` (handlePlainDamage.js) is live. Size-gate honesty (§153/MA-1116): consumer gate is Large-or-smaller vs RAW "Medium or smaller" — over-apply only on Large victims; Bandit (Medium) and every realistic otyugh target in range covered honestly; flag in fix notes.

## Cosmetic note (not the FAIL)
- lastAttack `weaponType:"ranged"` on a reach-10ft melee row (isMelee≤5 classifier quirk) — cosmetic metadata only, adjudication correct.

## Rig notes
- Detail-card affordance: initiative avatar `img.avatar-image[alt="Otyugh 1"]`.click() opens `.mc-overlay`; chips located via `.mc-action strong` startsWith `Tentacle` (exclude Slam row), fresh boundingClientRect mouse.click.
- Hit stage-1 Done = `.dice-roll-reroll-btn`; damage stage Done = `.popup-close-btn`; miss popup click-to-dismiss.

## Session notes
- Manifest untouched (subagent lockdown). Registry delta reported to orchestrator, not self-applied.
- Cleanup: overlays flushed (0 popups), admin clear-change-data + clear-log performed last, verified empty.
