# MA-0242 — Ancient Red Dragon geyser lair action unclickable (nameless lair_actions[0])

## Overview
Row MA-0242: Ancient Red Dragon, `lair_actions[0]`, "Unnamed lair actions 1" — numeric `save_dc` 15 DEX + 6d6 Fire but NO `name` field. Despite full resolvable mechanics, the row renders static and cannot be triggered.

## Expected
A numeric DC + dice lair action should present a clickable save affordance (mirroring fingerprint family MA-0221/0222/0231/0232/0233) so the GM can trigger the DC 15 DEX save and roll 6d6 fire.

monsters.json `lair_actions[0]`:
```json
{ "description": "Magma erupts... each creature in the geyser's area must make a DC 15 Dexterity saving throw, taking 21 (6d6) fire damage on a failed save, or half as much on a successful one.",
  "save_dc": 15, "save_type": "Dexterity",
  "save_effect": "Failure: 21 (6d6) Fire damage. Success: Half damage.",
  "damage_dice_primary": "6d6", "damage_type_primary": "Fire" }
```
(keys: description, save_dc, save_type, save_effect, damage_dice_primary, damage_type_primary — no `name`)

## Actual
Row renders `<div class="mc-action"><strong>.</strong> <span>Magma erupts…</span></div>` — literal "." placeholder, 0 `a`/`button`/`.mc-dice-link` elements. Clicking does nothing: log count 2→2, zero delta, no save prompt. Control Rend chip `.mc-dice-link` "+17" is live and logged a roll (log 2→3).

## Steps
1. Encounters → search "Ancient Red Dragon" → tick → Join Encounter.
2. Open dragon card (click portrait) → scroll to LAIR ACTIONS.
3. Observe "." placeholder row, no dice link; click → no save prompt, no log entry.

## Likely Location
- `public/data/monsters.json` — ancient-red-dragon `lair_actions[0]` lacks `name` (auto-titled "Unnamed lair actions N").
- `src/services/encounters/monsterLairActions.js:26` — `isLairRowClickable` name-gate (`if (!row || typeof row !== 'object' || !row.name) return false;`) short-circuits before the `save_dc`/`damage_dice_primary` checks, so MonsterCardBody.jsx:340 falls through to static prose rendering.

## Fix
Add `name` to the lair_actions row in monsters.json (plus `save_effect` already present) mirroring the working fingerprint rows so the name-gate passes and the save affordance renders.

## Notes
Family: MA-0221 / MA-0222 / MA-0231 / MA-0232 / MA-0233 — same nameless-lair-row fingerprint. Verified 2026-09-15 in test-campaign.
