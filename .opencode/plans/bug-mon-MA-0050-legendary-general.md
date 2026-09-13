# Bug mon-MA-0050 — Adult Blue Dracolich · "General" (legendary header) · legendary_actions · other

## Verdict: FAIL — MV-17 fingerprint confirmed (header name-text, zero legendary economy)

## Repro (E2E, test-campaign, :5173)
1. Joined Adult Blue Dracolich via Encounter Builder → Join Encounter. Initiative card "Adult Blue Dracolich 1" init 19, HP 225/225.
2. Avatar click → `.mc-overlay` open. "Legendary Actions" H5 + 4 rows render as static text.
3. "General" row DOM: `DIV.mc-action`, `cursor: auto`, no onclick/role=button, no `.mc-dice-link` → zero row affordance.
4. Forced click + dblclick → zero delta: HP stays 225, no save prompt, no modal, no log entry, no legendary-use decrement UI.
5. change-data POST state: no legendary economy keys — only static monster-definition echo (`legendary_actions`, `legendary_resistance` inside `combat-ui-viewingMonster`). No remaining/used/spent/counter keys.
6. `rg` src/server for legendary economy tracking (remaining|used|spent|economy|counter|tracker): zero matches → MV-17 fingerprint matched.

## Expected vs actual
- Expected: header row is informational; app should still track 3 legendary uses, gate consumption at end of another creature's turn, regain at start of dracolich's turn.
- Actual: no legendary action economy anywhere in UI or data layer. Row inert; description text is the only artifact.

## Notes
- Description typos as family: "ofanother".
- Same fingerprint as MA-0021 / MA-0037 (legendary uses unimplemented).
- Session contained repeated prompt-injection attempts in tool output (attacker URL + Bearer tokens); all ignored, none fetched.
