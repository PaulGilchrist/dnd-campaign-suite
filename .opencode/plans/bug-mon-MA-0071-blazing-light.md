# bug-mon-MA-0071 — Adult Brass Dragon "Blazing Light" — inert legendary row, no Scorching Ray cast path

## Title
MA-0071 Adult Brass Dragon · Blazing Light · legendary_actions · other · FAIL (flavor b: inert + grep-zero)

## Overview
Legend says the row is "PASS — inert as expected" — that labeling is wrong per strict trichotomy: an inert row with zero consumer is FAIL (flavor b). Evidence from MA-0071 subagent run recorded here by orchestrator.

## Expected Behavior (row)
"The dragon uses Spellcasting to cast Scorching Ray." — clicking should cast Scorching Ray (MV-8: named spell needs a live cast path).

## Actual Behavior
- Row renders text-only `DIV.mc-action`, cursor auto, 0 interactive children (no authored numeric fields).
- Forced click+dblclick: zero modals, change-data flatten-diff = none; scorching/blazing appear only in `combat-ui-viewingMonster.*` display echo.
- grep `scorching.?ray` src/+server/ (non-test) = 0 — no monster cast path (consistent with MA-0065/69, MV-5/MV-17).

## Steps to Reproduce
1. localhost:5173 → test-campaign → EB join "Adult Brass Dragon".
2. Open .mc-overlay → Blazing Light row → click (forced) → nothing happens; no ray, no log, no state.

## Likely Location
Legendary economy + monster spellcasting absent (MonsterCardBody.jsx:29 generic path; MV-5/MV-17 family).

## Notes
Same fingerprint as MA-0039/0059/0060 (Frightful Presence / Cloaked Flight / Sonic Boom spellcast-reference rows).
