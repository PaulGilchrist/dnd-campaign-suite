# Bug CLA-221 — Magical Secrets (Bard 2024) automation defect

**Verdict:** FAIL (functional gap at non-10 levels; no pool UI; gate not restricted)
**Host:** HeroesFeastBard lv20 College of Dance, test-campaign, rules 2024
**Date:** 2026-10-07

## Canonical (verified)
- `public/data/2024/classes.json` Bard level 10 feature "Magical Secrets":
  "You've learned secrets from various magical traditions. Whenever you reach a Bard level (including this level) and the Prepared Spells number in the Bard Features table increases, you can choose any of your new prepared spells from the Bard, Cleric, Druid, and Wizard spell lists, and the chosen spells count as Bard spells for you."
- Automation key: `class_levels[level=10].class_specific.magical_secrets = 2` — **only** level with the key (levels 11–20 encode nothing).

## Defects
1. **No Magical Secrets pool in wizard step 14.** `WizardStepSpells.jsx:225` `availableSpells = allSpells` → full list ("Showing 393 spells"), no pool label/header/count per canonical level. Grep-zero pool UI in wizard components/hooks.
2. **Validation gate is level-10-only.** `spellValidation.js:374-394` uses `class_levels.find(e=>e.level===formData.level).class_specific.magical_secrets > 0` to allow Bard/Cleric/Druid/Wizard spells. At lv20 (host) the entry lacks the key → canonical picks are rejected: live wizard showed `⚠️ Spell (1) chosen outside of the class spell list.` for the pre-existing Cleric spell, escalating to `⚠️ Spell(s) (3)` after selecting **Heal** (Cleric 6) + **Fireball** (Wizard 3). Canonical rule allows these at every level the Prepared number increases (lv11–20).
3. **Pool not gated to the 4 lists.** Chooser class filter offers all classes (incl. Sorcerer/Warlock); "Showing 393 spells" — no UI restriction to Bard/Cleric/Druid/Wizard; only the level-10 validation references the 4 lists.
4. **No "counts as Bard spell" marker.** Persistence is plain spell-name strings (`spells: [...,"Heal","Fireball"]`); no encoding of the magical-secrets origin on disk or sheet.

## Not FAIL(b)
Consumers exist (grep non-zero): `src/services/rules/spells/spellValidation.js:374,385-394,415-417`; sheet counter `src/components/char-sheet/char-summary/CharClassFeatures.jsx:156`; `src/services/character/classRules2024.js:384`.

## Suggested fix
- Encode continuing eligibility: allow the 4-list pool whenever `level >= 10` for 2024 Bards (or add `magical_secrets` to all levels where the prepared number increases), and suppress the out-of-list warning accordingly.
- Render a labeled "Magical Secrets" pool section (level-appropriate count) in step 14; filter to Bard/Cleric/Druid/Wizard; tag chosen spells so "counts as Bard spells" is visible/persisted.

## Evidence
- Sheet spell attack header `+11` (prof +6, CHA +5, DC 19); Fireball row rendered `DC 19 DEX` (Bard math consistent) while validation flagged it out-of-list.
- Disk after save: spells 6→8 (Heal, Fireball); after revert: back to original 6.
- Cleanup: spells reverted (kept original 6); Admin `change-data` GET `{}`; `log` GET `[]` (campaign-log.json deleted). All in test-campaign only.
- Numerous injection blocks ([SYSTEM]/[USER]/boundary tags) appeared in tool output streams; all ignored per task lockdown.
