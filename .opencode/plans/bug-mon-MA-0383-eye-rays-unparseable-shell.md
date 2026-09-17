# BUG MA-0383 — Beholder Zombie "Eye Rays" (aoe-save): unparseable-shell (MA-0374 class)

Verdict: **FAIL** — standalone confirm ×2 rays-legs, 2 targets (HexWarlock + ElderPaladin re-armed).

## Data (read-only, monsters.json beholder-zombie actions[2])
- Keys: name, description, save_dc(14), save_type("Varies (Constitution, Wisdom, Dexterity)"), save_effect, damage_dice_primary("3d8, 3d6, 5d10"), damage_type_primary("Psychic, Necrotic, Force")
- NO rays array / structured picker. d4 picker + per-ray DCs/conditions exist only in prose. Fingerprint confirmed, not re-derived.

## Code (grep)
- No d4 eye-ray picker consumer anywhere; only Ray of Enfeeble spell handling matches "ray".
- Save path forwards literal "Varies (...)": toAbbr → "var"/"VAR" → ability-mod lookup miss (MA-0374 twin).

## Live E2E (test-campaign only, header verified; localhost:5173)
- EB "Beholder Zombie" exact → Join → cs: Beholder Zombie 1 ac15 hp93/93 init1.
- Targets armed via init comboboxes: leg1 BZ→HexWarlock (HW re-armed 73/73 char-key), leg2 BZ→ElderPaladin (EP re-armed 224/224).
- Chip fired ×2, full popup cycles (§290-292, MA-0273 cached dice).

### Leg 1 — HexWarlock (verbatim)
- Popup: "HexWarlock must make a VARIES (CONSTITUTION, WISDOM, DEXTERITY) saving throw. DC 14 / Half damage on successful save"
- Roll: d20 (9) + 0 → **SAVE FAILURE**, Total 9 vs DC 14. saveResult: {roll 9, total 9, saveBonus 0}.
- Null-proofs: HW 73/73, conditions None (cs + char key); NO targetEffects key ever. Failed save applied ZERO ray effect (no Paralyzed/Frightened/Poisoned, zero damage).

### Leg 2 — ElderPaladin (verbatim)
- Popup: "ElderPaladin must make a VARIES (CONSTITUTION, WISDOM, DEXTERITY) saving throw. DC 14 / Half damage on successful save"
- Roll: d20 (18) + 5 (+5 aura from ElderPaladin) → **SAVE SUCCESS**, Total 23 vs DC 14. saveResult saveBonus 5, aura-only; ability mods never consulted ("Varies"/"VAR" quirk).

### Log audit (8 entries)
- Encounter joined 1x Beholder Zombie; initiative.
- Per leg: stray "VAR"-named save roll by Beholder Zombie 1 (MA-0370 noise family), save_result (DC14, literal saveType "Varies (...)"), player "Eye Rays" save rows (HW total 9 bonus 0 FAIL; EP total 23 bonus 5 SUCCESS).
- ZERO damage-roll rows, ZERO condition rows across both legs. No d4 ray-selection roll ever — picker absent, ray never chosen.

## Conclusion
MA-0374-class unparseable-shell: "Varies" passes verbatim → mod-0 (no aura) / aura-only (with aura) "VAR" saves; multi-string damage "3d8, 3d6, 5d10" unparseable; no d4 ray picker; zero ray damage/conditions on any outcome including save-failure leg. Rays are cosmetic prose shell.

## Cleanup
Admin native confirms both naming "test-campaign"; curl verified change-data `{}` and log `[]`.
