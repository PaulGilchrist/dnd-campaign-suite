# Log view renders `ai_authoring` and `ai_dress` audit rows as raw JSON blobs

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
