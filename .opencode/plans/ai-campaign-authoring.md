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

## Phase 1 — JSON Schemas + shared validator ✅ DONE (2026-10-30)

**Shipped in `server/services/ai/authoring/`:** `schemaValidator.js` (import-free JSON-Schema-subset validator, fail-closed `{ok,errors}` per the `../schemas.js` convention, throws on unsupported keywords), `entitySchemas.js` (all seven entity kinds + mapPlan/scope/blueprint as JSON Schema DATA usable for constrained decoding; `validateEntity`/`validateBlueprintShape`), `referential.js` (`buildCampaignContext` + inward/outward reference checks incl. bestiary guard, monster index/name pairs, collision rename-prompts), `party.js` (`readParty`/`partyLevelRange`). 29 tests, lint-clean, no-timers guard OK.

**Implementation deviations (ruled during build):**
- Draft flag is a separate **`draft: true`** field, NOT `status: "draft"` — quests already own `status: active|completed|failed` and sessions `planned|played`. Approve = strip the field.
- Schemas live in `server/services/ai/authoring/` (not a separate `schemas/` dir) so the authoring service, its schemas, and its tests stay co-located per project convention.
- Authoring rows forbid server/GM-owned fields by `additionalProperties:false` (id, updatedAt, image/imageName/imagePath, effectiveXP).
- Map plans (Phase 5 contract) shipped early since they're pure schema work: generator params + dressing ops only, raw grid JSON rejected.

Original phase notes:

New `server/services/ai/schemas/` (or `public/../server` equivalent — server-side, one source of truth):

- Entity schemas: faction, npc, settlement, quest, encounter, session, map-dressing-plan, blueprint, designer protocol messages (scope declaration, refine request).
- Schema content mirrors the actual shapes persisted by the CRUD lanes (read `public/campaigns/test-campaign/*.json` + route code to derive; include the `status: 'draft' | undefined` field and id/`updatedAt` conventions as optional/derived).
- Referential-integrity validator with **two faces**:
  - *Inward*: blueprint-internal refs (encounter creatures → NPCs in same batch or `monsters.json`; session → encounters; POI → map; quest → faction/NPC names).
  - *Outward*: refs to existing **approved** campaign entities are valid; refs to rejected/deleted prior-batch drafts are invalid; name collisions with existing rows (post-normalization) surface as rename prompts, re-using `nameUniqueness.js` / duplicate-name test conventions.
- Export a validator usable for: server pre-write validation, model retry loop (feed the error back, max 2 attempts, then present raw + errors to GM), and (later) constrained decoding payloads.
- Level-awareness helper: party level range + composition read from character files (PlayerStats is single source of truth) for encounter CR budgets.

**Tests:** schema validity against real campaign fixtures; inward/outward referential legs; collision-detection legs.

## Phase 2 — Authoring service (write path) ✅ DONE (2026-10-30)

**Shipped:**
- `server/utils/campaignSnapshots.js` — `createSnapshot`/`listSnapshotFiles`/`pruneSnapshots`/`SNAPSHOT_RETENTION` extracted verbatim from `campaigns-admin.js` (which now imports them — zero duplication, byte-identical behavior).
- `server/utils/jsonEntityCrud.js` — `entityDataFile`/`loadEntityList`/`saveEntityList` hoisted to module exports; the factory itself re-points at them (lane semantics cannot drift from the service's).
- `server/services/ai/authoring/apply.js` — `applyBlueprint(campaign, blueprint, {snapshot, context, log})`: full validation gate (shape per-row + inward/outward refs) BEFORE any byte is written; pre-apply snapshot; drafts force-stamped `draft:true`; uuid for id-bearing kinds, name-keyed appends for npcs/settlements/sessions; builder-preset encounters through `encounterUtils`; the exact `*-list-<campaign>` SSE channels; one `ai_authoring` log entry; mid-batch failure reports the restore point.
- `apply.test.js` — 8 tests (gate blocks snapshot/writes; draft force-stamp; id conventions; channel parity; mid-batch recovery). Full suite green: 2950 files / 32.5k tests.

**Deferred by design:** `mapPlans` count returned as `pendingMaps` (Phase 5 applies them); approve/reject lanes are Phase 3.


`server/services/ai/authoring/`:

- `applyBlueprint(campaign, blueprint, { mode })` — creates every entity **as drafts** through the per-entity create lanes (never whole-array replacements — extension-safe alongside existing rows). Ordering: factions → settlements → npcs → quests → encounters → maps → sessions.
- Pre-apply **snapshot** via existing snapshot machinery; every applied item logged to the campaign log ("AI drafted N entities…"), matching the automation-logging rule.
- No timers anywhere (no-timers guard compliant); all writes server-side (server-first doctrine).
- Respects `CAMPAIGN_LOCK` / dev-locked mode like every other lane.

**Tests:** in `test-campaign` only — full blueprint apply, extension apply alongside existing rows, referential reject, rollback-after-bad-apply.

## Phase 3 — Draft infrastructure + Campaign Builder panel ✅ DONE (2026-10-30)

**Shipped (server — player invisibility is structural, not UI convention):**
- `jsonEntityCrud.js`: `isLocalHost`/`hideDraftsFromPlayers` at the factory choke point — non-GM list GETs omit draft rows, single GETs answer the same 404 an absent row gives (existence unconfirmable). Covers quests/factions/notes/npcs/settlements/sessions.
- `encounters.js`: list omits drafts for LAN; by-name draft fetch 404s; list rows carry `draft` for the GM badge.
- `maps.js`: list omits draft maps for LAN; draft document 404s to non-GM; **activate refuses a draft map (409) even for the GM** — approve first.
- Tests: `jsonEntityCrud.drafts.test.js` (4), `encounters-drafts.test.js` (2), `maps-drafts.test.js` (4) — both authority faces each.

**Shipped (client):**
- `src/services/campaign/draftActions.js` — `loadDrafts` (all seven kinds grouped), `approveDraft` (same-lane save with the flag stripped; uuid-array kinds re-read the fresh list first), `rejectDraft` (normal delete lanes). **No new server endpoints** — approval rides the stamp protocol (Option B).
- `src/components/campaign-builder/CampaignBuilder.jsx` + CSS — GM review hub: per-kind sections, story-tie chips (encounter→monsters, settlement→NPCs, session→links), per-row Approve/Reject, per-kind + global Approve-all (sequential to respect whole-array concurrency), error banner, empty state. Registered as sidebar view **"Drafts"** (alphabetical nav test pinned the label placement), GM-only (`localhostOnly`).
- `src/components/common/DraftFlag.jsx` + global `.ct-draft-flag` — one shared badge, wired into Quests/Factions/NPCListItem/Settlements/SessionListItem/MapsManager rows. Manual save-in-editor doubles as approval (the form round-trip drops fields it doesn't carry… note: array-kind editors spread `draft` through, so the Builder stays the canonical approve surface).
- Tests: `draftActions.test.js` (7) + `CampaignBuilder.test.jsx` (5, incl. a caught real bug: first-load failure used to sit in "Loading…" forever) + badge tests appended to SessionListItem/NPCListItem suites. Targeted sweep: 226 files / 3163 tests green.

Phase 3 original scope notes:

- `status: 'draft'` field on the seven entity kinds + map records.
- **Server-side player filtering (MANDATORY, single choke point):** extend `jsonEntityCrud` factory with a read transform — non-localhost GETs strip draft rows and SSE list-echoes omit them. Rationale: today only `quests.js`/`maps.js` actively gate reads for LAN clients; factions/npcs/settlements/sessions/encounters routes have NO server-side read gate (client-side authority only). Drafts must not rely on the UI hiding them.
- Maps: a draft map can never become the active map (guard in the active-map lane) — players only ever see activated, approved maps.
- Existing list/editor views: draft badge + inline Approve / Reject buttons (CreatureBadge-style styling; semantic CSS classes, no inline styles).
- New **Campaign Builder panel** (GM/localhost-only view): groups the whole draft set by type with cross-links (quest → encounter → monsters → map room; settlement POI → its dungeon map), plus "what's slated for session N" grouping (`sessionNumber` back-link on planned content). Bulk approve / bulk reject-all. This is where the GM reviews *how it ties together*.
- Approve = clear-flag PUT through the normal lane (stamp protocol applies; concurrent edits 409 → reload → re-approve).

**Tests:** draft-filter lane sweep (every GET + SSE list channel, both authority faces), approve/reject through stamp guards, active-map draft guard, panel CRUD.

## Phase 4 — Designer chat + scoped generation ✅ DONE (2026-10-30)

**Shipped (server, `server/services/ai/authoring/`):**
- `storyBible.js` — `buildStoryBible(campaign,{root,notes})`: approved-only canon (drafts excluded), party from character files, quests bucketed active/completed/failed (dangling-thread aware), sessions with outcomes, maps, encounters, recent log, prior design intent. `monsterMenu({minCr,maxCr})` — CR-banded real index/name pairs (bestiary `challenge_rating` is a STRING — parsed numerically).
- `designNotes.js` — conversation ledger at `data/design-notes.json` (campaign folder → travels with snapshots/downloads per owner ruling); 200-message bound, plans capped at 10.
- `designerPrompts.js` — DESIGNER (prose-only chat, ≤3 questions, never writes), PLAN (JSON scope), BLUEPRINT (whole-set emit: 7 hard rules incl. name-collision allowlist, bestiary-menu-only monster refs, no server-owned fields, coherence + CR-to-party), REPAIR (error-feedback retry message), SINGLE-ENTITY (truncation-resume: full spine + finished siblings in context). `KIND_FIELD_RULES` map is the single shape-text source.
- `designer.js` — `designChat` (persists thread), `proposePlan` (jsonMode, ≤2 attempts, records plan + storySummary), `generateBlueprint` (whole-set one-shot → repair retry → **per-entity resume in dependency order** → one `applyBlueprint` call → drafts+snapshot+SSE+log). Failures return honest `AI_NEEDS_HUMAN` with model-actionable errors. Same funnel/audit conventions as referee/director (`ai_designer` log entries).
- `server/routes/ai-designer.js` + mounted in `server.js` after campaignsAi: `POST .../ai/designer/chat|plan|generate`, `GET .../ai/designer/conversation` — all `isGM` + `aiConfigLive` gated (403 off = zero traffic for non-AI campaigns).
- Tests: `storyBible.test.js` (5), `designer.test.js` (8 — incl. whole-set, repair-feedback, truncation→resume of 2 factions, entity-failure refusal), `ai-designer.test.js` (4 authority-gate lanes).

**Shipped (client):** `aiClient.js` designer transport (4 functions); `campaign-builder/AiDesignerSection.jsx`+CSS — status probe → chat thread (persisted history), Propose-build-plan → editable PlanEditor (scope/levels/story spine/per-kind counts) → Generate drafts → result with restore-point filename; AI-off points to Admin config. Embedded above the review sections; `onGenerated` refreshes the draft lists. Tests: 4 lanes.

**Deviation:** approval is implicit in the review panel (per plan); the designer never gates on suggest/autopilot mode — the DRAFT state itself is the confirmation gate for authoring.

Phase 4 original scope notes:

Endpoints (all: `isGM` + `aiConfigLive` gates, mirroring `campaigns-ai.js`):

- `POST /api/campaigns/:campaign/ai/designer` — multi-turn chat. Conversation persisted to `design-notes.json` in the campaign folder (travels with snapshots/downloads). Supports the three conversation shapes: brand-new campaign/one-shot, arc extension (e.g. "continue 6–10"), session prep ("I need session 4").
- **Scope artifact** emitted before any generation, GM-confirmable/editable:
  `{ scope: 'campaign'|'one_shot'|'arc'|'session'|'bespoke', levels?, sessionNumber?, entityPlan: [{kind, count, notes}] }`
  The GM edits/confirms the plan before generation starts so a misread request is caught cheaply.
- **World-context ingestion (the core feature for extensions):** reuse + deepen `server/services/ai/worldContext.js` `loadWorldState` into a full story-bible assembly — all approved entities with quest status (completed/abandoned/dangling threads), party state from character files, session outcomes, log recap, plus prior `design-notes.json`. One world-context module feeds referee AND designer.
- **Generation orchestration:** whole-scope generation in ONE schema-constrained call with the full story bible (owner requirement: single model holds the whole narrative). On output truncation (max-tokens wall — expected for full campaigns), resume entity-by-entity **with the same story bible in context** — truncation recovery, not piecemeal design. Each emitted entity validated (Phase 1); failures retry ≤2 then surface to GM.
- `POST /api/campaigns/:campaign/ai/designer/generate` — executes the confirmed scope plan → `applyBlueprint` (drafts) → results summary back to chat ("created 4 drafts, 2 rename conflicts resolved").

**Tests:** scope-emit/confirm flow, truncation-resume (fake-model recorder rig exists from AI-director test era), context ingestion against test-campaign fixtures.

## Phase 5 — Map pipeline (+ drive-by CLI fix) ✅ DONE (2026-10-30)

**Shipped:**
- Fixed both stale root CLI shims (`dungeon-generator.mjs`, `hex-terrain-generator.mjs`) — import paths repaired to `./src/services/maps/*` (both run).
- `server/services/ai/authoring/applyMaps.js` — in-process `generateDungeon`/`generateHexTerrain` with model-chosen params; deterministic applier for the schema-constrained dressing plan: POIs (q/r + linkedMap on hex, gridX/gridY indoor), placedItemOps add/remove/move (dungeon-only), encounter-monster tokens onto the `items[]` lane. Bounds derived from the REAL generated document (hex grids are q 0..2N-1 × r 0..N-1, NOT square — discovered from the generator and pinned in tests). All-or-nothing: any error (out-of-bounds, stale itemIndex, dungeon-only op on hex) aborts before a single file lands. Writes `{...doc, draft:true}` + `maps-list-<campaign>` 'created' broadcast, mirroring POST /maps.
- Wired into `applyBlueprint.writeDrafts` → `created.maps`; the obsolete `pendingMaps` field removed across apply/designer/UI.
- `applyMaps.test.js` (5): dungeon dress + draft + create-lane broadcast parity, seed determinism, out-of-bounds & stale-index & hex-only rejections (all before write), hex q/r + linkedMap + terrain-cell count.
- Draft maps already ride the Phase 3 invisibility + unactivatable seams — no new gating needed.

Phase 5 original scope notes:

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

## Phase 6 — Per-entity AI refine ✅ DONE (2026-10-30)

**Shipped:**
- `server/services/ai/authoring/refine.js` — `refineEntity(campaign, kind, entity, instruction)`: preflight gates (config/kind/entity/instruction + input shape with server fields stripped) BEFORE any model call; whole-object replacement (never patches — robust across local backends); schema + outward-ref validation with ≤2 repair retries; **self-name collision waived** (refining the row that owns the name is legal) while collisions with other live rows and fabricated monster refs fail closed; `ai_refine` audit. **Never writes** — Principle 3: the proposal returns to the editor, and the GM's normal save (with their echoed stamp) is the only path to disk, so concurrent-tab 409s keep protecting manual edits.
- `POST /api/campaigns/:campaign/ai/refine/:kind` on the ai-designer router (GM + aiConfigLive gated).
- `src/services/ai/aiClient.js` `refineEntity` transport; `src/components/common/AiRefineButton.jsx`+CSS+tests (3) — inline instruction row → replacement into the editor's form state, errors inline, nothing saved.
- Button wired into **NPC, Quest, Faction, Settlement, Session** editor modals (5 kinds; both name-keyed and uuid-array write patterns proven). Encounter (EB is its own editor surface) and map-dressing refine ride the same service but stay unwired — deliberate residual, server-supported.

## Phase 7 — Cross-cutting verification ✅ DONE (2961 files / 32.5k+ tests green at each phase boundary; lint 0; no-timers OK)

## Residuals / follow-ups (known, not dropped)
- Encounter-builder + map-dressing AI buttons (service-ready).
- Player conformance: draft filtering verified at every server read lane by tests; explore-run e2e descent of the new surfaces (Drafts panel, designer, refine buttons) left for the next `e2e-explore` cycle per the exploration-map doctrine; Coverage rows to be added then.
- Constrained decoding (`response_format json_schema` pass-through) for backends that support it — prompt-level JSON enforcement only today (provider bodies already split per-shape in localProvider).
- Refine mode deviation from original scope (accepted): rather than suggest-vs-autopilot-apply, refine ALWAYS proposes (returns the replacement to the form) — the GM's own save button is the confirm step in every mode, which is a strictly safer reading of Principle 3 for authored content.

(Phase 1–6 original planning notes retained below for provenance.)

## Original scope notes

## Phase 6 (original)

- `PUT /api/campaigns/:campaign/ai/refine/:kind/:id` `{ instruction }` — GM-only, aiConfigLive-gated.
- Loads current entity JSON + its schema + relevant world context; model returns the **complete replacement entity** (not JSON-patch — more robust across local backends); Phase-1 validation + retry loop.
- Applies through the normal PUT lane → the `updatedAt` guard protects against clobbering manual GM edits automatically.
- Suggest/enforce parity with the referee: `suggest` mode returns a proposal diff for GM confirm; auto mode applies and logs.
- AI button wired into each `.ct-*` editor (npc/quest/faction/settlement/session/encounter) + map dressing.

**Tests:** refine happy/conflict/validation-fail legs per kind; suggest-mode proposal never writes.

## Phase 7 (original)

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
