# BUG MA-1071 — Kuo-toa Whip "Pincer Staff": DC0 decoy arms save-halve lane on damage chip

Date: 2026-09-24 | Campaign: test-campaign | Session: MA-1071 (localhost :5173)

## Verdict: FAIL — damage never pays flat "2d6 + 2" Piercing

## Disk shape (recorded, manifest untouched)
`public/data/monsters.json` → `kuo-toa-whip` → actions[0] "Pincer Staff":
attack_bonus 4, reach "10 ft.", damage_dice_primary "2d6 + 2", damage_type_primary "Piercing",
**save_dc: 0, save_type: "", save_effect: ""** — DC0 decoy structurally present.
Rider is prose-in-description only: "If the target is a Medium or smaller creature, it has the
**Grappled** condition (escape DC 12). Until the grapple ends, the kuo-toa can't make Pincer
Staff attacks." — no structured hit_conditions / grapple field → prose lane (verified live:
Bandit 1 activeConditions [] after hit, zero grapple/escape meta, zero condition log entries).

## Attack lane (PASS portion)
- cs.index 6, card fresh reopen (stale Kuo-toa Monitor mc-overlay from MA-1070 closed first).
- Bandit 1 armed own-row (target select → "Bandit 1"); cs hp 731/999, ac 12 standing.
- +4 chip ×3 (budget): nat[1,20]→total1+4=5 MISS; nat[2,10]→total2+4=6 MISS; nat[11,2]→total11+4=15 HIT vs AC12 — hit-iff-≥ exact, nat1 auto-miss, misses done-less, no stage-2 residue, final popups 0.
- Every attack log: bonus 4 separate `bonusDetail:"(+4 to hit)"`, targetAc==effectiveAc==12, targetName Bandit 1. Console 0 errors.

## Defect (FAIL portion)
Both "2d6 + 2" chip presses on the HIT adjudicated as SAVE vs DC 0 instead of flat damage:
- Log `save` (Whip, rolls [11,10]) + `save` (Bandit 1, rolls [11], saveDc 0, saveType "", dcSuccess "half") + `save-damage` formula "2d6 + 2" rolls [2,5] finalDamage 4; hp_change -4 (731→727).
- Repeat press: rolls [5,3]+2=10, Bandit save d20 8+0 vs DC 0 success → finalDamage 5; hp_change -5 (727→722). No damageBreakdown / resisted:false on either hp_change.
- Raw totals 9 then 10 were halved (auto-success vs DC 0) — full flat 9 per §32 non-crit shape never applied. fd Σ=9==|731-722| only because two half-pays, not the required one flat pay.

## Root cause (code)
`MonsterCardModal.jsx` → `ActionSaveRoll`: gate `if (action.save_dc == null) return null` admits the DC0 decoy (0 ≠ null).
`saveChipPlan` → `extractDamageDiceFromDescription` returns "2d6 + 2" → `rollable=true` → the rollable branch (lines ~108–119) renders the plain damage chip `2d6 + 2` **and** `DC 0` both with `onClick=handleSaveRoll`, bypassing the non-rollable branch's `plan.clickable` gate entirely.
`npcSaveDamageHandler` then rolls a guaranteed-success save vs DC 0 and applies `dcSuccess:'half'` (`buildSaveOptions` defaults 'half' whenever save_dc ≠ null) to the fixed attack-hit damage.
MA-0551 `isCompositeAttackSaveRow` requires `Number(save_dc) > 0`, so the DC0 row is byte-identical to a plain attack row everywhere EXCEPT this ActionSaveRoll gate — Monitor Bone Whip (identical save_dc:0) logged flat damage in MA-1070, confirming the difference is this modal's damage-chip wiring when prose carries "Hit: X (2d6 + 2)" extractable dice.

## Suggested fix (not applied)
Tighten `ActionSaveRoll` gate to `save_dc == null || Number(action.save_dc) <= 0` → row renders attack chip + plain ActionDamageLinks-style flat chip only; or route DC≤0 chips through plainDamageHandler and drop the spurious save adjudication.

## State at hand-off
Joined, Whip target armed = Bandit 1, HP drift 731→722 (-4,-5 save-halves; legit), overlay closed, popups 0, no clears, manifest untouched, no git writes.
