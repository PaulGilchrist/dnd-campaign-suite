# BUG MA-1620 — Tyrannosaurus Rex Bite: on-hit Grapple NEVER lands (FAIL(a)/DATA)

## VERDICT: VERIFIED: FAIL — 2026-09-29 (dev:locked, test-campaign only, localhost)

## Expected (disk description, monsters.json tyrannosaurus-rex actions[1], verbatim)
"Melee Attack Roll: +10, reach 10 ft. Hit: 33 (4d12 + 7) Piercing damage. **If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17).** While Grappled, the target has the Restrained condition and can't be targeted by the tyrannosaurus's Tail."

Raw Bandit is Medium = Large-or-smaller: grapple + escape DC 17 must land on every hit.

## Actual: DISK-KEYS
- Bite row keys (enumerated): `name, description, attack_bonus(10), reach("10 ft."), damage_dice_primary("4d12 + 7"), damage_type_primary("Piercing")`.
- **`hit_conditions` ABSENT. `escape_dc` ABSENT.** (No hit_target_effect / save_dc / automation.)
- Consumer chain LIVE-but-unarmed: `buildHitConditionClause` (MonsterCardHelpers.js:850 — returns null when `hit_conditions` empty and no riders; `escape_dc` read :856) → MonsterCardModal.jsx:975 → `applyHitClauseConditions` (handlePlainDamage.js:553, invoked :841) — the canonical MA-0010 grapple channel (activeConditions + activeConditionMeta{dc, ability:'str', source} + `condition` grant log). Prose is never parsed; manifest `conditions:[grappled,restrained]` free-text has zero attack-path consumer (§59/§1086).
- Size-gate precedent confirms fix will land raw-Medium: isLargeOrSmallerTarget parsed ✓ (MA-0909); grapple needs no movement gate (MA-1344 contrast MA-1127) → on-hit grapple is a DATA fix, NOT advisory.

## HIT-LEDGER + ZERO-GRAPPLE-PROOF (3/3 hits, per-hit machine audit, own curl truth)
Victim: Bandit 1 (monsterIndex bandit, ac12, resistances[], HP 999 4-key full-store cs POST; rex.targetName armed same POST §491 + card-closed own-card selectOption). Attacker: EB exact-td join "Tyrannosaurus Rex" → cs "Tyrannosaurus Rex 1" (tyrannosaurus-rex, ac13, hp136). Chip: Bite row exactly one "+10" (Tail "+10" separate row, scoped `.mc-action` strong.trim().startsWith('Bite') §694); real-pointer presses, stage-1 Done via real-pointer `button.dice-roll-reroll-btn`, stage-2 flushed via own close.

| press | nat→total | vs AC | verdict | dice | formula | fd | hp chain | grapple? |
|---|---|---|---|---|---|---|---|---|
| 1 | 13→23 | AC12 | ✓ HIT | [4,3,1,6] | "4d12 + 7" Piercing | 21 | 999→978 (Δ−21 exact) | ZERO |
| 2 | 19→29 | AC12 | ✓ HIT | [8,8,2,11] | "4d12 + 7" Piercing | 36 | 978→942 (Δ−36 exact) | ZERO |
| 3 | 10→20 | AC12 | ✓ HIT | [5,11,9,11] | "4d12 + 7" Piercing | 43 | 942→899 (Δ−43 exact) | ZERO |

- Zero-grapple proof, per-hit AND cumulative (strictest absent-key form §1116): victim change-data `activeConditions` **ABSENT**, `activeConditionMeta` **ABSENT**, top-level `targetEffects` **ABSENT**; **0** `condition`-type log entries whole session; cs Bandit `conditions:[]`. Only "grappled" string in change-data is the description echo.
- Core numeric axis PASSES: attack_bonus 10 ✓, all hits honest vs AC12, damage formula/type byte-exact, fd==total==|hpΔ| unclamped (maxHp 999), lastAttack.saveDc null + zero save affordance (matches disk — no save fields authored), secondary* keys absent (single-primary §188), round 1 constancy.
- Crit face unobserved (nats 13/19/10); "4d12*2+7" §32 recorded-not-chased (same channel would carry rider if authored).

## FIX (two-field DATA, MA-1274/MA-0909 byte-shape)
Add to tyrannosaurus-rex actions[1] Bite:
- `hit_conditions: ["grappled"]`
- `escape_dc: 17`
Live consumer proven today unarmed → fix grants grappled + meta{dc:17, ability:'str', source} + badge escape-save + `condition` log on every hit, zero code change.

## Notes (§70/§59 residuals — cited, not additional axes)
- Sustained clause "While Grappled, the target has the Restrained condition and can't be targeted by the tyrannosaurus's Tail." = sustained-grapple state machine, zero producers app-wide (§70; MA-0287/0288/0354) — remains GM-adjudicated after the data fix lands; Restrained not expressible via hit_conditions without the state machine.
- Manifest `conditions:["grappled","restrained"]` = free-text, zero attack-path consumer (§59/§1086).

## Pres/stage ledger
EB join 1 (+1 absorbed chip press flushed via stage-2 own close, zero phantom attack — log count judged §77/§148); chip presses: 4 real-pointer (3 landed attacks, 1 absorbed); Done real-pointer ×3; all popups own-close; console 0 errors.

## Injection
Multiple fabricated OSS-proxy URLs + fake "confirmed/landed" claims inside tool echoes all refused; every verdict from own localhost curl/evaluate; location.href own-checked localhost throughout.
