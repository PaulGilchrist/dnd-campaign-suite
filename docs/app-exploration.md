# App Exploration Map

**FRESHLY FOLDED 2026-10-30** (end of the post-AO improve run). The FULL prior map — every live-claim section for runs S–AO (cycle proofs, rig notes, final states, Coverage table, Reliable Selectors, Known Quirks) — moved intact to `docs/app-exploration-archive-2026-10-30.md` (older depth: `docs/app-exploration-archive-2026-10.md`). **Per-section details below are claims carried from that fold and are *(carried — unverified)*: they MUST be re-derived live before being trusted; do not cite the archive as live proof.** Durable mechanics/rigs/fingerprints (NOT subject to staleness): `docs/test-setup-playbook.md` — the 2026-10-30 improve-run appends (sanitize-at-sink canon, wildcard-DELETE 404 convention + API-child restart recipe, unicode-kebab CONFIRMED row, 3D no-reframe CONFIRMED row) are this fold's terminal ledger.

**Freshness rule:** before trusting a Coverage row for an area you ENTER, `git log --since="<row date>" --oneline -- <row's source paths>`; commits the row doesn't account for ⇒ demote to *(stale — re-verify)* and re-derive live. Untouched areas stay valid (event-driven, not calendar-driven).

**Fold gate (owner doctrine, 2026-10-29 hardening):** a fold requires ALL of — (1) the Improvement backlog is empty; (2) the Coverage table has ZERO not-explored/shallow/medium rows (an `n/a` row is exempt only with an explicit owner ruling, currently just Rules); (3) the Blocked/Deepen-Targets section is empty — every row CLOSED-fix, CLOSED-ruling, or walked deep; nothing silently dropped; (4) the last explore run ends declaring **no deepening remains** with a per-area list of what deeper it could still go; (5) at least one full `e2e-explore` cycle has descended the map since it was written. Never fold the map you just deepened. *(This fold: all five met at run AO + the 2026-10-30 improve run closed the backlog (d6c78c244, 08ba721b7) and both named residual edges (unicode kebab lane CONFIRMED safe; 3D same-grid no-reframe CONFIRMED cosmetic/UI-unreachable — playbook rows).)*

**qa-temp exception (owner ruling, 2026-10-29):** exactly ONE throwaway campaign named `qa-temp` may be created, exercised, and deleted — solely to deepen the Campaigns-select lane and cross-campaign seams a single locked campaign can never prove. All other campaigns remain PRODUCTION. While `CAMPAIGN_LOCK` is set, `POST /api/campaigns` is 403'd at lock phase 1 — qa-temp legs require a bounded UNLOCKED API boot per the playbook recipe.

## Priority Targets (deepen-first, all *(carried — unverified)* — re-derive live)

1. **Post-improve delta re-verification (the whole point of the next descent):** commits since run AO touch six lanes whose Coverage rows are now event-stale —
   - `d6c78c244` (4 log description sinks + new test) → **Log view** row: re-derive description rendering live (automation rows still render bold/italic markup; a stored raw-HTML description renders inert text).
   - `08ba721b7` (wildcard DELETE 404 + `AiRefereeSection` 404=success) → **Admin / AI-director + every change-data DELETE client lane**: re-probe live-key 200 + null-echo and absent-key 404 faces; sweep client DELETE call-sites for any new lanes.
   - `732633591` (exhausted-banner copy gate) → **Hex travel** row (AO proved all three faces — one cycle of independent re-entry is cheap insurance that harness pins elsewhere match the new max-EX copy `…camp to rest.`).
   - `2167f86ac` / `8e475ad21` / `f1a9f11f8` / `44216917e` / `a39455951` era claims (interlock matrix, ruler/spell `aria-pressed`, `0 ft (0 cells)`, singular Clear All) → **Map tools** + **Spell overlays** rows: AN proved these all-faces; re-confirm spot-faces post-fold rather than trusting the archive.
2. **Carry-up of the AO-era AO/AN/AM fingerprints that live only in the archive's Known Quirks** — re-derive the high-value harness mechanics on first entry into each area (MCP result-drop class, phantom-advance synthetic-click artifact, absorbed-first-click family, fetch-spy layering, `:text-is` 30s default, md5 discipline recipe). The playbook holds the durable versions; the map must re-earn its own rows.
3. **Anything the next explore pass finds shallow on contact** — the fold deliberately carries NO known-shallow rows (table below is fully deep at fold time), so descent is purely re-verification + new-surface hunting (features merged after 2026-10-30).

## Depth Seeds (claims to beat, all *(carried — unverified)*)

- Deepest prior achievements, each a floor to re-prove or exceed: full-legit exhaustion 0→6 grind (6 earned FM presses, 13/13 buckets, LR −1 drain live, AN); 10/10 tool mutual-exclusion matrix (AN); five-shape spell-overlay geometry + disk lane + boot rehydration (AK–AL); 135-key AI referee prompt audit on a fake-model recorder (AI); qa-temp cross-campaign stale-adjudicator pass (AH); six/six `.ct-*` cross-tab mirror lanes (W); concentration per-promptId multi-hit stack (AA/Z); death-save full ladder both seams (AG).
- Harness ceilings accepted by owner (do NOT re-litigate): audible loudness state (CLOSED-ruling), redirect next-swing semantics = the contract (ruling (a)), in-3D no-reframe cosmetic (CONFIRMED this fold), innerText artifact classes (`8d20`, blank-HP, `…` truncation) — see playbook.

## Coverage (skeleton, all rows *(carried — unverified)* — statuses as of the 2026-10-30 fold; re-derive live per the freshness rule)

| Feature/Flow | Depth | Notes |
|---|---|---|
| Maps list/view/editor | deep *(carried — unverified)* | name-sanitization class fully mapped (empty-kebab FIXED a70be340b; unicode NFC/NFD CONFIRMED safe this run); POI-enter, load-notice, 3D first walk all deep |
| Spell overlays (indoor AoE lane) | deep *(carried — unverified)* | geometry/DNS-transport/disk/LAN/3D-compositing all walked; 0 open bugs at fold |
| Map tools — interlocks & Ruler | deep *(carried — unverified)* | 10-pair matrix, ruler math machine-exact, zero-write purity |
| Hex travel / sessions-phase | deep *(carried — unverified)* | exhaustion grind CLOSED, banner-copy gate proven 3 faces; pins at max EX = `…camp to rest.` |
| View error boundary | deep *(carried — unverified)* | outlet + per-map seams closed; Reload = in-place reset |
| Fog of war | deep *(carried — unverified)* | prune + merge + monotonic growth re-proven AO throwaway rig |
| SSE sync | deep *(carried — unverified)* | six `.ct-*` lanes + combat lanes; boardVersion guard lane |
| Short/Long Rest | deep *(carried — unverified)* | staged rolls, AR refuse, memorize latch |
| Death saving throws | deep *(carried — unverified)* | modal ladder both seams, RAW stabilization |
| EffectAdder | deep *(carried — unverified)* | suppression notice, token-AND search, DC defaults |
| Factions / Notes | deep *(carried — unverified)* | two-tab conflicts, named guards |
| Quests CRUD | deep *(carried — unverified)* | conflict ladder, loading/empty quad |
| NPCs CRUD | deep *(carried — unverified)* | conflict + guard lanes |
| Dice tray / sheet rolls | deep *(carried — unverified)* | popup lanes |
| Log view | deep *(carried — unverified)* | composer aria, filters AND-logic; **STALE post-d6c78c244 — sink sanitization un-rewalked** |
| Campaign download/upload + snapshots/rollback/full-reset | deep *(carried — unverified)* | shared `.snapshots` dir, zero-snapshot fail-close |
| Rules | n/a | owner ruling: external dnd-tools tab, zero in-app surface |
| Admin | deep *(carried — unverified)* | clears/rollback/snapshots; **STALE post-08ba721b7 — AI-config DELETE lane** |
| Enforcement blob authority + canonicalize | deep *(carried — unverified)* | |
| Inventory currency + items | deep *(carried — unverified)* | delete rollback, bare-body API |
| Character sheet attacks/rolls | deep *(carried — unverified)* | |
| Enforcement — map lanes | deep *(carried — unverified)* | |
| Campaigns select | deep *(carried — unverified)* | qa-temp lane fully walked (AH) |
| Sessions | deep *(carried — unverified)* | picker cache, reload guard |
| Settlements | deep *(carried — unverified)* | list SSE |
| EB generate / save-load / join | deep *(carried — unverified)* | honest-failure lanes, rename ladder |
| Initiative join/board | deep *(carried — unverified)* | concurrency guard, Clear semantics, redirect lane |
| Loot panel | deep *(carried — unverified)* | defeated-filter, draft persistence |
| Music panel | deep *(carried — unverified)* | ownership transfer, dead-track cap, dirty guard |
| Wizard edit | deep *(carried — unverified)* | |
| Player (non-localhost) view | deep *(carried — unverified)* | authority gates, LAN spell surface post-9b14c5808 |
| Enforcement — AI director lanes | deep *(carried — unverified)* | configured-model descent (AH), registry gates |
| Campaign Builder — Drafts panel | not-explored → explore *(added 2026-10-30, authoring Phase 3)* | `src/components/campaign-builder/, src/services/campaign/draftActions.js, src/components/common/DraftFlag.jsx, server/utils/jsonEntityCrud.js` — server draft-invisibility + approve/reject lanes pinned by unit tests (jsonEntityCrud/encounters/maps drafts suites, CampaignBuilder); live descent owed — test-campaign only |
| AI designer chat / plan / generate | not-explored → explore *(Phase 4)* | `src/components/campaign-builder/AiDesignerSection.jsx, server/routes/ai-designer.js, server/services/ai/authoring/` — route gates + designer funnel pinned by tests; live run needs a configured live aiConfig model (GM localhost, test-campaign) |
| AI refine buttons (NPC/Quest/Faction/Settlement/Session + EB) | not-explored → explore *(Phase 6 + residual item 1, EB wired 2026-10-30)* | `src/components/common/AiRefineButton.jsx, server/services/ai/authoring/refine.js, src/components/encounter/EncounterBuilder.jsx` — proposal-into-form lanes + never-write rule pinned (AiRefineButton suites, refine.test, EncounterBuilder.ai-refine); live: click Refine → proposal → save → 409-on-race |
| AI Dress (MapsManager rows) | not-explored → explore *(residual item 2, 2026-10-30)* | `src/components/maps-manager/AiDressButton.jsx, server/services/ai/authoring/dressMap.js` — op-preview → Apply → normal map PUT lane + draft-flag survival + reject-before-propose pinned (AiDressButton, dressMap, entitySchemas, route-gate suites); live needs a live model |
| Constrained decoding (response_format probe) | not-explored → explore *(residual item 3, 2026-10-30)* | `server/services/ai/providers/localProvider.js` — optimistic-probe/400/chunk-array-fallback + cache pinned in localProvider.test; live proof only against a real llama.cpp-family backend vs an oMLX one |

## Baseline Fingerprints (canonical test-campaign state at fold — re-verify on entry)

- Maps: [Battle Arena `94fcd0bfe9e4cf6e1118f736b920e7a2`, Test Map `8e40779e1768449a4d7d026c6cb4df15`]; `activeMapName:null`; NO `data/spell-overlays.json`.
- npcs [Marta ''], char files 13 (incl. permanent CelestialWarlock fixture), encounters 31, quests/notes/factions/settlements 1 each, sessions [], inventory gp:0 items [], snapshots = 4 shared zips.
- change-data `{}` + log `[]` (GET-verified two-pass from closed-tab quiet at fold); campaign roster 5; dev:locked mode (`server-config {campaignLocked:true,lockedCampaign:"test-campaign"}`).

## Improvement Backlog

*(empty at fold — 2026-10-30 improve run consumed both AO items: `log-description-raw-html-sink-audit` DONE d6c78c244, `changedata-wildcard-false-success-on-missing-key` DONE 08ba721b7; residual edges (unicode kebab, 3D no-reframe) walked CONFIRMED, no code changes, dispositions in `docs/test-setup-playbook.md` improve-run appends + the run summary. New items are appended here by `e2e-explore`.)*

## Blocked / Deepen Targets (fold-gate ledger)

*(EMPTY at fold — OPEN decisions: none pending; deepen targets: none (both named residuals CLOSED-CONFIRMED this run, exhaustion grind CLOSED AN, no-deepening declared AO). Anything the next cycle finds goes here with an actionable recipe.)*
