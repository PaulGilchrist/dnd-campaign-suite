# Log view renders `ai_authoring` and `ai_dress` audit rows as raw JSON blobs

## Summary
The Log view's `ENTRY_COMPONENTS` map registered `ai_designer`/`ai_refine`/`ai_world`/`ai_world_applied` but not the `ai_authoring` rows written by `applyBlueprint` (success + failMidBatch shapes) or the `ai_dress` pair (server proposal row + client applied row), so those events rendered as full raw-JSON dumps next to the already-readable sibling rows. Fix: register both types on `AiAuditEntry` and add `describeAuthoring`/`describeDress` describers mirroring the existing `describeDesigner`/`describeRefine` pattern. Regression coverage extended in `LogAiAudit.test.jsx` (32 tests pass; 375 pass across the touched log/maps-manager/authoring folders; lint clean).

## Summary
The 2026-10-31 improve pass (`05973fdf1`, "register ai_designer/ai_refine/ai_world audit rows with readable one-line summaries") missed TWO further AI audit sinks: `applyBlueprint`'s `ai_authoring` entries (written by `server/services/ai/authoring/apply.js` on every successful/partial draft apply) and the AI-Dress pair `ai_dress` (instruction-proposal row + `action:"applied"` row, written by `server/services/ai/authoring/dressMap.js`/`AiDressButton.jsx`). Neither type is registered in the Log view's `ENTRY_COMPONENTS` map, so they render as full raw-JSON dumps next to the already-readable rows of the same events.

## Steps to reproduce
1. In test-campaign, configure AI (Admin → AI Referee, any reachable local endpoint).
2. **ai_authoring:** run AI Designer → chat → "Propose build plan" → set encounters count 1 → "Generate drafts" (any successful draft generation works).
3. **ai_dress:** open a map → toolbar "AI Dress" → give an instruction → "Dress map" → "Apply to map".
4. Open the **Log** view.
5. Scroll to the newest entries.

## Expected behavior
Both rows render readable one-liners. `ai_authoring` carries a `summary` field ("AI drafted 1 entity"), and `formatAiAuditLine()` prefers `entry.summary` verbatim when routed through `AiAuditEntry`; `ai_dress` carries `map`/`instruction`/`ops` scalars the residual summarizer would collapse.

## Actual behavior
The row labeled "AI Authoring" renders the whole entry as raw JSON:
`{"type":"ai_authoring","name":"AI designer","scope":"session","created":{"factions":0,…,"encounters":1,"maps":0},"snapshot":"test-campaign-2026-10-31T22-40-56-044.zip","summary":"AI drafted 1 entity","timestamp":1793486456080}`
Verified live 2026-10-31 (Log view, test-campaign) and in code: `src/components/log/Log.jsx:27` `ENTRY_COMPONENTS` registers `ai_designer`, `ai_refine`, `ai_world`, `ai_world_applied` — but **not** `ai_authoring` — so `LogEntryRenderer` falls back to `GenericEntry`, which dumps the JSON payload.

## Likely location
Confident: `src/components/log/Log.jsx` `ENTRY_COMPONENTS` map (missing `ai_authoring: AiAuditEntry`). Producer: `server/services/ai/authoring/apply.js:114` (`logSuccess`) and `:126` (`failMidBatch` — note this second shape has `error` + `snapshot` and no summary; `formatAiAuditLine`'s residual summarizer handles it, but only if routed to `AiAuditEntry`).

## Suggested fix
Add `ai_authoring: AiAuditEntry` to `ENTRY_COMPONENTS` (and optionally a `describeAuthoring` describer in `log-utils.js` mirroring `describeDesigner` so the counts read "created encounters 1" instead of the plain summary). Extend `LogAiAudit.test.jsx` with an `ai_authoring` case for both the success and failMidBatch shapes.

## Severity
Minor UX issue — data is all present but unhuman-readable, duplicating the adjacent `ai_designer` row; it is the exact defect class the improve pass intended to eliminate.

## Resolution
FIXED 2026-10-31 (subagent run). The diagnosis in this file was correct and confirmed live.

**What was wrong:** exactly as filed — `ENTRY_COMPONENTS` in `src/components/log/Log.jsx` lacked `ai_authoring` and `ai_dress`, so both fell through to `GenericEntry`'s raw-JSON dump. One addition beyond the filed guess: the bug file only registered `ai_authoring`; the `ai_dress` producer (`dressMap.js` audit, both success `attempts≥1` and refusal `attempts:0, ops:0` shapes, plus the client applied row in `AiDressButton.jsx`) needed the same routing (its scalars would have survived via the residual summarizer, but a dedicated describer matches the established pattern and reads better).

**Files changed:**
- `src/components/log/Log.jsx` — registered `ai_authoring: AiAuditEntry` and `ai_dress: AiAuditEntry`.
- `src/components/log/log-utils.js` — added `describeAuthoring` (failMidBatch → "AI authoring stopped — <error> (restore point <snap>)"; legacy no-summary success → scope + "created <counts>" + restore point; the `summary` field still wins verbatim via `formatAiAuditLine`'s direct branch) and `describeDress` (applied → "AI dress applied to <map> N ops"; proposal → "AI dress <map> “<instruction>” — proposed N ops after M attempts"; refusal → "gave up — the model produced no valid ops"). Both registered in `AI_AUDIT_DESCRIBERS`.
- `src/components/log/LogAiAudit.test.jsx` — regression coverage: routing `it.each` cases for both types + 7 content tests (authoring summary-verbatim, failMidBatch, legacy no-summary; dress proposal/refusal/applied/singular-op), payload shapes copied byte-faithfully from the real producers.

**Repro route used:** bounded-AI exception — the five broken shapes (exact producer fields from `apply.js` `logSuccess`/`failMidBatch`, `dressMap.js:245/:304`, `AiDressButton.jsx:125`) were seeded via `POST /api/campaigns/test-campaign/log` alongside a readable `ai_designer` twin. Broken state confirmed in the browser Log view first (all five rows `log-generic` with `{"type":"ai_dress"…}` JSON dumps; designer row readable).

**Verification:** after fix + reload + campaign re-select (header verified `test-campaign`), all six rows rendered `log-ai-audit` one-liners in the browser: "AI drafted 1 entity" / "AI authoring stopped — map plan itemIndex 42 out of bounds for 20x20 grid (restore point …)" / "AI dress battle-arena “add a trapped chest…” — proposed 4 ops after 1 attempt" / "…gave up — the model produced no valid ops" / "AI dress applied to battle-arena 4 ops", with the adjacent `ai_designer` line byte-still-readable. Tests: `LogAiAudit.test.jsx` 32/32; `src/components/log` + `AiDressButton.test.jsx` + `server/services/ai/authoring` 375/375; `npm run lint` zero warnings. Cleanup: change-data cache + campaign log cleared via Admin API (verified `[]`/`{}`); `designer.test.js:138` keys-pinned audit shape and all adjacent producer shapes untouched.
