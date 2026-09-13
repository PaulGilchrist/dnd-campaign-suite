# Bug MA-0070 — Adult Brass Dragon "Legendary Action Uses: 3 (4 in Lair)" inert

**Verdict: FAIL** (MV-17 family: name-text-only header, no legendary economy)

## MV-17 fingerprint match
- `legendary_actions[0]` in `public/data/monsters.json` is a header entry whose *name* carries the uses budget ("Legendary Action Uses: 3 (4 in Lair)"); no uses field, no spend metadata.
- `MonsterCardBody.jsx:29` renders legendary actions (incl. this header) through the generic `mc-action` section (MonsterAction.jsx); no counter, no button, no spend handler.
- Grep-zero legendary economy: no `legendary_uses` / `legendaryUses` / use-counter / restore logic in `src/` or `server/`; `legendary_actions` consumers are display (MonsterCardBody.jsx) + npcStatBlockUtils stat-block copy + tests.

## Live evidence (2026-09-13, test-campaign, :5173)
- Header confirmed `test-campaign` (MV-18). Joined Adult Brass Dragon via EB checkbox + Join Encounter (CR 13, 10,000 XP, HP 172, init 8); opened `.mc-overlay`.
- Uses row DOM: `{ tag: "DIV", cls: "mc-action", cursor: "auto", interactiveChildren: [] }` — no affordance; innerHTML is `<strong>` + `<span>` text only.
- Forced click + dblclick on the row: modals 1→1, no state change.
- Change-data flatten diff after forced clicks: only `combat-ui-viewingMonster.*` overlay-open echo keys (pre-existing `characterKey===campaignName` defect); zero legendary-use keys created/spent/restored. Zero delta = no legendary use economy exists.

## Expected vs actual
Expected: clickable budget / decrementing counter (3, or 4 in lair), spend on legendary action, restore at start of dragon's turn, logged to campaign log.
Actual: static text header; uses never tracked, spent, or restored.
