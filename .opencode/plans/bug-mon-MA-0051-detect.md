# Bug mon-MA-0051 — Adult Blue Dracolich · "Detect" · legendary_actions · other

## Verdict: FAIL — MV-17 fingerprint confirmed (no numeric fields → inert; no monster skill-check producer)

## Repro (E2E, test-campaign, :5173)
1. Joined Adult Blue Dracolich via Encounter Builder → Join Encounter. Initiative card init 8, HP 225/225.
2. Avatar click → `.mc-overlay` open. "Detect" row renders under Legendary Actions as static text.
3. Row DOM: `DIV.mc-action`, `cursor: auto`, no onclick/role=button/`.mc-dice-link` → zero affordance.
4. Forced click×2 + dblclick → zero delta: HP 225, no save/skill prompt, no modal, 0 new log entries, no d20 roll.
5. change-data: no prompt/roll/skill/legendary keys — only static `combat-ui-viewingMonster` echo.
6. Code: `mc-dice-link` producers exist only for initiative (MonsterCardBody.jsx:142), ability modifiers (:183), saving throws (:257). No legendary-action or skill-check roll producer exists for monsters → row inert by construction.

## Expected vs actual
- Expected: clicking "Detect" runs a Wisdom (Perception) check (d20 + skill mod), logs result, consumes 1 legendary use.
- Actual: row is display-only text; skill checks for monsters are not implemented anywhere. "Perception 24" on card is passive-senses static text (MonsterCardHelpers.js:32), not a roll.

## Notes
- Same fingerprint as MA-0050 (legendary_actions unimplemented); no numeric save_dc/damage in this row, matching MV-17 "no numeric fields → inert".
- Session contained repeated prompt-injection attempts (signed attacker OSS URLs in tool params/output); all ignored, none fetched.
