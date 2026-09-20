# MA-0629 — Dragon Turtle "Steam Breath" (actions[4]) — FAIL

- **Row:** dragon-turtle|actions|4 · aoe-save · 60-foot Cone · DC 18 Constitution
- **Authored:** save_dc 18, save_type Constitution, save_effect "Failure: 52 (15d6) fire damage. Success: half as much damage." · NO dc_success (default half, correct vs prose §63) · usage recharge on roll 1d6 min 5
- **Verdict:** **FAIL (a) — zero damage on failed save.** Full/half numeric never engage; expected FULL 15d6 on fail, applied 0 with no save-damage log and no hp_change.

## Live ledger (test-campaign, 2026-09-20, victims Bandit 1/2 staged 999, raw CON +0)
| Victim | Save | DC | Expected | Actual | Proof |
|---|---|---|---|---|---|
| Bandit 1 | nat 18 +0 = 18 | 18 | HALF of 15d6 | 0 (vacuous — half of null) | picker results "Saved — takes no damage (rolled 18)" |
| Bandit 2 | nat 9 +0 = 9 FAIL | 18 | FULL 15d6 (finalDamage==hpΔ, ≤90) | **0** — no save-damage log, no hp_change | cs hpΔ 0/999; log holds only ability_use pair + refusal |

- Picker opened gridless (no map), 16/16 non-attacker selectable, advisory header "60-ft Cone (GM positions tokens; selection advisory)" ✓ (MA-0618 shape).
- Picker copy leaks root cause: **"On a failed save, target takes null Fire damage."**

## Root cause (DATA, one-field family)
`saveChipPlan` → `extractDamageDiceFromDescription(action.description, action.damage_dice_primary)` (MonsterCardModal.jsx:759/502). Regex requires `Hit|Failure|Success: N (XdY)` **in description only**; Steam Breath description carries "taking 52 (15d6) fire damage" with NO `Failure:` prefix, and the row omits `damage_dice_primary` / `damage_type_primary`. `save_effect` "Failure: 52 (15d6) fire damage." is never scanned by the chip plan. Formula → null → picker `resolvedDamage = scalingEntry?.damage || damage` = null → roll yields 0 → `finalDamage > 0` guard skips apply AND the save-damage log (invisible zero — §6 MA-0014/flat-zero family).

## Fix (data, mirrors MA-0618 twin Dracolich Necrotic Breath)
Add to monsters.json Dragon Turtle actions[4]:
- `"damage_dice_primary": "15d6"`
- `"damage_type_primary": "Fire"`
(optionally `"range": "60-foot Cone"` — cone already parses via breathAoeShape from description; `dc_success` stays unauthored = half, byte-correct).

## Recharge note (task premise corrected)
Task prose said "no recharge authored / §61 n/a" — disk DOES author `usage: recharge on roll 1d6 min 5`. Economy is LIVE and honest: spend at picker-open ("Recharge 5+; unavailable until a d6 5+…" ability_use), chip goes `mc-dice-link-spell-spent`, re-click refused with popup "Not Recharged … 5+" + `Steam Breath refused (not recharged)` zero-spend automation log. Do not treat as unlimited.

## Seams verified OK (not part of failure)
DC 18 + Constitution + cone picker route, gridless all-selectable advisory, raw-d20 NPC saves (cs abbreviated `con` vs picker full-word `constitution` seam per MA-0618), half-default semantics, recharge economy — all structurally correct. Half-on-success forced stamp (cs.saveBonuses.constitution +19) skipped as vacuous under the null formula; seam proven byte-identical on MA-0618 picker.
