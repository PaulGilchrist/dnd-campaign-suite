# Campaign Log / AI Memory — Roadmap (deferred ideas only)

> Distilled 2026-11-22 from `.opencode/plans/campaign-log-authority-and-ai-memory.md`
> (the source plan was **fully implemented and deleted**):
> - Phase 1 author authority — shipped (`server/utils/gmGuard.js`, author gate in `server/routes/log.js`, client dropdown by origin).
> - §5 NarrativeEntry renderer — shipped (`LogNarrativeEntry.jsx`, registered in `entryComponents.js`).
> - §6 session stamping — shipped (server-side stamp in `addEntry`; rows outside a tracked session carry `session: null`).
> - §7 unbounded disk log — shipped (only the GET window caps at 500).
> - §8 recap generation — shipped via the World Keeper lane (`server/services/ai/recapContext.js`, recap endpoints in `campaigns-ai.js`).
> - §9 story-so-far memory injection — shipped (`server/services/ai/promptBuilder.js` "Story so far" block; `storyMemory.js`).

## Remaining ideas (capture, don't build without owner go-ahead)

1. **Export endpoint** — `GET /api/campaigns/:c/log?session=&type=` returning markdown/JSON for external LLM tooling or print.
2. **Session filter facet** in the log toolbar (the `session` field on every row already makes this a pure client-side facet).
3. **GM-origin author verification** — manual GM rows currently trust the GM lane; a stricter build could verify creature names against the live `combatSummary`.
4. **Log archival/rotation policy** — disk is intentionally unbounded today (file-growth estimate commented in `log.js`); revisit if campaigns outgrow it.
5. **Hierarchical memory** — feed recap rows for old sessions + raw rows only for the current one, instead of raw history, once recaps are a routine habit (today's "Story so far" block takes newest N rows across types).
