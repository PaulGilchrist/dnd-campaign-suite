# AI Campaign Authoring — Designer, Drafts, Maps, Refine

**Status:** Planned (agreed with owner 2026-10-30)
**Owner rulings baked in:**
- Drafts-until-approved for ALL AI-authored content (blueprint review modal rejected in favour of drafts).
- Drafts are invisible to players at the server level (not just hidden in the UI).
- Drafts keep the existing `updatedAt` concurrent-save protocol (Option B — `status` is just another persisted field; approve = clear-flag PUT through the normal lane, 409-on-race applies).
- Designer chat persists in the campaign folder (`design-notes.json`) and travels with downloads/snapshots.
- Scope is conversational and flexible: full campaign, one-shot, arc extension (e.g. levels 6–10 continuing an existing story), or session prep (e.g. content for session 4).
- Primary author is the SAME configured model as the AI referee (`aiConfig` endpoint/model — works for local and remote providers with no extra config). Minimum target: 256k-context model; the design must still survive output truncation.

## Rejected alternatives (with reasons)

| Option | Verdict |
|---|---|
| AI writes campaign JSON files directly | **Disqualified.** `changeData.js` in-memory cache owns the disk (10s debounce) — external writes are silently clobbered; also bypasses stamps, dedupe/normalization, bestiary guard, SSE, campaign lock, image pipeline. |
| MCP server over the API | Wrong door for this use case — MCP serves *external* chat-app agents. The author lives inside the server process already. (Could be layered on the same API later; out of scope.) |
| Blueprint review modal (approve-per-item before anything lands) | Rejected by owner — want the whole interlinked set visible together in the app, reviewed as a story. |
| Drafts exempt from the concurrent-save stamp protocol (Option A) | Rejected — keep the universal stamp protocol intact; approval races resolve with 409 like any other edit. |
| Model emits full raw map grid JSON | Rejected — token explosion + corruption risk. Generators run in-process; model emits a dressing-plan diff instead. |

## Architecture in one paragraph

All AI writes flow through a new **in-process authoring service** that composes the existing CRUD layer (`jsonEntityCrud` internals, maps/npcs/sessions/settlements lanes) so every guard, stamp, dedupe, snapshot, SSE broadcast and campaign log entry stays live. The model speaks **JSON Schema** (constrained decoding where the backend supports it, server-side validation always). Everything lands as `status: "draft"`, GM-only, badged, reviewable in a new **Campaign Builder panel**; approve = clear-flag PUT; reject = delete through the normal lane. Maps come from the real generators (`src/services/maps/dungeonGenerator.js`, `hexTerrainGenerator.js`) imported directly, then dressed by a deterministic applier executing a model-authored dressing plan.

---

## Phase 1 — JSON Schemas + shared validator

New `server/services/ai/schemas/` (or `public/../server` equivalent — server-side, one source of truth):

- Entity schemas: faction, npc, settlement, quest, encounter, session, map-dressing-plan, blueprint, designer protocol messages (scope declaration, refine request).
- Schema content mirrors the actual shapes persisted by the CRUD lanes (read `public/campaigns/test-campaign/*.json` + route code to derive; include the `status: 'draft' | undefined` field and id/`updatedAt` conventions as optional/derived).
- Referential-integrity validator with **two faces**:
  - *Inward*: blueprint-internal refs (encounter creatures → NPCs in same batch or `monsters.json`; session → encounters; POI → map; quest → faction/NPC names).
  - *Outward*: refs to existing **approved** campaign entities are valid; refs to rejected/deleted prior-batch drafts are invalid; name collisions with existing rows (post-normalization) surface as rename prompts, re-using `nameUniqueness.js` / duplicate-name test conventions.
- Export a validator usable for: server pre-write validation, model retry loop (feed the error back, max 2 attempts, then present raw + errors to GM), and (later) constrained decoding payloads.
- Level-awareness helper: party level range + composition read from character files (PlayerStats is single source of truth) for encounter CR budgets.

**Tests:** schema validity against real campaign fixtures; inward/outward referential legs; collision-detection legs.

## Phase 2 — Authoring service (write path)

`server/services/ai/authoring/`:

- `applyBlueprint(campaign, blueprint, { mode })` — creates every entity **as drafts** through the per-entity create lanes (never whole-array replacements — extension-safe alongside existing rows). Ordering: factions → settlements → npcs → quests → encounters → maps → sessions.
- Pre-apply **snapshot** via existing snapshot machinery; every applied item logged to the campaign log ("AI drafted N entities…"), matching the automation-logging rule.
- No timers anywhere (no-timers guard compliant); all writes server-side (server-first doctrine).
- Respects `CAMPAIGN_LOCK` / dev-locked mode like every other lane.

**Tests:** in `test-campaign` only — full blueprint apply, extension apply alongside existing rows, referential reject, rollback-after-bad-apply.

## Phase 3 — Draft infrastructure + Campaign Builder panel

- `status: 'draft'` field on the seven entity kinds + map records.
- **Server-side player filtering (MANDATORY, single choke point):** extend `jsonEntityCrud` factory with a read transform — non-localhost GETs strip draft rows and SSE list-echoes omit them. Rationale: today only `quests.js`/`maps.js` actively gate reads for LAN clients; factions/npcs/settlements/sessions/encounters routes have NO server-side read gate (client-side authority only). Drafts must not rely on the UI hiding them.
- Maps: a draft map can never become the active map (guard in the active-map lane) — players only ever see activated, approved maps.
- Existing list/editor views: draft badge + inline Approve / Reject buttons (CreatureBadge-style styling; semantic CSS classes, no inline styles).
- New **Campaign Builder panel** (GM/localhost-only view): groups the whole draft set by type with cross-links (quest → encounter → monsters → map room; settlement POI → its dungeon map), plus "what's slated for session N" grouping (`sessionNumber` back-link on planned content). Bulk approve / bulk reject-all. This is where the GM reviews *how it ties together*.
- Approve = clear-flag PUT through the normal lane (stamp protocol applies; concurrent edits 409 → reload → re-approve).

**Tests:** draft-filter lane sweep (every GET + SSE list channel, both authority faces), approve/reject through stamp guards, active-map draft guard, panel CRUD.

## Phase 4 — Designer chat + scoped generation

Endpoints (all: `isGM` + `aiConfigLive` gates, mirroring `campaigns-ai.js`):

- `POST /api/campaigns/:campaign/ai/designer` — multi-turn chat. Conversation persisted to `design-notes.json` in the campaign folder (travels with snapshots/downloads). Supports the three conversation shapes: brand-new campaign/one-shot, arc extension (e.g. "continue 6–10"), session prep ("I need session 4").
- **Scope artifact** emitted before any generation, GM-confirmable/editable:
  `{ scope: 'campaign'|'one_shot'|'arc'|'session'|'bespoke', levels?, sessionNumber?, entityPlan: [{kind, count, notes}] }`
  The GM edits/confirms the plan before generation starts so a misread request is caught cheaply.
- **World-context ingestion (the core feature for extensions):** reuse + deepen `server/services/ai/worldContext.js` `loadWorldState` into a full story-bible assembly — all approved entities with quest status (completed/abandoned/dangling threads), party state from character files, session outcomes, log recap, plus prior `design-notes.json`. One world-context module feeds referee AND designer.
- **Generation orchestration:** whole-scope generation in ONE schema-constrained call with the full story bible (owner requirement: single model holds the whole narrative). On output truncation (max-tokens wall — expected for full campaigns), resume entity-by-entity **with the same story bible in context** — truncation recovery, not piecemeal design. Each emitted entity validated (Phase 1); failures retry ≤2 then surface to GM.
- `POST /api/campaigns/:campaign/ai/designer/generate` — executes the confirmed scope plan → `applyBlueprint` (drafts) → results summary back to chat ("created 4 drafts, 2 rename conflicts resolved").

**Tests:** scope-emit/confirm flow, truncation-resume (fake-model recorder rig exists from AI-director test era), context ingestion against test-campaign fixtures.

## Phase 5 — Map pipeline (+ drive-by fix)

- **Fix stale root CLIs:** `hex-terrain-generator.mjs` / `dungeon-generator.mjs` import `./src/services/...` but the modules moved to `src/services/maps/` — repair import paths.
- New `authoring/maps.js`: calls `generateHexTerrain` / `generateDungeon` / `generateAdjacentDungeon` **in-process** with model-chosen params (gridSize, density, seed, weights).
- Model emits a schema-constrained **dressing plan** (never raw grid JSON):
  - add/move/delete `placedItems` (traps, chests, doors, furniture) on a generated dungeon
  - POIs with coordinates on hex maps (settlements, dungeon entrances anchored to sensible terrain)
  - map-to-map links (settlement/hex POI → its indoor/dungeon map)
  - encounter monster token placement into chosen rooms/locations
- Deterministic applier mutates the generated map object → written through the maps lane as a **draft map**. Verify generator output shape against the maps route's expected record (layers/fog/image fields default correctly); fixture-test it.
- Refine applies to maps too ("add a trapped chest in the throne room") via the dressing-plan subset of the refine schema.

**Tests:** applier unit tests on committed generator fixtures (seeded = deterministic), link legs, draft-map-never-activatable, dressing-plan validation failures.

## Phase 6 — Per-entity AI refine ("AI button")

- `PUT /api/campaigns/:campaign/ai/refine/:kind/:id` `{ instruction }` — GM-only, aiConfigLive-gated.
- Loads current entity JSON + its schema + relevant world context; model returns the **complete replacement entity** (not JSON-patch — more robust across local backends); Phase-1 validation + retry loop.
- Applies through the normal PUT lane → the `updatedAt` guard protects against clobbering manual GM edits automatically.
- Suggest/enforce parity with the referee: `suggest` mode returns a proposal diff for GM confirm; auto mode applies and logs.
- AI button wired into each `.ct-*` editor (npc/quest/faction/settlement/session/encounter) + map dressing.

**Tests:** refine happy/conflict/validation-fail legs per kind; suggest-mode proposal never writes.

## Phase 7 — Cross-cutting verification

- `npm run lint` (zero warnings), `npm run test:run`, `node .opencode/plans/no-timers-guard.mjs`.
- Draft-filter sweep as an explicit checklist against every read/SSE lane (this is the leak risk worth the most attention).
- Update `docs/app-exploration.md` Coverage with the new surfaces (Campaign Builder, designer chat, refine buttons) as fresh rows — explore-rig territory for a later e2e run, not this implementation.
- ESLint server-first rules respected (no localStorage game state in new frontends; `useSyncedState` for UI state that syncs).

## Sequencing & dependencies

1 → 2 → 3 are the spine (schemas, write path, drafts). 4 depends on 2+3 (and deepens worldContext). 5 depends on 1+2+3. 6 depends on 1+3. 7 continuous. Phases 4/5/6 can parallelize once the spine lands.

## Out of scope (explicit)

- Image generation for map art / portraits (future companion; POI/structure only here).
- External-agent MCP.
- Player-visible draft affordances of any kind.
- Rules content generation (spells/feats/monsters into `public/data/` — rules data is authored data, not campaign runtime data).
