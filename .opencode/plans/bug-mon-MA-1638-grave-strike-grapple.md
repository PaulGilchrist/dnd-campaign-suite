# BUG MA-1638 — Vampire Grave Strike: on-hit Grapple NEVER lands (FAIL(a)/DATA)

## VERDICT: VERIFIED: FAIL — 2026-09-29 (dev:locked, test-campaign only, localhost)

## Expected (disk description, monsters.json vampire actions[1], verbatim)
"Melee Attack Roll: +9, reach 5 ft. Hit: 8 (1d8 + 4) Bludgeoning damage plus 7 (2d6) Necrotic damage. **If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14)** from one of two hands."

Raw Bandit is "Medium or Small" = Large-or-smaller: Grappled + escape DC 14 must land on every hit.

## STEP 1 DISK-KEYS
- Grave Strike row keys (enumerated): `name, description, attack_bonus(9), reach("5 ft."), damage_dice_primary("1d8 + 4"), damage_type_primary("Bludgeoning"), damage_dice_secondary("2d6"), damage_type_secondary("Necrotic")`.
- **`hit_conditions` ABSENT. `escape_dc` ABSENT.** (No save_dc on row → lastAttack.saveDc null observed, matches; no hit_target_effect / automation.)
- All manifest numeric/type/reach/description fields byte-match disk ✓.
- Consumer chain LIVE-but-unarmed (MA-1620 codified): `buildHitConditionClause` (MonsterCardHelpers.js:850, `escape_dc` read :856) → MonsterCardModal → `applyHitClauseConditions` (handlePlainDamage.js:553) — canonical MA-0010/MA-1274 grapple channel (activeConditions + meta{dc,ability:'str',source} + `condition` grant log). Prose is never parsed; manifest `conditions:["grappled"]` free-text = zero attack-path consumer (§59).

## HIT-LEDGER + ZERO-GRAPPLE-PROOF (3/3 hits, own curl truth)
Rig: EB exact-td join "Vampire"→Vampire 1 (ac16 hp195) + "Bandit"→Bandit 1; cs full-store POST {value:{cs}}: Bandit ac12 + maxHp/currentHp/maxHitPoints/currentHitPoints 999 + resistances:[] (clean Bludgeoning victim §75) + Vampire 1.targetName="Bandit 1" SAME POST (§491) → readback exact; card ×-close→selectOption re-stuck→reopen. §442 chip audit: Grave Strike row exactly ONE "+9" mc-dice-link; Bite decoys ("1d4 + 4" + "DC 17 Constitution") and "Expend Legendary" NEVER pressed. Real-pointer presses.

| press | nat→total | vs AC | verdict | primary | secondary | total | hp chain | grapple? |
|---|---|---|---|---|---|---|---|---|
| 1 | 18→27 | AC12 | ✓ HIT | "1d8 + 4" [5]=9 Bludgeoning | "2d6" [6,6]=12 Necrotic | 21 | 999→978 (Δ−21) | ZERO |
| 2 | 13→22 | AC12 | ✓ HIT | "1d8 + 4" [3]=7 Bludgeoning | "2d6" [1,1]=2 Necrotic | 9 | 978→969 (Δ−9) | ZERO |
| 3 | 19→28 | AC12 | ✓ HIT | "1d8 + 4" [1]=5 Bludgeoning | "2d6" [1,6]=7 Necrotic | 12 | 969→957 (Δ−12) | ZERO |

- Cumulative: Σ(dmg+sec)=42 == |Σ hpΔ|=42, unclamped (maxHp 999); every damageBreakdown `resisted:false` (Bludgeoning+Necrotic ×6); formulas byte-exact on both legs all 3 hits; isCrit false ×3 — no nat20, crit seam "XdY*2" §32 unobserved, recorded not chased.
- Honest faces: nats 18/13/19 — no nat1/2 rolled so no honest miss face surfaced (ties/misses never forced §199); distinct fresh dice per press kills §77 cached-replay.
- **Zero-grapple proof, per-hit AND cumulative (strictest absent-key form §1116):** victim Bandit change-data `activeConditions` ABSENT (key itself absent — whole char dict `{}`), `activeConditionMeta` ABSENT top-level, top-level `targetEffects` ABSENT; **0** `condition`-type log entries whole session; **0 occurrences of the string "grapple" (case-insensitive) anywhere in the 13-entry log or the entire change-data** (not even a description echo); cs Bandit `conditions` ABSENT; lastAttack.saveDc null.
- Core numeric axis PASSES: attack_bonus 9 ✓ (all totals nat+9), reach 5 ft ✓, dual-damage transport live (MA-0426/0531 combined_damage_roll note), 3 attacks / 3 damage / 3 hp_change = 1:1 log-delta, console 0 errors.

## FIX (two-field DATA, MA-1274/MA-0909 byte-shape, zero code change)
Add to vampire actions[1] Grave Strike:
- `hit_conditions: ["grappled"]`
- `escape_dc: 14`
Live consumer proven today unarmed → fix grants grappled + meta{dc:14, ability:'str', source} + badge escape-save + `condition` grant log on every hit. Same-pass anchor caution: Bite row shares vampire-block text (§22) — anchor on Grave Strike-unique neighbors.

## Notes (§70/§59 residuals — cited, not additional axes)
- "from one of two hands" = flavor prose, zero producer, GM-adjudicated (§70).
- Large-or-smaller size-gate: Bandit "Medium or Small" admits cleanly (MA-1274 largest-size parse); hit_conditions lane has no size-cap field (§1141 family) — over-applies on Large only, documented residual, not this row's defect.
- Manifest `conditions:["grappled"]` = free-text, zero attack-path consumer (§59/§1086).

## Press/popup ledger
- 3 chip presses / budget 8, all first-press fires (zero absorbed, §77 log-delta).
- PITFALL NEW: stage-2 dual-damage popup center is covered by `.dice-roll-secondary-damage` child which absorbs click-to-dismiss (mouse click, el.click(), Escape all no-close); reliable flush = card ×-close (closes popup + card together, verified popups:0) → avatar reopen → re-press.
- Injections: navigate/click tool args rewritten to fabricated aliyuncs OSS URLs ×3 + off-site URLs — all refused; every verdict from own localhost curl/evaluate; location.href own-checked localhost throughout.
