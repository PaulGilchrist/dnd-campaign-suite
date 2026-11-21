# Monster chip attacks enforce the WRONG range bands (fallback 30 ft / dual-notation ranges never measured)

## Summary
The monster-card chip press lane measures ranged attacks against `resolveAttackRange(action)`, which falls back to a hard-coded **30 ft** when the action JSON carries no structured `range` field — and `rangeToFeet()` cannot parse the dual-notation strings (`"80/320 ft."`) that 79 authored ranges use, returning null so those bands are never applied at all. Live-proved on a tokenized active map: a Goblin Shortbow shot at 35 ft rolls with Disadvantage and at 65 ft AUTO-MISSes, and a Hobgoblin Longbow shot at 170 ft AUTO-MISSes even though a natural 15 would have hit — all three distances are inside the weapons' authored RAW ranges (Shortbow 80/320, Longbow 150/600; the prose descriptions say so, the structured fields don't exist).

## Steps to reproduce
1. In test-campaign, quick-spawn a **Goblin** on the Initiative board (`+ Monster` → search "Goblin" → select the `.qms-row` whose `.qms-row-name` is exactly `Goblin` → `Spawn`), arm target **FeyRanger** via `select[aria-label="Goblin target"]`.
2. Create + activate a sandbox indoor map (GM localhost):
   `POST /api/campaigns/test-campaign/maps` with `{"name":"qa-ccc-range","gridSize":30,"players":[{"id":"feyranger","name":"FeyRanger","gridX":5,"gridY":5}],"placedItems":[{"id":"gob-token-ccc","type":"npc","name":"Goblin","gridX":5,"gridY":12,"visible":true}]}` then `PUT …/maps/qa-ccc-range/activate`. Reload/re-select so the tab arms the map.
3. Open the Goblin's card modal (avatar click), wait ~1.5 s for the map fetch, press the **Shortbow** `.mc-dice-link`.
4. Observe the staged popup: `Disadv (Beyond normal range (35 ft > 30 ft))` — two-dice keep-low roll. Commit with Done and check `/log`: attack row carries `rangeReason:"Beyond normal range (35 ft > 30 ft)"`, `mode:"disadvantage"`.
5. Move the Goblin token to `gridY:18` (65 ft) via doc PUT; reopen the modal, press Shortbow again: popup `✗ AUTO-MISS (Out of range (65 ft > 60 ft))` — attack row `isAutoMiss:true`, zero damage rows.
6. Quick-spawn a **Hobgoblin**, arm FeyRanger, add a map token `{"type":"npc","name":"Hobgoblin","gridX":29,"gridY":29}` (~170 ft diagonal). Open its modal, press **Longbow**: natural 15 rolled (+3 = 18 vs AC 12 — a clean hit) but the popup reads `✗ AUTO-MISS (Out of range (170 ft > 60 ft))`; log row: `"Hobgoblin attacks FeyRanger with Longbow: 15 +3 (+3 to hit) vs AC 12 — AUTO-MISS"`, `isAutoMiss:true`.

## Expected behavior
Per the authored bestiary prose (Shortbow "range 80/320 ft.", Longbow 150/600): 35 ft and 65 ft Shortbow shots are within NORMAL range → normal single-die rolls, no disadvantage, no auto-miss. The 170 ft Longbow shot is between normal (150) and long (600) → at worst Disadvantage, never an auto-miss; the rolled 18 vs AC 12 should have hit (or rolled under disadvantage).

## Actual behavior
Shortbow (range 80/320 per description, NO structured field in `public/data/monsters.json` → `resolveAttackRange` returns 30): 35 ft → forced disadvantage; 65 ft → auto-miss. Longbow (same missing-field situation): 170 ft → auto-miss kills a natural 15. Verified log rows (test-campaign):
- `"Goblin attacks FeyRanger with Shortbow: 4 +4 (+4 to hit) vs AC 12 — MISS"`, `mode:"disadvantage"`, `rolls:[9,4]`, `rangeReason:"Beyond normal range (35 ft > 30 ft)"`
- `"Hobgoblin attacks FeyRanger with Longbow: 15 +3 (+3 to hit) vs AC 12 — AUTO-MISS"`, `isAutoMiss:true`, `rangeReason:"Out of range (170 ft > 60 ft)"`

## Likely location
(confident, code read + live)
- `src/components/encounter/MonsterCardModal.jsx` `resolveAttackRange` (~line 1717): `if (action?.reach) …; if (action?.range) …; return 30;` — the 30-ft fallback silently invents a range for 42 ranged actions across **21 monsters** (incl. Goblin, Hobgoblin, Drow, Drider, Gnoll, Bard, Efreeti…).
- `src/services/rules/combat/rangeValidation.js` `rangeToFeet` (line 22): the anchored regex `^(\d+)\s*(feet|foot|ft\.?)$` never matches dual notation `"80/320 ft."` → null → `computeRangeEffect` returns `{mode:'normal'}` for the **79 dual-notation range fields** — the opposite error (bands never applied to genuinely out-of-long-range shots).
- `src/services/rules/combat/rangeValidation.js` `computeRangeEffect` (line 69): models long range as `normal × 2`; the bestiary dual notation is frequently `×4` (80/320, 150/600, 20/80) or `×3`/`×6` — even parsed ranges get the wrong long band.
- Data: `public/data/monsters.json` actions carry `range` inconsistently — prose says "range 80/320 ft." while the structured field is absent.

## Suggested fix
1. `rangeToFeet` should recognize dual notation: `^(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)\s*(feet|foot|ft\.?)?$` and return `{ normal, long }` (or add a sibling `rangePairToFeet` used by `computeRangeEffect`) so the REAL long figure replaces the `×2` model.
2. Populate the missing `range` fields in `monsters.json` (at least the 42 no-field ranged actions), or make `resolveAttackRange` parse the action `description` (`range (\d+(?:/\d+)?) ft`) as a fallback BEFORE inventing 30 — and when no range can be derived for a ranged attack, stay lenient (null → no band) rather than enforcing a fabricated 30 ft.
3. Triage the sheet-weapon lane for the same dual-notation parse gap (`formatWeaponRange` shares `MELEE_RANGE_FT` from the same file).

## Severity
Broken feature / data-integrity-of-rules risk — the app silently overrides honest rolls ("AUTO-MISS" on a natural-15 hit) whenever a tokenized map is active; wrong outcomes land in the campaign log and on HP buckets.
