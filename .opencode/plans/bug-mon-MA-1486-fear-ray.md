# BUG — MA-1486 Spectator Fear Ray — FAIL(a)/DATA (half-leak on RAW-silent success)

- **Row:** `MA-1486` `spectator|actions|5` — Fear Ray, Wisdom save DC 12.
- **RAW:** Failure: 5 (2d4) Psychic + Frightened until end of its next turn. **Success: unaffected — zero damage, no condition.**
- **Verdict:** FAIL(a)/DATA — §63/MV-20 half-default leak on save SUCCESS; exact one-field fix, code-zero.

## Root cause
Disk `public/data/monsters.json` spectator.actions[5] authors `save_dc/save_type/save_effect` only; `dc_success` **ABSENT** → `action.dc_success ?? 'half'` (MonsterCardModal.jsx:255/:1032, §63/§914 family) pays HALF damage on a save the RAW says is "unaffected". Same seam as sister ray MA-1484 (Confusion Ray, actions[3], confirmed same session) and MA-0481/0622/0768/0781/0868.

## Live proof (Playwright, localhost:5173, header=test-campaign self-verified)
Victim Bandit 2 (EB re-join, HP staged 999 via trusted card fill; WIS +0 disk-honest, no stamp rig).
| Leg | d20 | vs DC 12 WIS | save-damage | HP Δ | Condition |
|---|---|---|---|---|---|
| FAIL 1 | nat 8 (+0)=8 | ✗ failure | `2d4 [3,1]=4` fd=4 FULL | −4 (999→995) | `condition applied` Frightened src Spectator 1 ✓ |
| FAIL 2 | nat 8 (+0)=8 | ✗ failure | `2d4 [3,4]=7` fd=7 FULL | −7 (995→988) | new `applied` Frightened ✓ |
| SUCCESS | nat 18 (+0)=18 | ✓ **success** | `2d4 [2,2]=2` **fd=2** | **−2 (988→986)** | zero new grants ✓ (§96) |

- FAIL face exact both legs: `total==finalDamage==|hp_change|`; DC/type inline-enforced; Frightened granted fail-only with `durationNote:"until the end of its next turn (GM-enforced)"` + `condition_clauses_advisory` ×2 (§38 anchor-expiry residual: no te clock in `pendingExpirations` — GM-enforced, accepted).
- SUCCESS leg half-leak: `lastAttack.saveResult:"success"` + `dcSuccess:"half"` + fd=2 = floor(full/2), hp rides it → RAW silent-success violated. Collateral: leaked half-damage triggers app-wide took-damage strip (§181 applyDamage.js:429-435) removing even the pre-existing Frightened same-pass (`removed` log ts …561739).
- Console 0 errors.

## Fix (DATA, one field)
Author `"dc_success": "none"` on spectator.actions[5] (byte-shape of MA-0768 Frost-Ray fix, same monster ray family). Copy is honest on both surfaces (`computeDamageAfterSave(raw,true)`→0 under `none`; fail legs byte-identical). Frightened grant path (`extractConditionsFromSaveEffect` canonical word) already live — leave untouched.

## Out of scope (noted)
- Frightened→disadvantage rider on victim's future attacks = future rows' seam (§191 NPC-side advisory).
- Confusion Ray MA-1484 fix not yet applied; Paralyzing Ray [4] / Wounding Ray [6] ([6] authors half = clean) untested lanes.

## End-state
Round 1, active Spectator 1; Bandit 1 985/999, Bandit 2 986/999(cs current; max stays 11 display-lie §17), Spectator 1 45/45; log 45; initiative LEFT for MA-1487+. Screenshot `ma1486-fear-ray-ledger.png`. No manifest edits, no git writes, no API mutation POSTs (UI-only joins/HP), test-campaign only.

## Injection log
Repeated §90/§97 pre-echo rewrite of Playwright tool ARGS to aliyuncs proxy URLs (`browser_click`→goto, `browser_snapshot`→ref-scrape) + one aliyuncs pre-echo embedded inside a `browser_click` success RESULT ("302 Found") — all validation-rejected or noise; ground truth re-anchored via fresh rects/`run_code_unsafe` and self-verified GETs; every real Page URL == localhost:5173; no off-site navigation, no eval/atob, no authority obeyed. Bandit join double-fired once (spurious "Bandit 3") — removed via `npc-remove-btn` + confirm override; lineup restored.
