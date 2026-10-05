# Bug SP-047 — Fey Spirit: AC never scales with slot level (missing armor_class_scales_with_slot flag)

## Title
Fey Spirit summon spawns correct HP ladder (30 / +10 per lv above 3) and Speed 30/Fly 30, but AC stays flat 12 — spell text requires AC 12 + slot level (15 at lv3, 17 at lv5). Root cause: per-monster opt-in flag absent from fey-spirit data.

## Overview
Verified 2026-10-04, test-campaign, caster Wild_Sage_Druid lv20 (Fey Spirit native in book — byte-exact after).

## Expected Behavior (2024 spells.json text)
Small Fey; **AC 12 + spell's level**; HP 30 (+10/slot above 3); Speed 30 ft., Fly 30 ft.

## Actual Behavior
1. lv3 cast: card "Fey Spirit 1" — `ac:12` (expects 15), hp 30/30 ✓, speed walk/fly 30 ✓, Small fey ✓, init caster−0.1, `Summoned (Wild_Sage_Druid)` badge, log "slot level 3, summoning Fey Spirit (30/30 HP)".
2. lv5 upcast: hp 50/50 ✓ ladder exact (`hpPerLevelAbove:10` works), `ac:12` AGAIN (expects 17). Slots paid 3→2 & 5→2.
3. Root cause: monsters.json `fey-spirit` lacks `armor_class_scales_with_slot` (only bestial-spirit-air/land/water carry it) → opt-in branch summonSpiritHandler.js:141 never engages — silent flat AC.
4. Lifecycle PASS-side: conc chip + 600-round expiry clock; × break → both spirits despawn, all spirit/summon/concentration/pendingExpirations keys GET-clear; break logged ×2.
5. Attack chip "Fey Blade" (+9, 2d6+3+3 Force) present on card — advisory, not pressed.

## Steps to Reproduce
1. Druid lv20; cast Fey Spirit at lv3 → card AC 12 (not 15); lv5 → AC 12 (not 17).

## Likely Location
- `public/data/monsters.json` fey-spirit block — add `armor_class_scales_with_slot: true` (data fix; handler branch already exists at summonSpiritHandler.js:141). Audit all summon texts with "+ spell's level" AC vs flag presence.

## Notes
- Single-variant summon_spirit auto-summons on Cast (no chooser modal). Book byte-exact; Admin cleared GET-empty. Verified 2026-10-04.
