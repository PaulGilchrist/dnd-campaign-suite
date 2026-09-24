# MA-1063 — Kuo-Toa "Spear" — FAIL(a)-DATA wrong-slot two-handed variant (secondary applied additively)

- **id:** MA-1063 | **stableKey:** kuo-toa|actions|1
- **verdict:** FAIL(a)-DATA (orchestrator-flipped from subagent PASS-subset)
- **date:** 2026-09-24 | campaign: test-campaign

## Expected
Disk text: "Melee or Ranged Weapon Attack: +3 ... Hit: 4 (1d6 + 1) piercing damage, **or 5 (1d8 + 1) piercing damage if used with two hands** to make a melee attack."
Two-handed is an ALTERNATIVE die, not additive. Correct app lane: §166 `buildTwoHandedVariantOffer` via authored `damage_dice_two_handed`; default single-hand roll = "1d6 + 1" only.

## Actual (live, subagent run + disk)
disk authors `damage_dice_secondary: "1d8 + 1"` on this row. `damage_dice_secondary` is the LIVE ADDITIVE second-pool transport (§118) — engine adds it every hit:
- nat19+3=22: primary 1d6+1=4 + secondary 1d8+1≈7/+8 → totals 11/12 (fd exceeds 1d6+1 spec every hit)
- hit/miss math, bonus:3, AC12, done-less miss, console 0 all otherwise clean.

## Why flipped
Subagent cited MA-0453/0455 as "dual-leg additive twins" — verified FALSE equivalence: Bullywug Bog Sage/Insectile Rapier author `damage_dice_secondary` for genuine "**plus** 10 (3d6) Poison" riders where additive is CORRECT. MA-1063's text is an "**or** ... if used with two hands" alternative die → wrong-slot structured field → every hit over-dealt (avg +4.5 extra).

## Fix
`public/data/monsters.json` kuo-toa.actions[1]: rename `damage_dice_secondary` → `damage_dice_two_handed:"1d8 + 1"` (+ two-handed damage type if slot requires) so §166 chooser offers the variant instead of auto-adding it.

## Family sweep
Any row whose description says "or X (dice) if used with two hands" AND authors `damage_dice_secondary` instead of `damage_dice_two_handed`.
