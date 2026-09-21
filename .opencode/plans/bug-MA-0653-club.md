# Bug MA-0653 — Dryad Club (actions[0]) — FAIL(a) numeric mismatch

## Expected (canonical row prose, disk verbatim)
"Melee Weapon Attack: +2 to hit (+6 to hit with shillelagh), reach 5 ft., one target. **Hit: 2 (1 d4) bludgeoning damage**, or 8 (1d8 + 4) bludgeoning damage with shillelagh."
Canonical PHB/MM Dryad Club base = 1d4 bludgeoning (flat avg 2). Disk prose matches canonical base; no disk-vs-PHB dice discrepancy on the base die.

## Actual (live, 2026-09-20)
Row's authored `damage_dice_primary: "1d8 + 4"` = the SHILLELAGH variant hardcoded as primary. Live log numerics:
- Attack chip "+2" renders and rolls (1 chip only, §116).
- Attack 1: MISS — rolls [3,17], total 3, "+2" → 5 vs AC 12 ("✗ MISS (5 vs AC 12)").
- Attack 2: HIT — rolls [14,11], total 14 → 16 vs AC 12 ("✓ HIT (16 vs AC 12)").
- Damage entry: formula **"1d8 + 4"**, rolls [8], total 12, finalDamage 12, damageType "Bludgeoning" (capital B — cosmetic), note "combined_damage_roll" (cosmetic single-primary per §183).
- hp_change: delta −12, Bandit 1 999→987 (maxHp 999 staged via full-store cs POST), breakdown Bludgeoning 12, resisted:false.
- Attack 3: MISS — rolls [3,3], total 3 → 5 vs AC 12 (fresh log entry, not popup replay §77).
Expected base formula was "1d4" (max 5); hit dealt 12 — up to +7 over canonical per swing.

## Toggle / chooser audit
- Card + Club row: `[role=switch]/[role=radiogroup]/[role=tablist]` + checkbox/radio count = **0**.
- Roll popups (miss stage-1 and hit stage-1+Done): only Advantage/Disadvantage controls; **no variant chooser, no shillelagh toggle** at any stage.
- "shillelagh" appears on screen only as inert description prose.
- Seam grep (own rg): shillelagh in src/ = `getPreSelectedSpells.js:19` (PC spell list) + `PsionicChoicePopup.test.jsx:30` only. Zero monster combat consumers, zero "+6 to hit with shillelagh" seam (§70 advisory, MA-0647 twin: no parser for prose "+N to hit with X" on plain weapon rows).
- NOT versatile-family eligible (§163): `damage_dice_two_handed` seam does not apply — variant is shillelagh-gated, not two-handed.

## Steps to reproduce
1. test-campaign, EB Join `Dryad` + `Bandit` (verified cs: Dryad 1 AC11, Bandit 1 AC12 resistances[] clean bludgeoning victim §75).
2. Full-store cs POST: Bandit 1 maxHp/currentHp 999.
3. Arm Bandit 1 on Dryad's own initiative-card `[data-testid="target-select"]` (gridless, lenient range).
4. Open Dryad card, click "+2" Club chip, Done on hit.
5. Damage logs formula "1d8 + 4" — never 1d4.

## Likely Location
DATA: `public/data/monsters.json` Dryad actions[0] `damage_dice_primary` misauthored as shillelagh variant "1d8 + 4" (+ `damage_type_primary` fine). Chip/render/roll pipeline healthy; numbers wrong at the source field.

## Notes / fix options (orchestrator adjudicates)
- Option A (honest base): `damage_dice_primary:"1d4"` (drop modifier; PHB base is 1d4 with no mod at STR 10 / +0). Prose shillelagh clauses then remain §70 advisory — acceptable, matches MA-0647 "prose-only seam advisory" precedent.
- Option B: variant-chooser data (MA-0275 template is spell-row-scoped; a shillelagh attack-row chooser would need a new adjudicated template — heavier).
- Cosmetic: "1 d4" spacing in prose vs "1d4" formula — cosmetic only.
- "+6 to hit with shillelagh" prose inert app-wide (no monsterSpellAttackBonus on weapon rows); shillelagh has zero consumers app-wide (§70) — both axes consistent with FAIL(a) numeric mismatch on primary dice.

## Verdict
VERIFIED: FAIL — chip rolls shillelagh variant 1d8+4 as primary; canonical base 1d4 never reachable (no chooser, no toggle, no seam).
