# BUG — MA-1484 Spectator Confusion Ray — FAIL(a)/DATA (half-leak on RAW-silent success)

## Row (verbatim)
`{"id":"MA-1484","stableKey":"spectator|actions|3","monsterIndex":"spectator","monster":"Spectator","actionIndex":3,"actionName":"Confusion Ray","category":"actions","actionType":"save","saveDc":12,"saveType":"Wisdom","saveEffect":"The target takes 5 (2d4) Psychic damage, and can't take Reactions until the end of its next turn. On its next turn, the target can't move, and it uses its action to make a melee or ranged attack against a randomly determined creature within range. If the target can't attack, it does nothing on that turn.","description":"Wisdom Saving Throw: DC 12. Failure: 5 (2d4) Psychic damage, and the target can't take Reactions until the end of its next turn. On its next turn, the target can't move, and it uses its action to make a melee or ranged attack against a randomly determined creature within range. If the target can't attack, it does nothing on that turn.","verified":"not verified"}`

## VERDICT: FAIL(a)/DATA — §63 MV-20 half-default leak on RAW-silent success row
RAW success = UNAFFECTED (zero damage, no te). Disk row omits `dc_success` → `getSaveDcSuccess` hard-defaults `"half"` (MV-20, playbook §43/§63) → success legs pay half Psychic damage. Live proof 2/2 success legs leaked:
- Fire A: nat17 vs DC12 SUCCESS — save-damage 2d4:[3,1] sum4 → finalDamage 2 (half), hpΔ −2 (999→997), log stamp `dcSuccess:"half"`, popup "✓ SAVE SUCCESS (17 vs DC 12) … 2 damage applied".
- Fire B: nat19 vs DC12 SUCCESS — 2d4:[4,2] sum6 → finalDamage 3 (floor-half), hpΔ −3 (997→994).

**Fix (one DATA field, code-zero):** `"dc_success": "none"` on `spectator.actions[3]` — family twins MA-0481/0622/0768 (gazer Frost Ray)/0781/0868. Honest copy both surfaces. Post-fix expected: success fd0 / zero hp_change / no save-damage applied leg; fail byte-identical (already exact, see below).

## Everything else LIVE and exact (why FAIL(a), not FAIL(b))
- DC 12 Wisdom enforced inline (EB-NPC seam, raw-d20 +0 stamp per §96/§124 — adjudication truth `lastAttack.saveResult`): nat17✓ nat19✓ pass; nat4✗ nat2✗ fail. 4 real fires after 1 absorbed click (log count frozen 3→7 first fire, +0 on absorbed replay, +4/+6/+6 thereafter; hp trail 999→997→994→987→985 exact per-leg).
- FAIL face 2d4 Psychic FULL exact: fd==total==|hpΔ| — nat4 leg [4,3]→7 (994→987); nat2 leg [1,1]→2 (987→985). Formula stamp "2d4", damageType Psychic ✓ (dice prose-only, parsed live by `extractDamageDiceFromDescription` passthrough, Modal:581/:2240).
- te `no_reactions` GRANTED ON FAIL (registered `targetEffectDefinitions.js:274`, MA-0087 trio family): top-level change-data `targetEffects [{target:"Bandit 1", effect:"no_reactions", source:"Spectator 1", duration:"until_end_of_next_turn", actionName:"Confusion Ray"}]`; parser `parseSlowedClauses` regex `/can[’']?t take Reactions/i` (MonsterCardHelpers.js:146) matches save_effect; inline grant seam `grantSlowedClausesInline` (saveProcessing.js:480/519, MA-0711) — clock live in `Spectator 1.pendingExpirations`: `{appliedRound:1, expiryRounds:2, remove_target_effect no_reactions}` — "until … next turn"→rounds:2 honesty, `resolveInlineSlowedDuration` comment names this exact row. `condition applied` log ×2 (once per fail leg); success legs granted ZERO te/conditions ✓ (no over-grant).

## Clause breakdown (structured vs prose vs consumer)
| Clause | Disk | Parser/consumer | Live |
|---|---|---|---|
| DC 12 WIS | structured `save_dc/save_type` | save chip `mc-dice-link-save-clickable` → inline save | enforced ✓ |
| 2d4 Psychic (fail) | prose (`5 (2d4)` in description) | `extractDamageDiceFromDescription` → saveDamageFormula | full-exact on fail ✓ |
| success = none | ABSENT `dc_success` | `getSaveDcSuccess` MV-20 default "half" | **HALF LEAK ✗** |
| can't take Reactions | prose save_effect | `parseSlowedClauses` → te `no_reactions` + rounds:2 clock | granted on fail ✓ |
| can't move (next turn) | prose | speed_zero parser needs byte "speed is 0" (Helpers:83) — NO match; no te | advisory (§70), honestly logged |
| random-attack next turn | prose | confused machinery = PC Confusion-spell channel only (`confusionTurnStartHandler` d10 table / confused te) — no producer from this row | advisory (§70), honestly logged |
| "if can't attack, does nothing" | prose | zero consumer | advisory (§70) |

Advisory surface: `condition_clauses_advisory` automation log ×2 — "…behavior table … GM-enforced — no behavior-table subsystem; te clock rounds:2…". NOTE cosmetic: advisory copy hardcodes the Faerie-Dragon d6/1-4/5-6 wording (MA-0711 template, §217-class) — Confusion Ray RAW is no-move + random-attack, not a d6 table; cosmetic only, mechanics ledger honest.

## Ledger (test-campaign, Bandit 1 WIS +0-inline vs DC12, maxHp 999 via sanctioned cs POST)
| Fire | d20 | result | 2d4 | raw | fd | HP | te |
|---|---|---|---|---|---|---|---|
| 1 | 17 | success | [3,1] | 4 | **2 (half leak)** | 999→997 | none ✓ |
| 2 | 19 | success | [4,2] | 6 | **3 (half leak)** | 997→994 | none ✓ |
| 3 | 4 | failure | [4,3] | 7 | 7 full ✓ | 994→987 | no_reactions ✓ |
| 4 | 2 | failure | [1,1] | 2 | 2 full ✓ | 987→985 | no_reactions ✓ |

Console 0 errors. Screenshot `ma1484-confusion-ray-ledger.png`.
