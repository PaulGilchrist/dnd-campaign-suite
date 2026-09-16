# Bug MA-0243 — Ancient Red Dragon lair tremor inert (nameless lair row)

## Title
MA-0243: Ancient Red Dragon `lair_actions[1]` ("Unnamed lair actions 2") — numeric DC 15 DEX + prone save_effect but no `name` → inert static row, unclickable, zero log delta.

## Overview
Data-fingerprint MA-0221/0222/0231/0232/0233/0242 repeat. Row carries machine-readable `save_dc: 15`, `save_type: "Dexterity"`, `save_effect: "Failure: The target is knocked prone."` but lacks `name`, so the `isLairRowClickable` name-gate rejects it before the save_dc branch ever runs.

## Expected
Row quotes: "A tremor shakes the lair in a 60-foot radius around the dragon. Each creature other than the dragon on the ground in that area must succeed on a DC 15 Dexterity saving throw or be knocked prone."
Should render a clickable "DC 15 Dexterity" affordance (`.mc-dice-link`), fire a DEX save prompt on click, and grant prone on failure with a campaign-log entry.

## Actual
- Rendered as static `<div class="mc-action"><strong>.</strong> <span>A tremor shakes…</span></div>` — `<strong>.</strong>` (empty name) + prose, 0 `.mc-dice-link`/`[role="button"]`.
- Forced JS click → log delta 0 (2→2), no DC 15 DEX save prompt, no prone grant. Fully inert.
- CONTROL: Rend `.mc-dice-link` "+17" live → real roll logged (`roll / Ancient Red Dragon 1 / Rend`). Engine healthy; defect is row-specific.

## Steps
1. curl `public/data/monsters.json` → ancient-red-dragon `lair_actions[1]` keys = description/save_dc/save_type/save_effect — no `name`.
2. test-campaign (header verified) → Encounters → search "Ancient Red Dragon" → tick → Join Encounter (HP 507, init 2).
3. Open dragon card → lair row `.mc-action` static, 0 links; forced click → log 2→2 zero delta, no prompt, no prone.
4. CONTROL: Rend chip "+17" → live roll logged (count 3).

## Likely Location
- `public/data/monsters.json` — ancient-red-dragon `lair_actions[1]` nameless dict (root = DATA authoring).
- `src/services/encounters/monsterLairActions.js:26` — `isLairRowClickable` `if (!row || typeof row !== 'object' || !row.name) return false;` HARD name-gate evaluated BEFORE the `save_dc` branch → `lairRowAffordance` null despite numeric DC.
- `src/components/encounter/MonsterCardBody.jsx:340` — `!isLairRowClickable(la)` → static MV-24 prose branch.

## Fix
Author `name` (e.g. "Tremor") on `lair_actions[1]` plus a structured `save_effect` prone mirror so `isLairRowClickable` passes → 'save' affordance chip → save seam grants prone on failure (MA-0017/MA-0107 consumer shape already exists, unreached).

## Notes
Family: MA-0221/0222/0231/0232/0233/0242 — identical name-gate inert fingerprint. Producers never fix on consumer side.
