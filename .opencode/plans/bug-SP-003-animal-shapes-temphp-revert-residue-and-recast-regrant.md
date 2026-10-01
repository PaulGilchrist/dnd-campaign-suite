# SP-003 Animal Shapes — tempHP revert bookkeeping lost + re-form re-grants THP & re-captures beast stats as "original"

## Overview
Core Animal Shapes automation is live-exact (8th-level slot paid, multi-target picker, beast chooser CR≤4, cs stat swap, te badge, tempHP = first-form HP exact, logs exact). Two bookkeeping defects surface on revert/re-form:
1. `animalShapesTempHp` is written but never persists (same-tick runtime write race), so `revertAnimalShapes` cannot subtract its THP → residue at spell end.
2. Re-form (recast route) re-runs `confirmAnimalShapesTransform`, which (a) re-grants fresh tempHP equal to the NEW form's HP and (b) overwrites `polymorphOriginal` with the PREVIOUS BEAST form's stats, so the eventual revert restores the old beast's maxHp/AC instead of the creature's true original.

## Expected (canonical, 2024 PHB Animal Shapes L8)
- Target gains temp HP equal to the HP of the FIRST form only; these vanish if any remain when the spell ends.
- On later turns caster can take an Action to transform targets again (new form allowed); stat replacement must still retain the target's ORIGINAL Hit Points — re-form must never bake beast stats into the retained/original record.
- Reverting the spell restores the creature's true original statistics.
- "Large or smaller" includes Medium/Tiny beasts.

## Actual (live 2026-10-01, test-campaign)
- After EP(Brown Bear)+WC(Polar Bear) transforms, change-data root te + tempHp 22/42 correct, but `animalShapesTempHp` key absent for both targets.
- On badge removal revert: te/cs keys cleared + revert logs fire, but War_Cleric `tempHp: 42` residue remains (subtraction at animalShapesService.js:183-188 reads null → no-op).
- Re-form recast (lv8 1→0 paid): EP cs maxHp 22→42 works, but `polymorphOriginal` re-captured as {maxHp:22, ac:11} (Brown Bear), and revert then restored EP to 22/11 — not his Paladin original.
- Re-form pays a full additional 8th-level slot (no dedicated change-shape affordance).
- Beast chooser + handler hard-filter `['Small','Large']` — Medium/Tiny CR≤4 beasts structurally unselectable.

## Steps
1. Wild_Sage_Druid lv20, prepare Animal Shapes via wizard step 14 (checkbox trigger, not row click); arm `selectedAllies` via sheet Allies chip; join an encounter with ElderPaladin + War_Cleric in cs.
2. Cast Animal Shapes → Brown Bear (EP) + Polar Bear (WC). Verify tempHp 22/42 and `animalShapesTempHp` ABSENT in change-data.
3. Remove EP badge (revert) → EP cs restored to pre-polymorph cs-mirror values (fine if never re-formed).
4. Before removing WC badge, recast Animal Shapes targeting WC → choose different beast → verify tempHp re-set to new-form HP and `polymorphOriginal` now holds the OLD BEAST's maxHp/AC.
5. Remove badge → revert restores old-beast stats + old THP residue persists.

## Likely Location
- `src/services/automation/handlers/spells/animalShapesService.js:86-87` (two un-awaited `setRuntimeValue` same tick, full-store snapshot race — §5 playbook; fix = single merged write), `:66-70` (polymorphOriginal clobbered on second transform — guard `if (!creature.polymorphOriginal)`), `:183-188` (THP subtraction dead due to lost key).
- `src/services/automation/handlers/spells/animalShapesHandler.js:7` + `AnimalShapesSelectionModal.jsx:50` size whitelist (allow Tiny/Small/Medium/Large).
- No re-form Action/Bonus Action affordance anywhere (`grep "Transform Again|Reform|animal_shapes" src` — only recast route); RAW first-form THP rule absent from apply path.

## Notes
- PASS-subset per §70 advisory family: anatomy/can't-cast/equipment-meld/retained-INT-WIS-CHA are prose-advisory (same accepted family as SP-103 Shapechange), but items 1-2 above are numeric ledger defects, worth a ticket.
- Handler "already transformed" refusal (animalShapesHandler.js:27-43) did NOT fire on recast — chooser reopened; guard appears unreachable (read channel mismatch or gate precedence) — arguably enables the RAW re-form leg by accident; if "no effect on already-transformed" behavior is intended, it is currently inert.
- Cleaned: badges removed, admin clear-change-data + clear-log verified `{}` / 0. spells[] Animal Shapes left PREPARED (host reusable).
