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

## Resolution
FIXED 2026-11-20 (fix subagent session; repro + fix-verify both lived on `test-campaign`, sandbox maps `qa-fix-range`/`qa-fix-range2`).

**What was actually wrong** (confirmed the "Likely location" read, one correction):
1. `MonsterCardModal.jsx` `resolveAttackRange` fabricated a **30 ft** range for any action without structured `reach`/`range` — the 42 bestiary ranged actions (incl. Goblin Shortbow "range 80/320 ft.", Hobgoblin Longbow "range 150/600 ft.") were measured against 30/60. (Bug file said "21 monsters"; the disk census is 42 actions across 39 monsters — the 42 and 79 counts both byte-verified against `public/data/monsters.json`.)
2. `rangeValidation.js` `rangeToFeet`'s anchored regex never matched dual notation, so the **79 authored `"N/M ft."` range fields** produced `null` → `computeRangeEffect` returned `{mode:'normal'}` unconditionally — bands NEVER applied on that opposite-error lane too.
3. `computeRangeEffect` modeled long range as `normal × 2`, wrong for the ×3/×4/×6 bestiary pairs even when parseable.

**Fix (all lanes ride one canonical derivation; no `monsters.json` migration — the authored prose stays the single source, no second hand-duplicated field):**
- `src/services/rules/combat/rangeValidation.js` — new exported `rangePairToFeet(range)` → `{normal, long}`: dual notation ("80/320 ft.", unit-less "30/120" too) yields the REAL long figure (clamped long ≥ normal); numbers/single values keep the RAW `long = normal × 2` convention; touch/sight/unlimited/self/special keep their meanings. `rangeToFeet` now parses dual notation to its NORMAL figure (scalar consumers — melee discriminators, `formatWeaponRange` sheet lane included — see 80 for "80/320 ft." instead of null). `computeRangeEffect` adjudicates via the pair: authored long replaces ×2, `rangeMultiplier` scales BOTH bands, boundaries/reason templates unchanged.
- `src/components/encounter/MonsterCardHelpers.js` — exported `resolveAttackRange(action)`: structured `reach` → structured `range` → **authored prose** (`/reach|range N[/M] ft./i`, returned as a RAW `"N/M ft."` token so band math keeps the pair) → **null (LENIENT, no invented band)**. The hard 30 is gone.
- `src/components/encounter/MonsterCardModal.jsx` — presses thread the RAW token into `computeMapRangeState` → `computeRangeEffect` (dual bands now measured for both structured-`range` and prose-only actions); a `rangeToFeet`-derived `attackRangeFt` feeds the melee discriminators; unknown range folds neither 5-ft rider nor any band (hoisted `isMeleePressRange` keeps the press handler at its complexity cap).
- `src/services/combat/conditions/conditionEffects.js` — `combineAttackModes` 5-ft advantage/disadvantage riders fold ONLY when the range is known (null folds neither); hoisted `foldFiveFootRangeRiders` helper holds the cap.
- Dual-ruleset: this lane (`rangeValidation`, `MonsterCardModal`/`Helpers`, `conditionEffects`) is ruleset-shared — one implementation covers 5e and 2024. Sheet-weapon lane triaged: `formatWeaponRange`/PC-sheet discriminators gain correct normal-figure parsing from `rangeToFeet` and stay display-safe (the PC-sheet chip lane's gridless leniency law is unchanged, playbook §11).

**Verification:**
- Live repro (pre-fix) on the tokenized sandbox map, exact bug faces: Shortbow 35 ft → `Disadv (Beyond normal range (35 ft > 30 ft))`; 65 ft → `✗ AUTO-MISS (Out of range (65 ft > 60 ft))`; Longbow 170 ft → `✗ AUTO-MISS (Out of range (170 ft > 60 ft))` killing a natural 19 (22 vs AC 12); log rows `isAutoMiss:true` + fabricated `rangeReason`.
- Live re-verify (post-fix): 35 ft and 65 ft Shortbow → single-die `mode:"normal"`, `rangeReason:null` (honest MISS rows from the dice, not the band); 170 ft Longbow → `Disadv (Beyond normal range (170 ft > 150 ft))`, two-dice keep-low, NOT auto-miss (row `mode:"disadvantage"`, `isAutoMiss:false`). Adjacent sanity held: Longsword at 665 ft still `AUTO-MISS (Target out of melee range (665 ft > 8 ft))`; Scimitar at 5 ft normal HIT with honest `hp_change −5` and `rangeReason:null`; a 100-grid rig at 665 ft proved the REAL long figure — Longbow `AUTO-MISS (Out of range (665 ft > 600 ft))` (the ×2 model would have printed 300).
- Tests: new `src/services/rules/combat/rangeValidation.dual-range.test.js` (132 rows incl. full legacy `rangeValidation.test.js` table byte-kept) + `src/components/encounter/MonsterCardHelpers.resolve-attack-range.test.js` (verbatim Goblin/Hobgoblin bestiary bytes + lenient-null pins). `src/services/rules/combat` + `src/components/encounter` + `src/services/combat/conditions` + automation/ui consumer folders: 3423 then 7455 tests green; `npm run lint` zero warnings; full `npm run test:run` green (3457 files / 36,811 tests, EXIT 0).
- Exit: both sandbox maps deleted (ghost-404 proved), `test-campaign` admin-cleared to baseline (`change-data {}`, `log []`, active-map null, maps = the 4 owner fixtures).

## Summary
Monster-chip ranged attacks enforced fabricated range bands: actions without a structured `range` field (42 bestiary rows incl. Goblin Shortbow, Hobgoblin Longbow) were measured against an invented 30/60 ft band, and the 79 authored dual-notation ranges ("80/320 ft.") never parsed at all, so real bands were never applied. `rangeToFeet`/new `rangePairToFeet` now parse dual notation to the true `{normal, long}` pair, `computeRangeEffect` adjudicates against the authored long figure (single values keep the RAW ×2 model), and the monster-card lane derives range reach → range → authored prose, staying LENIENT (never a fabricated band) when nothing is derivable. Live-proved both bug faces gone on a tokenized map (35/65 ft Shortbow normal, 170 ft Longbow disadvantage-not-auto-miss, 665 ft Longbow auto-missing at the real 600 figure) with adjacent melee/melee-hit lanes intact; two new regression suites + touched-area runs + lint green.
