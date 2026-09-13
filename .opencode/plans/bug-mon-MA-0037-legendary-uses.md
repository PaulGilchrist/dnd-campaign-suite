# Bug MA-0037 — Adult Black Dragon "Legendary Action Uses: 3 (4 in Lair)" inert

**Verdict: FAIL** (MV-17 family: name-text-only header, no legendary economy)

## MV-17 fingerprint match
- `legendary_actions[0]` in `public/data/monsters.json` is a header entry whose *name* carries the uses budget ("Legendary Action Uses: 3 (4 in Lair)").
- `MonsterCardBody.jsx` renders legendary actions (incl. this header) as inert `<div className="mc-action">` (via MonsterAction.jsx:60); no counter, no button, no spend handler.
- Grep-zero legendary economy: no `legendaryUses` / `legendary_uses` / use-tracking anywhere in `src/` or `server/` (only static `legendary_resistance` display, MonsterCardBody.jsx:301).

## Live evidence (2026-09-13, test-campaign, :5173)
- Header confirmed `test-campaign` (MV-18). Joined Adult Black Dragon via EB checkbox (CR 14, 11,500 XP); opened `.mc-overlay`.
- Uses row DOM: `{ tag: "DIV", cls: "mc-action", cursor: "auto", clickable: false, overlay: true }` — no affordance.
- Forced click + dblclick on the row: no state change. Single change-data curl after: no legendary keys created/changed (only `encounter-viewingMonster` overlay-open echo, itself flagged by pre-existing `characterKey===campaignName` console error). Zero delta = no legendary use economy exists.

## Related console errors (pre-existing, surfaced by this flow)
- `[setRuntimeValue] characterKey === campaignName … propertyName: "encounter-viewingMonster"` (useRuntimeState.js:79) — secondary defect: viewing state stored under campaign key.

## Expected vs actual
Expected: clickable/expends uses (3, or 4 in lair), counter decrements, logs to campaign log.
Actual: static text; no uses tracked, spent, or restored.
