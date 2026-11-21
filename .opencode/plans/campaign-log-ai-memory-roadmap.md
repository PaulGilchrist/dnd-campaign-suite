# Campaign Log — AI Memory Roadmap (deferred vision)

Origin: owner vision 2026-11-21 — "AI uses the campaign log as memory and posts a
write-up / enthralling story of what happened during each session." Narrative rows
are as important as combat rows. Phase 1 (author authority) + memory prep steps
(narrative renderer, session stamping, unbounded disk log) shipped in the same
session; the items below are the deferred next steps. Full design context:
`~/.opencode/plan/campaign-log-authority-and-ai-memory.md`.

## 8. Session recap generator (AI writes the session story)

- New allowlisted log type `session_recap` (+ rich renderer — reuse
  `LogNarrativeEntry.jsx` with a recap title/flag).
- GM-only endpoint `POST /api/campaigns/:c/ai/recap { session }` (localhost gate,
  mirrors `campaigns-ai.js` `isGM`):
  - gathers rows filtered to `session === <name>` via the `session` stamp;
  - compacts each row through `getEntryText` + key structured fields
    (attacker/target/damage/outcome), token-budgeted — narrative/encounter/
    milestone rows prioritized over per-roll noise;
  - sends to the existing provider service (`server/services/ai/providers`) with
    a "write an enthralling session narrative, grounded ONLY in these log rows"
    prompt (same grounding law as the world-keeper recap kind);
  - posts the result as a `session_recap` row authored `GM` server-side.
- UI: "Write recap" button on the Sessions card (GM only); expand/collapse row in
  the log.
- Constraints: bounded AI fetch timeouts only (No-Game-Timers / no-forever-waits).

## 9. Memory-in: story-so-far in AI prompts

- `server/services/ai/promptBuilder.js` feeds change-data state only today. Add a
  "Story so far" section: last ~40 `narrative`/`note`/`session_recap`/`encounter`
  rows via `getEntryText`, newest-last, ~1500 chars cap. Applies to referee,
  world-keeper, and director prompts so AI narration carries continuity.
- Longer term: recap rows become the compressed memory — feed recaps for old
  sessions + raw rows for the current one (hierarchical memory) instead of raw
  history.

## 10. Later ideas (captured, not scheduled)

- Export endpoint (`GET /api/campaigns/:c/log?session=&type=` → markdown/JSON)
  for external LLM tooling.
- Session filter facet in the log toolbar (`filterLogEntries` facet + option
  census derived from data, never hardcoded).
- Roster/creature verification for GM-origin manual rows (currently
  trust-the-GM by design).
- Log archival/rotation policy once disk history grows (persist is unbounded as
  of the session-stamp change; GET stays windowed at 500).
