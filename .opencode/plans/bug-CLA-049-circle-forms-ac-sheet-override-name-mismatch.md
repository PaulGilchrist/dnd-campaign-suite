# Bug CLA-049 — Circle Forms: applied AC override never displays on character sheet (subclass name mismatch)

## Title
Circle Forms AC override writes correct value (circleFormsAC=16) but CharSummary display lane never matches subclass name "Circle of the Moon", so the sheet shows pre-transform AC 9 during Wild Shape.

## Overview
CLA-049 (Circle Forms, Druid Circle of the Moon 2024, lv3) applies its three benefits via the hardcoded flow in `wildShapeCreatureBuilder.js:activateWildShape()` — NOT via the `circle_forms_active` passive_buff automation (confirmed dead: grep `circle_forms_active` matches ONLY `public/data/2024/classes.json:4118`; zero consumers in `src/` or `server/`; passive_buff processors handle only truesight/blindsight in rulesFactory.js:79/86 + senseUtils.js, and `bonusExpression` is only processed by buffHandler.js:477 for `bonusEffect === 'temp_hp'`, never for `requiresActive`).

Runtime state is written EXACT, but the character-sheet Armor Class cell still reads the unarmored base AC while shape-shifted because `computeCircleFormsACOverride` compares against `'Moon'`, not the app-canonical full name `'Circle of the Moon'`.

## Expected (quote, public/data/2024/classes.json, Druid major "Circle of the Moon", feature "Circle Forms", level 3)
"You can channel lunar magic when you assume a Wild Shape form, granting you the benefits below.
- **Challenge Rating:** The maximum Challenge Rating for the form equals your Druid level divided by 3 (round down).
- **Armor Class:** Until you leave the form, your AC equals 13 plus your Wisdom modifier if that total is higher than the Beast's AC.
- **Temporary Hit Points:** You gain a number of Temporary Hit Points equal to three times your Druid level."

lv20 WIS16 (+3) → CR limit 6; AC = max(beastAC, 16); THP = 60.

## Actual
- CR gate: WORKS. Chooser header "Choose a beast form (CR 6 or lower)"; sheet row "Wild Shape Max Challenge Rating: 6"; list (92 beasts) contains Wolf (CR 1/4) and Mammoth (CR 6) but excludes Giant Ape (CR 7) and Tyrannosaurus Rex (CR 8). classRules2024.js:119-129 → PolymorphSelectionModal.jsx:43-62.
- THP: WORKS EXACT. Temp HP: 60 on sheet and initiative card; disk `tempHp: 60`. wildShapeCreatureBuilder.js:123-126.
- AC: FAIL. Disk runtime `circleFormsAC: 16` = max(Wolf 12, 13+3) is written correctly (wildShapeCreatureBuilder.js:66-68), but character sheet Armor Class cell displays **9** (base DEX 8 unarmored) while shape-shifted — override never shown.

## Steps
1. test-campaign, Wild_Sage_Druid lv20; wizard step 7 → subclass "Circle of the Moon" → ✓ Save (disk-verified subclass.name = "Circle of the Moon").
2. Wild Shape: click `b.clickable "Wild Shape:"` → `.sp-modal` chooser → select Wolf → confirm "Wild Shape".
3. Observe: badge "Wild Shape: 10 hours" + card "Temp HP: 60" render; Armor Class cell still "Armor Class: 9" (pre/post reload), never 16.
4. change-data (disk read): `circleFormsAC: 16`, `tempHp: 60`, activeBuffs `shape_shift{blocksSpellcasting:true}`, te `wild_shape{beastName:Wolf}`, wildShapeUses 4→3 — all written.

## Likely Location
`src/components/char-sheet/char-summary/charSummaryCalc.js:36-41` `computeCircleFormsACOverride`:
```js
const isMoonDruid = playerStats.class?.major?.name === 'Moon' || playerStats.class?.subclass?.name === 'Moon'
```
App data (classes.json + wizard-saved character JSON) stores full name `'Circle of the Moon'` (`major` is null; `subclass.name` = `'Circle of the Moon'`), so the check never matches and the override returns null. Contrast: wildShapeCreatureBuilder.js:124 and classRules2024.js:122 both correctly match `'Circle of the Moon'`. Fix: match `'Circle of the Moon'` (or endsWith `'Moon'`).
Initiative lane `computePlayerAc` (displayCreatureUtils.js:28) uses the runtime key directly and is correct, but initiative tracker cards do not render an AC numeric for player creatures, so no surface shows 16.

## Notes
- Manifest dead-code claim VERIFIED (see Overview grep evidence).
- Manifest source locations (classFeatureHandler/classFeatureRouter/classFeatureInfoBuilder) not involved; live path is wildShapeCreatureBuilder.js per manifest's own fallback claim.
- Second-beast "beast AC ≥16 no-change" case not exercised (app chooser never displayed AC anyway; disk math max() covers it).
- Verdict: FAIL (AC shown non-exact: 9 vs 16; THP and CR gate exact).
