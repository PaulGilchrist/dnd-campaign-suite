# MA-1883 — Demogorgon "Cast a Spell (Costs 2 Actions)" — delegate resolves into empty save lane (data)

## Title
Demogorgon legendary "Cast a Spell (Costs 2 Actions)" delegates to a plain-text Spellcasting row; the delegate routes through the save leg with `save_dc:23` propagated but zero payload — the victim rolls and fails into empty air, no spell is ever named, picked, or resolved, and the RAW cost of 2 is spent as 1.

## Overview
Row MA-1883 (`demogorgon|legendary_actions|3`), verified E2E localhost/test-campaign 2026-10-10. Distinct from MA-1853 (Cthulhu Cast Cantrip console-error burn): here there is NO console error — `delegates_to:"Spellcasting"` resolves via the `save_dc>0` CAN-route (MA-1874 twin) into a payload-less save shell.

## Expected Behavior
Row description: "The demogorgon uses Spellcasting." (RAW: cast one prepared spell, costs 2 legendary uses; spell list per Spellcasting row MA-1879.)
Expected: a cast affordance (spell picker or named spell resolution); LA spend of exactly 2.

## Actual Behavior
- `ability_use` "Cast a Spell (Costs 2 Actions) (Spellcasting save) — 1 of 2 left" logged; victim `roll save` WIS d20 14+0 vs propagated `saveDc:23` → FAIL → **zero state**: no `save_result`, no damage, no condition, no `hp_change`, no spell name, zero spell picker, `monsterSpellUses` absent.
- Popup: generic "DC Unknown — no success or failure" shell (§141 cosmetic).
- LA spend 1, not 2: `expendLegendaryUse` hardcodes `used+1` (monsterLegendaryUses.js:344); "Costs 2 Actions" name-text only, zero per-row cost parsing app-wide (MA-1847/MA-1872 family).
- Once-per-boundary latch honest (press 2 refused zero-spend).

## Steps to Reproduce
1. localhost → test-campaign → Demogorgon in initiative (registry); arm PC.
2. After a PC turn press "Cast a Spell (Costs 2 Actions)" legendary chip.
3. Observe a save roll vs DC 23 that resolves into nothing, and LA −1 (not −2).

## Likely Location
`public/data/monsters.json` — Spellcasting row must gain markup chips (MA-1879 fix); the legendary delegate then routes through a real spell lane. Engine-side: cost-token parsing for "Costs N Actions" (MA-1847 precedent); guard the delegate→save leg against zero-payload rows.

## Notes
- Families: MA-1879 (dead spellcasting lane, root), MA-1874 (delegate CAN-route to save leg), MA-1853 (console-error variant), MA-1847 (cost name-text).
- New pitfall: delegate→`save_dc>0` CAN-route fires victim save with zero observable consequence — detect by save-roll present + zero `save_result`/state delta.
