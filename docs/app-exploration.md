# App Exploration Map

**DESCENT RUN AZ2 — 2026-11-01 (same-day post-AY fold: the two AY bug files' fixes 33b3d0326 + 0fe7d441b and the generator twin 368a03927 all landed before this run).** AZ2 re-derived ALL THREE live and **all PASS — zero new bugs**:
(1) **Token lane CLOSED**: dress add → `placedItems` creature rows (`ai-dress-token-x-y-N`) render in 2D (monster ☠ purple `.monster-circle`, npc initial) with title labels; GM right-click (contextmenu on the group's transparent hit `<rect>`) → Hide/Show/Delete/Rotate + native named confirm `Delete "X" from the map?`; Hide dims circle opacity 0.5 GM-only, `visible:false` persists via autosave, hidden fully INVISIBLE to LAN tab, Show + remove adopt LIVE via map SSE; digest `tokens.rows` now = creature-type placedItems (props stay in `items.rows`), so move/remove cite real ids; remove preview copy names the token ("remove QA AZ2 Marta at 5,5"); `doc.items` stays `[]` (write-dead); **3D pixel-proven**: screenshot contains monster purple (108,52,131) + npc red (192,57,43) pixels on the WebGL canvas (closes AY's honest UNVERIFIED).
(2) **Portal gate CLOSED both directions**: indoor `poi.targetMap` → repair-loop then honest `role=alert` `ops[0] "add poi": poi portals are outdoor-only (party travel is hex-based)`, NO Apply button, modal stays open, zero write; hex `poi.targetMap` → preview copy names the destination ("add portal POI QA AZ2 Gate → battle-arena at 7,2"), applies, `linkedMap:'battle-arena'` persists. Outdoor token-op negative still rejects verbatim; NEW live fact: POI out-of-range gate `lands at (7,2) — outside the map (36 hex cells)` (hex docs have NO `items` key at all — the generator crash's root).
(3) **Generator funnel walked end-to-end UI** (digest-aware fake rig, jsonSchema:true — dress calls arrive with schema name `dress_plan`): chat Send → Propose build plan (gated on ≥1 chat message) → PlanEditor → Generate drafts → Approve → mapPlan `qa-az2-hollow` created; encounter tokens land as `ai-token-<map>-<i>` **monster** rows in `placedItems` (fromEncounter stamped), render on the 2D board, and the NEXT dress digest cites their real ids: move 4,4→3,1 + remove-by-id both persisted (playbook FACT confirmed live). Snapshot-first zip stamped + structured `ai_designer`/`ai_authoring`/`ai_dress` log rows (AR raw-JSON family stays fixed).

**Post-AY improves re-derived live**: indoor toolbar back button reads "Back to maps" (bae625b73 ✓); MapsManager Delete-map confirm is NOW `role=dialog aria-modal="true"` label "Delete Map", initial focus lands on Cancel inside the dialog, buttons Cancel / "Yes, Delete Permanently" (681199249 — AY's "invisible to [role=dialog] probes" note is superseded). Refresh-mid-preview invariant holds: modal + proposed markers drop, nothing persists.

**Freshness rule (unchanged):** before trusting a Coverage row for an area you ENTER, `git log --since="<row date>" --oneline -- <paths>`; commits the row doesn't account for ⇒ re-derive live. AZ2 entered maps/dress/generator because 33b3d0326/0fe7d441b/368a03927/681199249/bae625b73 landed after AY. No commits since the fold touch AiDirectorPanel/applyDirectorIntent (director rows event-clear), fog paint/reveal services (fog row event-clear; useSSESync's token-split change never touched fog/adoption semantics — AZ2 rode map SSE heavily: zero regression), music, world/referee/drafts, factions/quests/log/EB paths.

**qa-temp exception (owner ruling, 2026-10-29):** exactly ONE throwaway campaign named `qa-temp` may be created/exercised/deleted for cross-campaign seams. All other campaigns PRODUCTION. `POST /api/campaigns` 403s while `CAMPAIGN_LOCK` is set.

## Priority Targets (next descent)

1. **Director needs_human Confirm asymmetry** — UNCHANGED since AW live; still owner-adjudication-owed before filing — don't re-prove, adjudicate.
2. **`jsonSchema:true` vs a refusing backend** — STILL owed (unchanged since AQ): no llama.cpp-style refusing backend on this machine.
3. **Fog-of-war deep face** — rows event-clear since AS; no commit touches fog painting/reveal. Descend if one lands.
4. **3D mesh geometry inspection** — color-pixel proof closed at AZ2; per-mesh placement/height (cell px ↔ grid coords of dress tokens in the 3D scene) never pixel-asserted. Only worth it if a 3D bug is suspected.
5. **Rotate menu on dress tokens** — the item menu renders Rotate for dress tokens (seen live) but its effect on creature rows was not exercised (rotation state on a token may be cosmetic-by-design; check `.placed-item` transform handling first).

## Depth Seeds (live 2026-11-01 AZ2 unless noted)

- **Token lane (AZ2, closes AY's bug face):** ALL PASS — see header (1). Selectors: creature groups `g.npc-group[title="<Name>"]`; contextmenu MUST be dispatched on the inner transparent `<rect>` (React synthetic handlers don't fire on ancestor-group dispatch); menu options are SVG `<text>` Hide/Show/Delete/Rotate/✕ via dispatchEvent; hidden dim = `.npc-circle` opacity 0.5 (POIs dim `use` 0.4 — different values, both GM-only); token-delete confirm = NATIVE window.confirm (not the MapsManager-style role=dialog); dress move preserves the creation-position id (`ai-dress-token-3-3-3` after moving to 9,9).
- **Portal gate (AZ2):** see header (2). dress modal = `role=dialog` label `AI Dress — "<map>"`; error surface = `[role=alert]` inside dialog; disabled Apply = button ABSENT (no greyed Apply). Repair loop re-asks the model (rig returns the same failing ops — AZ2 logged 2–3 calls per refused proposal) then surfaces the LAST validation error.
- **Generator funnel (AZ2, full UI):** Drafts view = `AI Designer` section: composer is a TEXTAREA placeholder "What are we building?" (native-setter+input WORKS); `Send` gated on draft non-empty, `Propose build plan` gated on `messages.length>0` (silent-disabled, not inert); plan editor → "Generate drafts"; approved mapPlan lands DIRECTLY as a live map (no second review — drafts empty after Approve). `POST /maps` on a name collision untested this cycle (AY §Quick-rig holds). Designer chat lane carries NO response_format — a model replying raw JSON renders VERBATIM in the thread (see backlog).
- **MapsManager (AZ2):** rows Open/Activate|Active/Rename/Description/AI Dress/Delete (aria-labels `Open "X"` etc.); Delete dialog a11y per header; dialog Tab-cycle focus trap unit-pinned only.
- **LAN map-follow (AZ2):** `browser_tabs {action:'new', url:'http://<en0-ip>:5173', isolatedContext:'lan'}` gives a true LAN-origin isolated tab; nav shows singular "Map"; hidden-dress-token invisibility + live show/delete adopt both proven on placedItems creature rows (activating test-map wrote `__map__`/activeMapName — resurrection-after-clear observed again: a loaded LAN tab re-stamped activeMapName until closed, then two-pass quiet).
- **3D face (AZ2):** toolbar `View map in 3D` → WebGL canvas; exit via `2D` text toggle (no aria-label — backlog); `Top-down` view button; dress/generated tokens present as colored cylinders (pixel-probe recipe in playbook).
- Music mood fix / world scrutiny+receipt / referee ask-console / director / drafts batches / factions+quests / EB / campaign admin / aiConfig / dice tray: AW + AU/AV faces stand (event-clear; AZ2 never entered — post-AY commits on those paths are the improve fixes only, test-pinned).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Maps list/view + AI-Dress toolbar + preview + INDOOR lanes (poi/item/token/portal) | deep (live 2026-11-01 AZ2) | `src/components/map/Map.jsx PlacedItems.jsx IndoorPoiLayer.jsx hooks/useIndoorPois.js Map3D/map3dScene.js src/services/maps/dressPreview.js server/services/ai/authoring/dressMap.js server/routes/ai-designer.js` — token lane fully re-verified (2D/menu/persist/SSE/3D pixels), portal gate both directions, 0 bugs |
| Generator AI funnel (chat→plan→generate→approve, mapPlan+dressing tokens) | deep (live 2026-11-01 AZ2) | `src/components/campaign-builder/AiDesignerSection.jsx CampaignBuilder.jsx server/services/ai/authoring/applyMaps.js designerPrompts.js server/routes/ai-designer.js` — tokens→placedItems rendered, digest cites generated ids, snapshot-first + structured log rows |
| MapsManager row ops (Open/Activate/Delete dialog) | deep (live 2026-11-01 AZ2) | `src/components/maps-manager/MapsManager.jsx` — delete modal now role=dialog/aria-modal/focus-inside (681199249 verified live; Tab-cycle unit-pinned) |
| LAN player map-follow + fog-aware visibility (incl. dress/generated tokens) | deep-ish (live AZ2) | `src/components/map/hooks/useSSESync.js useFogOfWar.js` — hide/show/delete differentials now proven for placedItems CREATURE rows both directions live |
| Map 3D view (tokens/props/fog) | live AZ2 (color-pixel close) | `src/components/map/Map3D/Map3D.jsx map3dScene.js` — purple monster + red npc pixels asserted; mesh geometry not asserted (Target 4) |
| Music view | deep (live 2026-11-01 AW; 8b8897db3 improve-pinned) | `src/components/music/MusicPlayer.jsx` — not entered AZ2 |
| World keeper (scrutiny + receipt) | deep (live 2026-11-01 AW) event-clear | `src/components/campaign-admin/AiWorldConsole.jsx src/services/ai/proposalNameAudit.js` |
| Referee ask-console (override incl. CHANGE) | deep (live 2026-11-01 AW) event-clear | `src/components/campaign-admin/AiRefereeSection.jsx src/services/ai/applyRuling.js` |
| Drafts panel (SSE + races + batch) | deep (live 2026-11-01 AW) event-clear | drafts consumed post-Approve confirmed by AZ2 API probe (value null) |
| NPC director (Initiative) | deep (live 2026-11-01 AW) event-clear | needs_human Confirm asymmetry → Target 1 (owner call) |
| Factions CRUD + conflict lanes | deep (live AW) event-clear | `server/utils/jsonEntityCrud.js` |
| Quests CRUD | deep (live AW) event-clear | id-DELETE lanes |
| Log view (labels/search/filters) | deep (live AT/AW; e0c9cd076 test-pinned) | AZ2 read ai log rows via API only (fields structured, connector copy not UI-re-read) |
| Encounters/EB | live AV + AR/AP deep faces event-clear | not entered AZ2 |
| Dice tray (GM) + LAN mirror | deep (live AV) event-clear | |
| Campaign admin (download/upload/rollback/rename) | deep (live AU) event-clear | AZ2 used admin clears (API lane: no dialogs) |
| aiConfig UI + validator | deep (live AU/AW; AZ2 API rig) | mode enum off\|suggest\|autopilot; clear-change-data WIPES aiConfig — re-seed after every clear |
| NPCs/Settlements CRUD + ct-lanes | live AQ/AP/AR event-clear | not entered AZ2; npcs [Marta] untouched |
| Maps fog paint/reveal | live 2026-10-31 AS (event-clear) | zero commits touch fog lanes since |
| Initiative walk/board ops | deep (live AW) event-clear | board never mounted AZ2 |
| SSE sync (general), rests, death saves, EffectAdder, hex travel, spell overlays, wizard, player view, inventory, rules | carried — event-clear | AZ2 rode map-SSE heavily (token show/delete adopt) — zero regression |
| AI designer chat/plan/generate | deep (live AZ2 — see generator row) | |
| Enforcement section | live AQ/AP/AR event-clear | not entered AZ2 |

## Baseline Fingerprints (canonical test-campaign state at AZ2 exit — verified 2026-11-01)

- change-data `{}` + log `[]` + cs null GET-verified two-pass FROM CLOSED-TAB QUIET (both tabs closed before the clears; note: a mid-run server restart by the parallel fix-run + a loaded LAN tab re-stamped activeMapName once — playbook resurrection rule re-confirmed, cleared last from quiet).
- test-map md5 **8e40779e** byte-identical to AY baseline (placedItems Thug1/barrel/Zombie1, items [], pois [], players 11); battle-arena md5 **94fcd0bf** byte-untouched. Maps list [Battle Arena, Test Map] — throwaways QA AZ2 Hex (API-deleted then re-created for portal face, UI-dialog-deleted) and QA AZ2 Hollow (UI-dialog-deleted) both gone.
- Factions [The Iron Consortium] + quests [The Lost Artifact] + npcs [Marta Copperkettle] + encounters 31 — never touched AZ2, stamps AW-canonical. design-notes.json REMOVED (mine: 2 QA AZ2 msgs + 1 plan).
- Snapshots (.snapshots, cap-4 at AZ2 exit): 11-01T20-25 (AZ2 generate snapshot-first), 11-01T13-23 (AU), 10-31T22-40 (AR), 22-02 (parallel run) — 22-01 pruned by rotation, by design.
- All 13 char files untouched (no sheet opened). Zero production writes; **lock denials 1** (deliberate `POST /api/campaigns/Frostfall/aiConfig` 403 probe); console errors 0; failed network requests 0 whole session.
- QA rig files left (gitignored): `.playwright-mcp/qa-fake-model-server-az2.mjs` (digest-aware dress + generator funnel; KILLED at exit) + `qa-fake-model-az2.jsonl`; evidence `az2-3d-monster-token.png`; stdlib PNG pixel-probe at /tmp/png_probe.py (durable copy in playbook); dev:locked trio LEFT RUNNING on :80/:5173 for immediate reuse.

## Improvement Backlog

- 2026-11-01 AZ2: **Designer chat renders raw-JSON model replies verbatim** — the chat lane sends no response_format (by design), so a model answering with structured JSON prints the whole blob in the thread. Could detect parseable JSON and pretty-print or re-prompt toward prose. Rig-caused echo here (marker over-match), but the app surface is honest-but-ugly with any misbehaving model. `src/components/campaign-builder/AiDesignerSection.jsx` (msg render ~:243).
- 2026-11-01 AZ2: **Two delete-confirm idioms for maps** — deleting a MAP opens the polished `role=dialog` "Delete Map" modal (681199249) but deleting a placed TOKEN uses a native `window.confirm` (`Delete "X" from the map?`). Same "named confirm" spirit, different chrome/a11y tier. Consider routing token/prop/item deletes through the same named-modal component. `src/components/map/hooks/usePlacedItemsContextMenu`/`PlacedItems.jsx` confirm sites.
- 2026-11-01 AZ2: **3D-mode exit affordances lack aria-labels** — inside the 3D view the exit is a bare text `2D` toggle and `Top-down` has no accessible name, while entering 3D has `View map in 3D`. a11y parity fix (same family as 8b8897db3). `src/components/map/Map3D/Map3D.jsx` toolbar buttons.
- 2026-11-01 AZ2: **Hidden-marker dim values diverge** — hidden POI dims `use` opacity 0.4 (AY) while hidden creature tokens dim `.npc-circle` opacity 0.5 (AZ2), both GM-only. Harmless today; a shared constant would keep GM-readable dimming consistent across lanes. `IndoorPoiLayer.jsx` / `PlacedItems.jsx`.

## Blocked / Deepen Targets (fold-gate ledger)

- OPEN (owner call): director needs_human Confirm asymmetry — live-proven AW, unchanged code since; adjudicate, don't re-prove.
- OPEN (infra): llama.cpp-style refusing-backend face for constrained decoding fallback — no such backend on this machine (unchanged since AQ).
- OPEN (infra, refreshed AS): oMLX + Qwen-mtp grammar-echo degeneration family — AZ2 sidestepped entirely with the fake rig.
- DEFERRED (low value): 3D per-mesh geometry assertions (Target 4); dress-token Rotate effect (Target 5); Propose-plan with a live oMLX model (AZ2 used the fake rig; chat-echo raw JSON noted in backlog instead).
- CLOSED this run: AY Target 1 (token lane fully re-verified incl. 3D pixels + LAN SSE, ALL PASS); AY Target 2 (portal gate re-verified both directions, ALL PASS); generator-tokens fix 368a03927 (full UI funnel re-walked, PASS); AY "MapsManager delete not role=dialog" demoted + superseded.
