# bug-mon-MA-0505 — Cockatrice Regent Magical Backlash half-leak on save success

**Verdict:** FAIL(a) — half-damage leak (MV-20 / MA-0481 family). DATA fix.

## Row
MA-0505, Cockatrice Regent (`cockatrice-regent`), reactions[0] "Magical Backlash", save DC 14 Dexterity, 3d6 + 3 Force.

## Evidence (live, test-campaign, 2026-09-18)
- Chip rendered + live: `DC 14 Dexterity` (`mc-dice-link-save-clickable`) on `.mc-overlay` (§107 generic reaction save-shell).
- FAIL leg: nat 3 vs DC 14 → `save-damage` log `formula:"3d6 + 3"` rolls [6,4,3] `total:16` `finalDamage:16` `saveSuccess:false` — FULL damage on fail ✓ (victim clamped at 0; advisory per §111).
- SUCCESS leg (defect): nat 16 vs DC 14 → `save-damage` `rolls:[2,2,3]` `total:5` `finalDamage:5` `saveSuccess:true`, `hp_change delta:-5`. Half of 10 (2+2+3+3) applied on a SAVE SUCCESS.

## Root cause
`public/data/monsters.json` cockatrice-regent reactions[0] has **no `dc_success` field**; `MonsterCardModal` `getSaveDcSuccess` defaults to `half` hardcode (MV-20). RAW Magical Backlash: triggering creature takes **no damage** on a successful save (description carries only a Failure line).

## Fix
Add `"dc_success": "none"` to cockatrice-regent `reactions[0]` (byte-shape precedent MA-0481). Success must yield zero damage; honest copy on both surfaces.

## Fingerprints hit
- MV-20 half-default leak; MA-0481 precedent (row w/o dc_success + prose failure-only = DATA `dc_success:"none"`).
- cs `saveBonuses.dexterity:-7` full-store stamp IGNORED by EB-NPC inline save seam (saves roll raw d20 +0; picker key seam MA-0303) — deterministic-fail rig must use real low-dex victims or accept raw rolls.
- Dead-victim popup prints "HP: 16 → 0" (base lies); `hp_change` delta + `finalDamage` decide (§33/§17).
- Fabricated page URL echo (`localhost:8080/campaigns`) inside run_code result after popup dismiss; tab audit proved session stayed on :5173 (§6/§125).
