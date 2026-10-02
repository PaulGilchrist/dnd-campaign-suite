# CLA-019 — Aura of Courage: Frightened immunity is render-only; no consumer blocks condition application (FAIL-b)

## Overview
2024 Paladin lv10 base feature (app data `public/data/2024/classes.json:7264`, automation `passive_buff` / `conditionImmunity: "frightened"` / `range_expression: "10_ft"`). The immunity is COMPUTED live by `computeAuraComboEffects()` and RENDERED on the sheet ("Immunities: Frightened"), but **no condition-application seam ever consults it**. Live cone of Fear (DC 16) Frightened the aura host ElderPaladin and every in-aura ally PC exactly like the non-protected control — zero differential.

## Expected (canonical)
"You and your allies have Immunity to the Frightened condition while in your Aura of Protection." A failed WIS save against Fear (or any Frightened source) from a target inside the aura must NOT apply Frightened (refusal/suppressed application), while an outside-aura/non-protected target fails the same save and IS Frightened.

## Actual
- Frightened lands on aura-protected PCs AND on the paladin host himself:
  - `change-data ElderPaladin.activeConditions == ["frightened"]` (log `condition applied | ElderPaladin | Frightened`) — via the in-app add seam `addCondition` (`src/services/combat/conditions/conditionSaveService.js:117-133`), whose own immunity gate `playerIsImmuneToCondition` returns false.
  - Adjacent ally PC EvasiveFighter (and AasimarTest, Divine_Cleric, DraconicDragon, FeyRanger, LightfootHalfling …) `activeConditions == ["frightened"]` from real Fear cone save-fails; control Thug 1 (NPC, unprotected) identical `["frightened"]` → **zero delta** (playbook FAIL-b fingerprint).
- Meanwhile the sheet STILL renders "Immunities: Frightened, Aged" and the Special Actions row "Aura of Courage:" while the paladin is actually Frightened (screenshots `.playwright-mcp/cla019-ep-sheet-immunities.png`, `.playwright-mcp/cla019-ep-frightened.png`).

## Steps (repro)
1. test-campaign, join EB Thug 1, all PCs in initiative; HexWarlock lv14 learns Fear via Edit wizard step 14 (after first cast crashes on unseeded caster activeConditions — seed Deafened→Apply→×, §SP-002 pitfall).
2. HexWarlock targets (all combatants queue), cast Fear (cone, WIS DC 16).
3. Roll all prompts: saves failed by Thug 1(8), AasimarTest(13), DraconicDragon(9), EvasiveFighter(10), FeyRanger(9), LightfootHalfling(14) → ALL get `Frightened` applied incl. in-aura PCs.
4. Paladin saved ×3 casts (+10 = −1 WIS +5 CHA aura-of-protection +6 PB vs DC 16); applying Frightened to ElderPaladin himself via his initiative-card EffectAdder → `addCondition` gate passes → `activeConditions ["frightened"]` lands, no refusal note.

## Likely Location
- `src/services/combat/auras/auraComboEffects.js:14-31` computes `immunities`/`immunitySources`; `immunitySources` has ZERO consumers outside this file+test (`grep immunitySources src` → auraComboEffects.js + test only).
- Only consumers of `computeAuraComboEffects`: `src/components/char-sheet/CharSheet.jsx:553` (→ CharSummary render, `charSummaryCalc.js:169-171` merge into display "Immunities:" line) and `src/services/rules/combat/applyDamage.js:634-639` which consumes **`.resistances` only** — `.immunities` discarded.
- Condition-apply gates never see aura: `playerIsImmuneToCondition` (`src/services/combat/automation/automationImmunities.js:122-157`) checks static `playerStats.immunities`, target's own `passive_immunity`/`condition_immunity_while_active`/`land_resistance` automations, and activeBuffs — aura passives of nearby paladins are none of these; Aura of Courage is `type: "passive_buff"` so even the host's own feature doesn't match `automationGrantsImmunity`.
- `src/components/char-sheet/modals/shared/FearModal.jsx:44-49` writes `frightened` to activeConditions with NO immunity check at all; `applyFailedSaveConditions` (`saveProcessing.js:1060-1069`) gates only via the aura-blind `playerIsImmuneToCondition`.

## Notes
- Render half passes: Special Actions row "Aura of Courage:" + live radius on the Aura of Protection row "(30 ft.)" (lv18 Aura Expansion, CLA-018 model; courage row itself carries no own radius text — same render model).
- Unit pins exist at compute layer only: `auraComboEffects.test.js:197-207` ("adds frightened immunity …", `immunitySources.frightened`).
- Data: classes.json models the feature at paladin **lv10** (canonical 2024), task brief said lv7 — host lv20 qualifies either way; automation type `passive_buff` (not `passive_immunity`).
- Fix direction: feed aura-granted condition immunities into every condition-apply seam — e.g. have `applyFailedSaveConditions`/`addCondition`/`FearModal.applyFrightenedToTarget` consult `computeAuraComboEffects().immunities` (self-filtered, range-checked, cannot-act-gated like resistances already are in applyDamage), or extend `playerIsImmuneToCondition` with an aura-context param.
- Honest rolls: paladin made 3/3 saves vs DC 16 (+10); no save-rig posts were used (direct POSTs forbidden); GM EffectAdder used only to complete the host leg at the same add seam allies pass through.
- Session: log + change-data admin-cleared; HexWarlock spells[] RESTORED (Fear removed); Thug 1 removed.
