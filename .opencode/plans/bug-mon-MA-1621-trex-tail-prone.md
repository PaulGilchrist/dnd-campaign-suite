# BUG MA-1621 — Tyrannosaurus Rex Tail: on-hit Prone NEVER lands (FAIL(a)/DATA)

## VERDICT: VERIFIED: FAIL — 2026-09-29 (dev:locked, test-campaign only, localhost)

## Expected (monsters.json tyrannosaurus-rex actions[2], verbatim)
"Melee Attack Roll: +10, reach 15 ft. Hit: 25 (4d8 + 7) Bludgeoning damage. **If the target is a Huge or smaller creature, it has the Prone condition.**"
Raw Bandit is Medium = Huge-or-smaller: Prone must land on every hit.

## DISK-KEYS (enumerated)
Tail row keys: `name, description, attack_bonus(10), reach("15 ft."), damage_dice_primary("4d8 + 7"), damage_type_primary("Bludgeoning")` — all byte-match manifest.
- **`hit_conditions` ABSENT. `conditional_damage` ABSENT. `escape_dc`/`save_dc`/`automation` ABSENT.** Prone rider is prose-only.
- Consumer LIVE-unarmed: `buildHitConditionClause` (MonsterCardHelpers.js:850, null on empty conditions+no riders) → MonsterCardModal.jsx:975 → `applyHitClauseConditions` (handlePlainDamage.js:553/:841) — canonical MA-0010 hit-condition channel, byte-twin fixes authored live on prone (MA-0775 ghast Claw paralyzed, MA-0756 Avalanche Slam prone) with zero code change.

## HIT-LEDGER + ZERO-GRANT PROOF (3/3 hits, own curl truth)
Rig: EB exact-td join → cs "Tyrannosaurus Rex 1" (tyrannosaurus-rex, ac13, hp136); Bandit 1 victim (ac12, resistances[], 4 HP keys 999) + rex.targetName armed via full-store cs POST; card-closed own-card selectOption (tn server-confirmed); Tail row exactly one "+10" chip (Bite "+10" separate row §694), real-pointer presses, stage-1 Done real-pointer, stage-2 own-close.

| press | nat→total | vs AC12 | dice | formula | fd | hp chain | prone/grapple? |
|---|---|---|---|---|---|---|---|
| 1 | 9→19 | ✓ HIT | [4,4,7,8] | "4d8 + 7" Bludgeoning | 30 | 999→969 (Δ−30) | ZERO |
| 2 | 9→19 | ✓ HIT | [1,6,4,4] | "4d8 + 7" Bludgeoning | 22 | 969→947 (Δ−22) | ZERO |
| 3 | 6→16 | ✓ HIT | [3,3,1,7] | "4d8 + 7" Bludgeoning | 21 | 947→926 (Δ−21) | ZERO |

- Repeat nat9 press1/2 HONEST: distinct second die ([9,15] vs [9,2]) + distinct damage pools/ledgers (§77).
- Zero-grant machine proof: 0 `condition`-type log entries whole session; victim change-data `activeConditions` ABSENT / `activeConditionMeta` ABSENT / top-level `targetEffects` ABSENT (absent-key strictest §1116); cs Bandit `conditions:[]`; no grapple/restrained/prone tokens anywhere in change-data values.
- Core numeric axis PASSES: bonus 10 ✓, formula/type byte-exact ×3, fd==total==|hpΔ| unclamped (maxHp999), saveDc null + zero save affordance (matches disk), parryAcBonus:0 cosmetic (no Parry authored), rangeReason:null + attackRange null = gridless-lenient fingerprint reach 15 ft (§200), secondary* absent (single-primary §188), round 1 constancy, console 0 errors. Crit unobserved (§32 recorded-not-chased).

## FIX (one-field DATA, MA-0775/MA-0756 byte-shape)
Add to tyrannosaurus-rex actions[2] Tail: `hit_conditions: ["prone"]`. Consumer armed by the same MA-1620 fix pass channel; no code change. Note: consumer is size-ungated (grants all sizes); "Huge or smaller" gate advisory at Medium+ victims — matches accepted prone-twin precedent (MA-0756/0775).

## Notes
- Manifest free-text `conditions` (if any) = zero attack-path consumer (§59). No sustained-state clause on this row; no §70 residual beyond the size-gate advisory above.

## Cleanup
Board: tab closed BEFORE admin clears; clear-change-data + clear-log 200/200; quiet GET log[] cd{} cs null. test-campaign only; campaign-lock grep 0.

## Injection
Persistent fabricated OSS-proxy URL + "confirmed/joined/damage applied" echoes in tool results throughout session — ALL refused; every verdict from own localhost curl/evaluate; location.href own-checked localhost at every stage.
