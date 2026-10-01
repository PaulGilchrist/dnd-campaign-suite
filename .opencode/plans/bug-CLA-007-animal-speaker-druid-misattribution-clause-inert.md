# BUG CLA-007 — Animal Speaker: Druid misattribution + expected half-proficiency clause absent app-wide (FAIL(b))

Date: 2026-10-01 | Verdict: **FAIL(b)** | Campaign: test-campaign ONLY

## Manifest claim
- CLA-007 | Animal Speaker | classFeature | Druid
- Trigger: "Action type: skill_check; Skills: Animal Handling"
- Expected: "Add half your proficiency bonus (rounded up) to any Charisma (Animal Handling) check you make."

## App-data truth (grep + disk, ground-verified)
1. **Owner is Barbarian, not Druid.** `public/data/2024/classes.json` → classes[0] Barbarian → majors[1] "Path of the Wild Heart" → features[0]:
   `{name:"Animal Speaker", level:3, description:"You can cast the Beast Sense and Speak with Animals spells but only as Rituals. Wisdom is your spellcasting ability for them."}`
   Druid (classes[3]) class_levels lv1–20 + all 4 circles contain **no** Animal Speaker → the row can NEVER render on a Druid sheet.
2. **Expected text does not exist.** `rg "half your proficiency" public/data` returns only Jack-of-All-Trades-family features (round DOWN, any check); no feature anywhere grants half-PB (round up) on Animal Handling.
3. **Animal Handling is Wisdom** in app data (`src/services/ui/dataLoader.js:563` `{ name:'Animal Handling', ability:'Wisdom' }`). Manifest's "Charisma (Animal Handling)" is wrong vs app + core rules.
4. **No half-PB-round-up skill mechanism exists.** Skill bonus calc = `abilityCalc2024.js:33` (`proficient ? mod+prof : mod`) + CharAbilities.jsx `getSkillBonus` adders: exhaustion, wisCheckReplace, rage Primal Knowledge STR-swap (`computeRageSkillBonus`), `jackOfAllTradesBonus` (the ONLY half-PB consumer: `Math.floor(prof/2)`, round DOWN, unproficient-only, gated on `jack_of_all_trades` passive), Pass Without Trace. No feature hook adds half-PB to a skill.
5. **skill_check trigger lane** exists only for Fighter Battle Master / Rogue maneuvers (`src/services/automation/handlers/class-fighter-rogue/`, combatSuperiorityHandler + `handleSkillCheckPrompt`). Zero `animal_speaker` × skill_check consumer (grep-zero).
6. **Real handler chain (manifest paths stale, confirmed):** row renders via `featureCategories.js:213` (characterAdvancement). Behavior = ritual-only spell grants in `spellCalc2024.js:391-406` (`'Beast Sense':'Animal Speaker'`, `'Speak with Animals':'Animal Speaker'`) + `spellPreparationService.js:194/:639` ritual-cast logging (CLA-234 regression tests exist for this shape — Barbarian Wild Heart only).

## Live evidence (Playwright, test-campaign, header verified each step)
- **Wild_Sage_Druid lv20 Druid (Circle of the Sea), WIS 16/+3, AH unproficient:** sheet census `Animal Speaker` absent; Character Advancement = Primal Order (Magician/Warden) only. Skill row renders `Animal Handling (+3)`. Rolled it: popup `d20 11 +3`, log `{type:roll, characterName:Wild_Sage_Druid, rollType:skill, name:Animal Handling, bonus:3, total:11}`. If manifest clause existed at lv20 (PB+6→half-up +3) bonus would be **+6**. **Zero delta.**
- **Control FeyRanger lv17 Ranger (non-holder), WIS 16/+3, AH unproficient:** `Animal Handling (+3)`, rolled → log `bonus:3, total:13`. No half-PB (+2/+3) present. Control clean.
- **Holder differential (decisive):** DraconicDragon Barbarian lv20 temporarily repointed Zealot→**Path of the Wild Heart** via Edit wizard step 7 (selectOption + ✓Save). Character Advancement then renders: `Animal Speaker: You can cast the Beast Sense and Speak with Animals spells but only as Rituals...` — i.e. row CAN render, with the RITUAL text, not the manifest's half-proficiency text. Its `Animal Handling` stayed **(−1)** (raw WIS mod; lv20 half-PB +3 never added). Restored Zealot lv20; disk GET `DraconicDragon.json` → `level 20, subclass Path of the Zealot`; post-reload sheet: speaker absent, AH (−1).

## Bugs (layered)
- (a) **Manifest attribution wrong:** feature is Barbarian Path of the Wild Heart lv3 in app data, not Druid. No Druid config can produce the row.
- (b) **Expected clause inert app-wide:** half-PB-round-up on Animal Handling has zero data, zero calc, zero consumer; expected text absent from every JSON. Even the genuine lv20 holder shows raw-WIS bonus.
- (c) Manifest ability mislabel: Animal Handling is WIS here (and in core 2024 rules), not CHA.

## Suggested fixes
- Orchestrator: re-attribute CLA-007 to Barbarian / Path of the Wild Heart lv3 and replace Expected with the canonical app-data ritual text (ritual-grant leg is implemented + CLA-234-tested), or file a feature ticket for a `half_proficiency_skill_bonus` passive + `getSkillBonus` hook (new te-free calc seam).
- No src edits made (verification-only pass).

## Cleanup
- Admin cleared change-data (200) + log (200); verified log `[]`. Residual pre-existing keys (`AasimarTest.fanaticalFocusUsed/hitPoints`) resurrected by that loaded tab — pre-existing collateral, out of scope.
- Config restored: DraconicDragon Zealot lv20 (disk-verified). Wild_Sage_Druid + FeyRanger untouched.
