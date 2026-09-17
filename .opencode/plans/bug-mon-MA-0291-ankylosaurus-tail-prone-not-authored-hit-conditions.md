# BUG — MA-0291 Ankylosaurus Tail: prone-on-hit not authored as `hit_conditions` (data-gap)

- **Verdict:** FAIL — flavor(b) data-gap (core numbers exact; prone inert)
- **Row:** MA-0291 | monsters.json `ankylosaurus` → actions[1] "Tail" | attackType attack | +6, 1d10+4 Bludgeoning, reach 10 ft
- **Date:** 2026-09-17 | Campaign: test-campaign | Target: ElderPaladin AC 19 (224 HP)
- **Manifest category:** conditions ["prone"]

## Expected (quotes row)
monsters.json Tail description: *"Melee Attack Roll: +6, reach 10 ft. **Hit:** 9 (1d10 + 4) Bludgeoning damage. If the target is a Huge or smaller creature, it has the **Prone** condition."*
Per MA-0302 template (arch-hag Spectral Claw, `hit_conditions:["prone"]`, no escape_dc) and MA-0287/0288 seam rule, each HIT should write target `activeConditions` + `activeConditionMeta` + a `condition applied` log entry + card badge; miss = zero writes.

## Actual (curl truth, GET /api/campaigns/test-campaign/change-data + /log)
Core-exact across 3 rolls (2 hits + 1 miss, stopped at quota):
- Roll 1: attack d20 16 → 22 vs AC 19 HIT; damage 1d10[8]+4 = 12 Bludgeoning; hp_change −12 → 212/224.
- Roll 2: attack d20 13 → 19 vs AC 19 HIT; damage 1d10[10]+4 = 14 Bludgeoning; hp_change −14 → 198/224.
- Roll 3: attack d20 7 → 13 vs AC 19 MISS; zero damage/hp_change (miss-zero correct).
- **Prone absent after every HIT:** ElderPaladin `activeConditions` = null, `activeConditionMeta` = null, zero `condition`-type log entries vs ElderPaladin, no badge on card. Prone exists only as prose; clause never fires.
- Boundary note: with +6 vs AC 19 the true flip is nat≤12 miss / nat≥13 hit (task's "nat≤13 miss" off-by-one; observed nat13→19 hit is app-correct).

## Likely Location
`public/data/monsters.json` — ankylosaurus Tail row. Row authors `attack_bonus:6`, `damage_dice_primary:"1d10 + 4"`, `damage_type_primary:"Bludgeoning"`, `reach:"10 ft."` and **NO `hit_conditions` key at all** (and no plain `conditions` array — prone is prose-only). Consumer `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:382-392) reads ONLY `action.hit_conditions` + `escape_dc` + `hit_target_effect`; prose is never parsed → clause returns null → `maybeApplyHitClause` (handlePlainDamage.js) never writes conditions (MA-0287/0288 rule: plain `conditions` array is NOT consumed either; here even that is absent).

**Fix (data-only):** add `hit_conditions: ["prone"]` to the Tail row, per live MA-0302 Spectral Claw template (prone, no escape_dc). Consumer is live (badge + meta + `condition applied` log, miss-zero verified there).

## Notes
- Size gate ("Huge or smaller") is GM-adjudicated prose — no machine size-gate consumer required for the prone write (MA-0302 parity: Spectral Claw prone clause carries no size gate either).
- Consumer seam EXISTS and is live (MA-0010/MA-0302 family; tests: handlePlainDamage.hitClause.test.js:426-430 data-lock pattern to mirror). This row is a pure authoring omission — engine not at fault.
- Registry: Ankylosaurus registered MA-0290 (Tail ×4 vs ElderPaladin AC19, 3 hits incl crit, 1 miss) — prone was NOT checked there; this run owns and lands the FAIL.
- Do NOT edit manifest/monsters.json/docs as part of this verification task (fix = next-pass data work).
