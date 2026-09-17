# BUG MA-0329 — Azer Pyromancer / Hellish Rebuke (2/Day): bare-text reaction row, zero trigger wiring

## Overview
The Azer Pyromancer reaction row "Hellish Rebuke (2/Day)" (monsterIndex `azer-pyromancer`, reactions[0], actionType other) is a bare name+description row of the MA-0284/0285/0286 class: no automation metadata on disk, no gated-reaction registration, no damage-trigger wiring. The monster never reacts when damaged — no prompt, no roll, no damage, no uses counter, no log row.

## Expected
Per 5e, when the Azer takes damage from a creature it can see (and isn't immune), it responds with Hellish Rebuke: DEX save (its spellcasting DC), 2d10 fire (half on save), consuming 1 of 2 uses, with a live reaction affordance/prompt on the damage event and log rows for save/damage/uses.

## Actual
- **Disk** (`public/data/monsters.json` azer-pyromancer reactions[0]): keys are ONLY `name` + `description` — no `trigger`, `type`, `uses`, `damage_dice`, `save_dc`, `automation`.
- **Gate** (`src/components/encounter/MonsterCardHelpers.js:507` `GATED_MONSTER_REACTIONS`): only `feather_fall` + `counterspell` registered → `getGatedMonsterReaction(action)` (L567) returns null for this row → no affordance chip, no trigger wiring (`MonsterAction.jsx:135`, `MonsterCardModal.jsx:1299`).
- **Grep-zero producers**: no Hellish Rebuke monster-reaction automation anywhere in `src/` — all 42 `hellish` matches are Tiefling "Hellish Resistance" resistances, Fiendish Legacy (player class feature), Signature Spells, or their tests. No damage-event subscriber emits a hellish_rebuke reaction.
- **Live affordance dump** (test-campaign, joined "Azer Pyromancer 1", card open): reaction row `.mc-action` → diceLinks 0, buttons 0, clickable 0 (contrast: Flame Burst row diceLinks 1, Spellcasting row diceLinks 3). Row innerHTML is pure static `<strong>` + `<span>` text. Forced `el.click()` ×2 → zero popup/modal/offer/prompt.
- **Live damage probe**: GM HP input on initiative tracker 97→90 committed to server (change-data combatSummary `Azer Pyromancer 1 currentHp: 90`) → zero reaction prompt, zero popup, no new change-data reaction/hellish/uses keys, log unchanged at 2 rows (joined + initiative), zero `hellish`/`rebuke`/`damage`/`reaction` log entries.
- **Compounding**: per MA-0328, this monster has no numeric spell save_dc, so even a borrowed reaction DC would be DC-Unknown (MA-0237 class).

## Steps to Reproduce
1. localhost:5173 → test-campaign (verify header) → Encounters (EB) → search "Azer Pyromancer" → Join Encounter.
2. Initiative: open Azer Pyromancer 1 card → Hellish Rebuke (2/Day) row: no chip/button/dice link; forced click ×2 → no popup.
3. Set Azer current HP 90 via tracker GM input (committed server-side) → no reaction prompt, no automation.
4. `curl /api/campaigns/test-campaign/log` → no hellish_rebuke/reaction entries ever.

## Likely Location
- Data shape: `public/data/monsters.json` azer-pyromancer reactions[0] (name+description only).
- Gate: `src/components/encounter/MonsterCardHelpers.js:507-569` (`GATED_MONSTER_REACTIONS` lacks a hellish_rebuke entry; no damage-trigger subscriber seam for this row).
- Fix direction: register a `hellish_rebuke` gated reaction (trigger: takes damage; DEX save vs derived/numeric DC; 2d10 fire; 2/day uses counter) in the gated-reaction registry + damage-event automation, and author `trigger`/`uses`/`damage_dice`/`save_dc` metadata.

## Verdict
FAIL — MA-0284-class bare reaction: no trigger + no affordance + no automation (grep + live + curl evidence above).
