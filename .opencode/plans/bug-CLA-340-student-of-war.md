# Bug — CLA-340 Student of War (Fighter, 2024)

## Title
CLA-340 Student of War: choice never selectable, tool/skill grants never applied (display-only row; feature-level proficiency_choices have zero consumers)

## Overview
Student of War (Battle Master major, level 3) is collected into the sheet's Character Advancement section as read-only text, but none of its two choice grants (1 Artisan's Tools + 1 Fighter skill) can be selected anywhere in the app and no proficiency is ever applied or persisted. The manifest's handler/router/infoBuilder paths are fictitious (files do not exist). EvasiveFighter (test-campaign, 2024 Fighter lv18, major=Battle Master on disk) shows the row verbatim with zero grant: `toolProficiencies: []` on disk, no Student of War pool in the wizard, no chooser on click.

## Expected (canonical, public/data/2024/classes.json Fighter majors[0] Battle Master feature lv3)
"Gain proficiency with one type of Artisan's Tools and one skill of your choice from Fighter skills."
Data object carries feature-level `proficiency_choices`: choose 1 from 17 `"Tool: …"` entries + choose 1 from 9 `"Skill: …"` Fighter skills.

## Actual
- Sheet: "Student of War:" renders in Character Advancement as a non-interactive `<b>` (cursor:auto); clicking opens NO chooser modal (0 overlays after click).
- Edit wizard step 7 (Subclass/Major): "Battle Master Details → Show Details" lists Student of War as read-only text (name/level/description only) — no tool or skill selector.
- Edit wizard step 10 (Skills): pool text = "2 skill choice(s) from [Fighter skills], 1 from your race, and 2 from your background (5 total)" + feat sources — NO Student of War +1 skill pool.
- Edit wizard step 11 (Tools): limits show only "You may choose 1 Gaming Sets" (background) — NO +1 Artisan's Tools allowance from Student of War; 0 tools selected.
- Persisted disk (`/api/campaigns/test-campaign/EvasiveFighter.json`): `toolProficiencies: []`; skillProficiencies fully explained by class/background/race/feats — no Student of War grant.
- change-data: zero keys matching prof|tool|skill|student under EvasiveFighter.

## Steps to Reproduce
1. localhost:5173 → test-campaign → EvasiveFighter (2024 Fighter lv18, Battle Master).
2. Observe sheet Character Advancement: "Student of War:" row; click it — nothing happens (no popup/selector).
3. Edit → step 7: select Battle Master → Show Details — Student of War is text-only, no selection UI.
4. Step 10: rules text lists class 2 + race 1 + background 2 + feats — no Student of War skill choice pool.
5. Step 11: "You may choose 1 Gaming Sets" only — no Artisan's Tools choice from the feature.
6. Close wizard (no save). Sheet Proficiencies line: Heavy/Light/Medium Armor, Martial/Simple Weapons, Shields — no Artisan's Tools; disk `toolProficiencies: []`.

## Likely Location
- Data: `public/data/2024/classes.json` Fighter majors[0].features[1] (feature-level `proficiency_choices`).
- Consumers that read the WRONG level: `src/services/character/proficiencyUtils.js:36` and `src/services/character/proficiencyUtils2024.js:38` only merge/count `bonusSource.proficiency_choices` / `major.proficiency_choices` — Battle Master major has `proficiency_choices: null` (choices live on the feature object), so the Student-of-War-labelled code paths are dead for this feature.
- `src/services/rules/rules-proficiencies.js:116` passes `playerStats.class.major` as bonusSource (never scans `major.features[]`).
- Wizard limit services never scan major features: `src/services/character/toolValidation.js getToolLimitsByCategory` (background/class/feats only), `src/services/character/skillValidation/limits.js` (class/race/background/feat pools only).
- Sheet categorization: `src/services/character/featureCategories.js:237` puts Student of War in `characterAdvancement` (display-only; `src/components/char-sheet/CharCharacterAdvancement.jsx`).

## Notes
- A fix needs: (a) wizard skill pool +1 restricted to the 9 Fighter skills and tool limit +1 Artisan's Tools sourced from `major.features[].proficiency_choices`, (b) a chooser UI (or pool-driven selection at steps 10/11) with persistence, and (c) proficiency application (sheet + ability checks). Existing pool machinery in skillValidation/limits.js (`skillChoiceSources`) is the natural seam.
- Live control probe confirms no hidden auto-grant: change-data has zero relevant keys; disk proficiencies unchanged; clicking row produces no network/popup.
- No campaign log entry exists for this feature (popup-only isn't even reached) — logging gap trivially follows from non-implementation.
