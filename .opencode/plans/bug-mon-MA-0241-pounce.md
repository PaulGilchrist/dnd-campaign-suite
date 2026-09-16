# Bug: MA-0241 Ancient Red Dragon "Pounce" legendary action is inert

## Overview
Legendary action "Pounce" (MA-0241) on the Ancient Red Dragon monster card renders as inert prose with no clickable affordance. Clicking it produces no roll, popup, or log entry.

## Expected
- Row in `public/data/monsters.json` → `ancient-red-dragon.legendary_actions[3]` currently has only `{name, description}` (verified via curl).
- Per fingerprint MA-0220/MA-0230/MA-0164, an actionable legendary attack should expose `uses` and `delegates_to` so the card renders a live attack affordance; the movement clause should be GM-advisory.
- Expected row: `{name: "Pounce", description: "The dragon moves up to half its Speed, and it makes one Rend attack.", uses: 3, delegates_to: "Rend"}` — movement clause moved to GM-advisory §7.

## Actual
- Rendered row outerHTML: `<div class="mc-action "><strong>Pounce.</strong> <span>The dragon moves up to half its Speed, and it makes one Rend attack.</span></div>` — 0 `.mc-dice-link`, 0 `button`.
- With a target armed via card `[data-testid="target-select"]`, clicking the row: log count 4 → 4 (zero delta), no popup, no roll.

## Steps
1. Encounters → search "Ancient Red Dragon" → tick → Join Encounter.
2. Arm a target via the dragon card `[data-testid="target-select"]`.
3. Dump Pounce row outerHTML → no dice-links/buttons; click → log `/api/campaigns/test-campaign/log` count unchanged (4→4).
4. Control: click non-legendary Rend chip "+17" → live attack roll logged (log 4→5, type "roll", name "Rend", bonus 17).

## Likely Location
- `src/components/MonsterCard/MonsterAction.jsx` — legendary rows without structured fields render as inert text.
- `MonsterCardBody` legendary block — no delegation/roll wiring for legendary actions.
- `public/data/monsters.json` `legendary_actions` — missing `uses: 3` and `delegates_to: "Rend"`; fix = add `uses: 3` + `delegates_to: "Rend"`, move movement clause to GM-advisory §7.

## Notes
Same family as MA-0220 / MA-0230 / MA-0164: bare-prose legendary rows with no attack_bonus/dice/delegates_to are inert text with zero click affordance.
