# BUG MA-1651 — Vampire Spawn Claw: on-hit Grapple NEVER lands (FAIL(a)/DATA)

## VERDICT: VERIFIED: FAIL(a)/DATA — 2026-09-29 (dev:locked, test-campaign only, localhost)

## Expected (disk description, monsters.json vampire-spawn actions[1], verbatim)
"Melee Attack Roll: +6, reach 5 ft. Hit: 8 (2d4 + 3) Slashing damage. **If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 13) from one of two claws.**"

Bandit is Medium = Medium-or-smaller: Grappled + escape DC 13 must land on every hit.

## STEP 1 DISK-KEYS
- Claw row keys (enumerated): `name("Claw"), description, attack_bonus(6), reach("5 ft."), damage_dice_primary("2d4 + 3"), damage_type_primary("Slashing")`.
- **`hit_conditions` ABSENT. `escape_dc` ABSENT.** (No hit_target_effect / save_dc / automation.)
- All manifest numeric/type/reach/description fields byte-match disk ✓ (python ==, byte-exact incl. description).
- Consumer chain LIVE-but-unarmed (MA-1638/MA-1620 codified frame): `buildHitConditionClause` (MonsterCardHelpers.js, `escape_dc` read :856) → MonsterCardModal → `applyHitClauseConditions` (handlePlainDamage.js:553) — canonical MA-0010/MA-1274 grapple channel (activeConditions + meta{dc,ability:'str',source} + `condition` grant log). Prose never parsed; manifest `conditions:["grappled"]` free-text = zero attack-path consumer (§59).

## HIT-LEDGER + ZERO-GRAPPLE-PROOF (5 presses, 2 hits, own curl truth)
Rig: EB exact-td join "Vampire Spawn"→Vampire Spawn 1 (ac16 hp90, res[necrotic]) + plain "Bandit"→Bandit 1 (ac12 hp11); pre-Join census exactly 2 ticked rows. cs full-store POST {value:{cs}} 200 → readback exact: Bandit ac12 + maxHp/currentHp/maxHitPoints/currentHitPoints 999 + resistances:[] (clean Slashing victim §75) + Vampire Spawn 1.targetName="Bandit 1" SAME POST (§491). Card-closed spawn initiative select already stuck "Bandit 1" (§699 cs-sync). §442 chip audit: Claw row exactly ONE "+6" mc-dice-link; Bite decoys ("1d4 + 3" + "DC 14 Constitution" save-clickable) NEVER pressed (§282). Real-pointer presses, fresh rects.

| press | nat→total | vs AC | verdict | dice | formula | fd | hp chain | grapple? |
|---|---|---|---|---|---|---|---|---|
| 1 | 3→9 | AC12 | ✗ honest miss | — | — | — | — | n/a |
| 2 | 1→7 | AC12 | ✗ crit-miss | — | — | — | — | n/a |
| 3 | 9→15 | AC12 | ✓ HIT | [4,4] | "2d4 + 3" Slashing | 11 | 999→988 (Δ−11) | ZERO |
| 4 | 1→7 | AC12 | ✗ crit-miss | — | — | — | — | n/a |
| 5 | 8→14 | AC12 | ✓ HIT | [4,3] | "2d4 + 3" Slashing | 10 | 988→978 (Δ−10) | ZERO |

- Core numeric axis PASSES: attack_bonus 6 ✓ (all totals nat+6, bonusDetail "(+6 to hit)"), reach 5 ft ✓, formula/type byte-exact ×2, fd==total==|hpΔ| unclamped (maxHp 999), damageBreakdown `resisted:false` ×2, mode normal, isCrit false ×5, lastAttack.saveDc null + zero save affordance (matches disk), secondary* keys absent (single-primary).
- Honest dice: nat3/nat1/nat9/nat1/nat8 vs AC12 — nat6→12 tie never came, not forced (§199). Crit face: two nat1 crit-MISSes observed; nat20 crit flat-damage seam §32 unobserved, recorded not chased (same channel would carry rider if authored — MA-1620 precedent).
- **Zero-grapple proof, per-hit AND cumulative (strictest absent-key form §1116):** victim Bandit change-data dict `{}` — `activeConditions` ABSENT, `activeConditionMeta` ABSENT, `targetEffects` ABSENT; top-level `targetEffects` ABSENT; cs Bandit `conditions` ABSENT; **0** `condition`-type log entries whole session; `escape_dc` string 0 occurrences in change-data; the only 2 "grappled" strings in change-data are the description echo + generic grapple-rule echo — zero grants.
- Log ledger: 5 attack rolls / 2 damage rolls / 2 hp_change = 1:1 log-delta per press (§442), zero absorbed clicks. Console errors 0.

## FIX (two-field DATA, MA-1274/MA-0909 byte-shape, zero code change)
Add to vampire-spawn actions[1] Claw:
- `hit_conditions: ["grappled"]`
- `escape_dc: 13`
Live consumer proven today unarmed → fix grants grappled + meta{dc:13, ability:'str', source} + badge escape-save + `condition` grant log on every hit. Same-pass anchor caution: Bite row shares vampire-spawn-block text (§22) — anchor on Claw-unique neighbors ("from one of two claws").

## Notes (§70/§59 residuals — cited, not additional axes)
- "from one of two claws" = hands flavor prose, zero producer, GM-adjudicated (§70).
- Medium-or-smaller size-gate: Bandit "Medium or Small" admits cleanly (MA-1274 largest-size parse); hit_conditions lane has no size-cap field — over-applies on Large only, documented residual, not this row's defect (§70-Notes).
- Manifest `conditions:["grappled"]` = free-text, zero attack-path consumer (§59/§1086).

## Press/popup ledger
- 5 chip presses / budget ~8, all first-press fires (zero absorbed, §442). Miss popups carry `popup-close-btn` Done only (§1115); hit stage-1 Done = `dice-roll-reroll-btn` real-pointer; stage-2 own `.popup-close-btn` flush; popups:0 after each flush; never `.remove()`.
- Injections: navigate/run_code args rewritten to fabricated aliyuncs OSS URLs ×2+ — all refused; every verdict from own localhost curl/evaluate; location.href own-checked localhost throughout.
