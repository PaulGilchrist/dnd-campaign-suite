# bug-mon-MA-0080 — Adult Bronze Dragon Spellcasting — block-save only, named spells inert (MV-5)

## Title
MA-0080 Adult Bronze Dragon · Spellcasting · spellcasting · DC 17 Charisma · FAIL (flavor b)

## Overview
Spellcasting row renders a single generic "DC 17 Charisma" block-save button; all named spells are inert `<em>` prose. Subagent labeled "PASS — matches MV-5 fingerprint"; per strict rules the MV-5 fingerprint IS FAIL (zero per-spell cast path). Orchestrator converted per MV-30.

## Expected
Per-spell casting for Detect Magic / Guiding Bolt(lv2) / Shapechange / Speak with Animals / Thaumaturgy (At Will) and Detect Thoughts / Water Breathing (1/Day Each), CHA DC 17 / +10 spell attack.

## Actual
- Single `DC 17 Charisma` block link; spell names inert.
- Block click → boilerplate save overlay ("DC Unknown" echo), zero spell attribution.
- grep guiding_bolt/water_breathing outside public/data = 0 consumers; zero monster spellcast path (MV-5 family).

## Steps to Reproduce
1. test-campaign → EB join "Adult Bronze Dragon" → .mc-overlay → Spellcasting row → click "DC 17 Charisma" → generic save; forced-click spell names → nothing.

## Likely Location
MonsterAction.jsx block-save rendering; monster spellcasting subsystem absent (MV-5 family).

## Notes
1/Day usage prose-only, ungated.
