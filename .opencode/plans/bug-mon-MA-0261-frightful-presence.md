# Bug MA-0261 — Ancient White Dragon "Frightful Presence" legendary row is inert (prose-only, no affordance, click zero-delta)

## Overview
Ancient White Dragon `legendary_actions[2]` "Frightful Presence" renders as bare prose with zero interactive affordance. Clicks on the row and its bold label produce no popup, no save prompt, no roll, no log entry, no runtime key. The FP tracking service exists app-wide but is unreachable from this row.

## Expected
> "Frightful Presence — The dragon uses Spellcasting to cast Fear. The dragon can't take this action again until the start of its next turn."

A clickable legendary row resolving a Charisma save (spell save DC 18 for Ancient White per RAW — NOTE: no numeric DC exists anywhere in the authored data, not even prose) with a once-per-turn latch.

## Actual (2026-09-16 session, test-campaign, Ancient White Dragon 1 cs idx1 init 9 HP 333/333)
- Card DOM `.mc-action` FP row = `<strong>Frightful Presence.</strong> <span>prose</span>` — **0 buttons, 0 .mc-dice-link, 0 [role=button], 0 save chips, no delegates_to chip**.
- Click on row, then on bold `<strong>` label (×2): **zero delta** — log stayed 212→212 entries, 0 "Frightful" log entries in entire campaign log, no modal/overlay, no pending save prompt, no `monsterLegendaryUses` key in change-data, 0 console errors.
- Control probe (same card, same session): Freezing Burst "DC 20 Constitution" chip click opened live target-select picker ("Constitution saving throw (DC 20)", 4d6, checkboxes, Skip used — no fire). Pipeline alive; FP delta-zero = row inert, not UI stall.
- Economy gate dead too: header row "Legendary Action Uses: 3 (4 in Lair)" renders as plain prose, no numeric `uses` field → `legendaryHeaderAction()` null → spend-gate never wired (MA-0259 confirmed on this card).

## Grep evidence
- FP consumer infra exists (`frightfulPresenceService.js`, `saveProcessing.js`, `clearExpirationEffects.js`, te registry) but all entry points fire from **authored save flows** (row needs `save_dc` + `repeat_save`) — `MonsterCardModal.jsx:830` arms MA-0048 repeat-save only on authored clause. Zero consumers reachable from bare-prose legendary rows.
- Zero prose-DC parsing: no DC-from-description regex in `MonsterAction.jsx`/`MonsterCardBody.jsx`. Engine cannot invent DC 18 — it appears nowhere in ancient data (task brief's "spell save DC 18" prose is NOT what's on disk; actual: "uses Spellcasting to cast <em>Fear</em>").

## Likely Location
DATA: `public/data/monsters.json` "ancient-white-dragon".legendary_actions[2] = bare `{name, description}` — no `save_dc`, no `save_type`, no `delegates_to`, no automation metadata. Gate: legendary header lacks numeric `uses` (MA-0259). `legendaryRowHasNumericMechanic()` false → no affordance (MA-0251 same card family, Chill row identical shape).

## Fix template
Adult white dragon FP on disk is the FIX TEMPLATE (fully authored): `save_dc:14, save_type:"Charisma", dc_success:"none", success_immunity:{frightful_presence_immunity, 24h}, repeat_save:{frightened, Charisma}, save_effect`. Mirror onto ancient with **save_dc:18** (ancient CAST +8 over adult 14; confirm vs source before authoring), plus header row[0] `uses:3` so the spend latch engages.

## Family
MA-0163/0219/0239/0240/0251 — inert "casts X (DC N)" / bare-prose legendary rows.
