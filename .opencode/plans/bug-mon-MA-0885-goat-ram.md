# BUG MA-0885 — Goat · Ram — FAIL(a): conditional charge gate skipped (charge always-on)

**Date:** 2026-09-22 · **Campaign:** test-campaign · **Rig:** EB joins Goat 1 + Bandit 1 (AC12, four-key 999)

## Expected (RAW, description byte-quoted from disk)
> "Melee Attack Roll: +2, reach 5 ft. Hit: 1 Bludgeoning damage, or 2 (1d4) Bludgeoning damage if the goat moved 20+ feet straight toward the target immediately before the hit."

- BASE hit = flat **1** Bludgeoning.
- CHARGE hit (20+ ft straight before the hit) = **1d4** Bludgeoning.
- The two must be distinguishable at adjudication (offer, toggle, or two authored legs).

## Actual (live)
- Every HIT rolls the authored `damage_dice_primary: "1d4"` regardless of movement — **no movement gate, no charge offer**.
- HIT popups contained only `Done` (btn audit ×2: `["Done"]`; toggles=2 cosmetic adv/dis display only). Zero ChargeBonusOffer buttons.
- `lastAttack.damageFormula: "1d4"` on both hits; no charge/conditional field anywhere in lastAttack.
- The flat-1 BASE is unreachable: chip + resolver never render or offer it. Charge is structurally always-on = **over-damage vs base** (avg 2.5 vs 1).
- HIT2 rolled nat-die 1 (coincidence) — min-1-vs-base unprovable from that roll alone; HIT1 rolled 3 (> base) + formula stamp "1d4" every hit + zero-offer audit is the decisive gate-absence proof.

## Ledger (6 presses: 4 miss, 2 hit; rolls[0] truth §92)
| # | d20[0] | +2 | total | vs AC12 | damage formula | dice | fd | hp_change |
|---|--------|----|-------|---------|----------------|------|----|-----------|
| 1 | 3 | +2 | 5 | ✗ | — | — | — | 0 (done-less backdrop) |
| 2 | 17 | +2 | 19 | ✓ | **"1d4"** | [3] | 3 | −3 (999→996) |
| 3 | 3 | +2 | 5 | ✗ | — | — | — | 0 |
| 4 | 6 | +2 | 8 | ✗ | — | — | — | 0 |
| 5 | 8 | +2 | 10 | ✗ | — | — | — | 0 |
| 6 | 13 | +2 | 15 | ✓ | **"1d4"** | [1] | 1 | −1 (996→995) |

Σfd=4 == 999−995 exact; damageType Bludgeoning on every damage entry + breakdown ✓. Plain seam is CLEAN: ONE "+2" chip (§116), total=nat+2 every flip, targetAc:12, fd==|hpΔ| exact, miss stamps hit:false zero damage. Real-pointer Done 2/2 applied (§MA-0869). Second dice of rolls[] distinct every entry — no cached replay (§77).

## Charge-gate conclusion
Conditional-charge gate **absent live**. Machine exists but is unarmed by this row:
- `buildChargeBonusOffer` gates ONLY on the authored field: `const cd = action?.conditional_damage;` (MonsterCardHelpers.js:547) — no prose parser for "if the goat moved 20+ feet straight…".
- HIT-popup consumer: MonsterCardModal.jsx:2084-2115 (MA-0007 seam, grant/decline logs conditional_damage_granted/:declined Helpers:716/727).
- Verified twins WITH the field (disk, same RAW clause family): giant-seahorse Ram (`conditional_damage:{dice:"2d8",modifier:2,…}` alongside base "2d6 + 2"), giant-elk Ram, giant-goat Ram. Goat omits it.

## Likely Location
1. **DATA:** `public/data/monsters.json` goat.actions[0] — schema CAN express the distinction (seahorse twin byte-shape) but the row authors `damage_dice_primary:"1d4"` (charge dice as always-on primary) and omits `conditional_damage`. Flat-1 base IS expressible: `damage_dice_primary:"1"` rides constant dice-less resolve (§213; MA-0322 extractFlatHitDamage prose fallback).
2. **CODE:** none needed for the gate itself — `conditional_damage` consumer is LIVE (MA-0007; siblings MA-0805/0809/0822 ram-charge verified). Gap is pure data.

## Fix (one-row, two-field)
```json
"damage_dice_primary": "1",
"conditional_damage": {
  "dice": "1d4",
  "damage_type": "Bludgeoning",
  "condition": "moved 20+ feet straight toward the target immediately before the hit"
}
```
(giant-seahorse byte-shape: conditional_damage after primary/type fields.)

## Steps to reproduce
1. localhost:5173 → test-campaign → Encounters → filter "Goat" exact + "Bandit" exact → Join.
2. Bandit four-key HP 999 (full-store cs POST) → reload + re-select.
3. Goat card → arm target-select Bandit 1 → click "+2" Ram chip.
4. HIT popup: only `Done`; Done → `roll damage` formula **"1d4"** every time, no charge offer.

## Notes
- Charge clause is structurally unsupportable on this row as authored (data+code gap = data only; machinery live) — sibling family of MA-0871 versatile double-charge (conditional gate absent, authored field misfires always-on).
- Even-damage caveat: a 1d4 result of 1 coincides with the flat-1 base and is unprovable at that seam; gate absence rests on formula stamp + popup affordance audit, both recorded here.
- Note: giant-Goat (MA-0809 twin) authors hit_conditions prone + extra-dice RAW variant; plain Goat has no prone clause — do not copy hit_conditions, only conditional_damage.
- Evidence: `.opencode/plans/evidence-MA-0885-hit-popup.png`, `evidence-MA-0885-hit-popup-2.png`.

## VERDICT: FAIL(a) — rule gate skipped (charge always-on; base flat 1 never adjudicable)
