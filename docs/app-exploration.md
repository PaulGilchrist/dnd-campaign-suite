# App Exploration Map

**DESCENT RUN BA — 2026-11-01 (same-day fold over AZ2: the four post-AZ2 improve commits 675f58484, 37112c75b, 598b0070b, a446f47e3 landed AFTER AZ2's fold and were unit-pinned only — BA re-derived ALL FOUR live and all PASS; zero new bugs filed).**
1. **Token-delete modal parity (37112c75b) CLOSED live**: placedItems ctx-menu Delete on a dress creature token now arms `.maps-manager-modal[role=dialog][aria-modal=true]` labelled by `#map-delete-confirm-title`, heading "Delete from Map", named copy `Delete "QA AZ2 Goblin" from the map?`, buttons Cancel/"Yes, Delete" (`button.delete-confirm-btn`), initial focus = Cancel inside the dialog. Native-confirm spy `window.__confirmCalls` stayed `[]` across add/hide/show/rotate/delete/cancel-confirm — AZ2's "token-delete confirm = NATIVE window.confirm" fact is DEAD. Cancel fully inert (modal closes, token mounted); confirm fires the staged closure once — row gone from DOM AND map doc. **LAN differential through the new wiring re-proven**: GM hide → LAN invisible; GM show → LAN re-adopts; modal-confirm delete → LAN drops live (QA AZ2 Marta, both directions, ~1.5s).
2. **Hidden-dim unification (a446f47e3) CLOSED live**: hidden dress creature token `.npc-circle` computed opacity **0.4** (AZ2-era 0.5 DEAD); hidden indoor POI `use` + `.poi-label` both 0.4 (unchanged value, rides the new shared `HIDDEN_MARKER_OPACITY` from `src/config/mapConfig.js` without regression). Player lanes: hidden = fully invisible (unchanged semantics, proven on LAN).
3. **3D toolbar aria-labels (598b0070b) CLOSED live**: `2D` exit carries aria-label "Back to 2D map", `Top-down` carries "Top-down view" (title-mirrors); exit-by-aria-label click returns the 2D board with the canonical rows.
4. **Designer chat raw-JSON pretty-print (675f58484) CLOSED live**: AI-role whole-JSON replies render `pre.ai-designer-msg-json` (JSON.stringify indent 2) inside `.ai-designer-msg-ai`; a GM-typed `{"gmTyped":"raw check"}` stays VERBATIM in `.ai-designer-msg-text` (role-scoped face proven both directions in one thread).
5. **AZ2 Target 5 (dress-token Rotate) CLOSED by BA**: Rotate on a creature token writes `rotation: 90` onto the placedItems row and PERSISTS (map PUT immediate) but the creature render lane emits ZERO transform (group/circle/label `getAttribute('transform')` all null) — rotation consumers live only in prop/furniture lanes (`PlacedItems.jsx` table/altar/wall branches). Honest verdict: persisted-state-but-invisible-on-circles ⇒ improvement backlog (not a bug file — geometry is rotation-invariant by design, the menu is what over-advertises).

**Freshness for the NEXT run (event-driven rule unchanged):** BA entered maps/dress/DeleteFromMapModal/Map3D/designer-chat/LAN-map-follow and re-dated those rows to 2026-11-01 BA. The four improve commits' file stats touch NOTHING outside those lanes + hex `POILayer` (cosmetic dim only, unit-pinned) — every other row below stays event-clear. Since AZ2 no other commits landed (git log clean at BA exit).

**qa-temp exception (owner ruling, 2026-10-29):** exactly ONE throwaway campaign named `qa-temp` may be created/exercised/deleted for cross-campaign seams. All other campaigns PRODUCTION. `POST /api/campaigns` 403s while `CAMPAIGN_LOCK` is set. BA additionally proved the LOCK IS ROUTE-METHOD-SCOPED LIVE: `GET /api/campaigns/Frostfall/{change-data,log,aiConfig,combatSummary,maps,npcs}` all 200 (reads allowed) while `POST npcs`, `POST change-data/probe`, `POST admin/clear-log`, `PUT /Frostfall` all 403 verbatim `Campaign locked to "test-campaign" — <METHOD> <path> denied`.

## Priority Targets (next descent)

1. **Director needs_human Confirm asymmetry** — UNCHANGED since AW; still owner-adjudication-owed before filing — don't re-prove, adjudicate.
2. **`jsonSchema:true` vs a refusing backend** — STILL owed (unchanged since AQ): no llama.cpp-style refusing backend on this machine.
3. **Fog-of-war deep face** — rows event-clear since AS; no commit touches fog painting/reveal (a446f47e3 touched PlacedItems-fog.test only for the dim constant). Descend if one lands.
4. **3D mesh geometry inspection** — color-pixel proof closed at AZ2; per-mesh placement/height never pixel-asserted. Only worth it if a 3D bug is suspected. (BA note: 3D hidden-mesh dim is now 0.4 via `map3dScene._setDimmed`, unit-pinned, not pixel-asserted.)

## Depth Seeds (live 2026-11-01 BA unless noted)

- **Token lane (BA, post-37112c75b):** dress ops land `ai-dress-token-<x>-<y>-<n>` in `placedItems` (type monster/npc), render 2D with `g[title="<Name>"]`, ctxmenu arms on the inner transparent `<rect>` (separate evaluate to READ the menu — React flush lands after the dispatch tick). NPC-type menu = Hide/Delete/Rename/Rotate; monster-type = Hide/Delete/Rotate. Menu STAYS OPEN after Hide/Show and labels re-render from state (Show↔Hide). Delete = `DeleteFromMapModal` over shared `src/components/common/DeleteConfirmModal.jsx` (role=dialog tier, MapsManager chrome) — NOT native confirm (spy-proven). Move op preserves the creation-position id. Rotate writes `rotation:90` + persists but creature lane renders no transform (see header 5).
- **Indoor POI lane (BA):** applied POI = `pois[]` row `ai-dress-poi-<x>-<y>-<n>`; DOM `g.indoor-poi-layer > g.poi-item` with `use#poi-landmark` + `text.poi-label` + `rect.poi-hit-area` (contextmenu anchor; layer mounts a beat BEFORE its children — poll for `g.poi-item`, not the layer). Hide → use+label dim 0.4 GM-only. **DELETE STILL NATIVE `window.confirm(\`Delete POI "X"?\`)`** — the parity commit deliberately scoped token/prop/player only (backlog).
- **3D face (BA):** toolbar `View map in 3D` → WebGL canvas; exit button aria-label "Back to 2D map", "Top-down view" (both live); 2D restore verified by canonical `g[title]` re-enumeration.
- **Designer chat (BA, post-675f58484):** composer = textarea placeholder "What are we building?"; Send → AI reply whole-JSON → `pre.ai-designer-msg-json`; GM JSON stays raw. Chat turns persist `data/design-notes.json` (no pre-run file — `rm` is the restore). RIG GOTCHA: the chat system prompt contains "build plan", so a marker-over-matching fake rig answers EVERY chat message with its SCOPE plan — steer with unique markers or accept the SCOPE echo.
- **Portal gate (AZ2):** carried — unverified (BA never pressed portal ops; 0fe7d441b/368a03927 code untouched by the four improve commits).
- **MapsManager (BA rows live):** row aria-labels Open/Activate|Rename/Delete verified live; `Activate "X"` writes `__map__.activeMapName` and (observed BA) lands on the editor without a separate Open — soft-warn, re-check if it matters; Delete-map dialog a11y per 681199249 (AZ2 verified, same chrome now shared via DeleteConfirmModal extract — structure byte-preserved per BA inspection of the shared component).
- **LAN map-follow (BA):** `browser_tabs {action:'new', url:'http://192.168.0.44:5173', isolatedContext:'lan'}` → select test-campaign → nav shows singular "Map" → mounts active map with all visible rows; hide/show/delete differentials adopt live (~1.5s) through the NEW requestDelete staging wiring both directions. Resurrection-after-clear re-observed: selecting campaign on a fresh tab re-stamped `combatSummary` 12-PC skeleton + `__campaign__` + the opened char's bucket within seconds — clears MUST be final, closed-tab, two-pass (done BA, quiet).
- Music mood fix / world scrutiny+receipt / referee ask-console / director / drafts batches / factions+quests / EB / campaign admin / aiConfig UI / dice tray / NPCs-ct-lanes / fog paint / initiative walk / SSE-general / spell overlays / wizard / player view / inventory / rules: AW+AU/AV/AS/AR/AP faces stand (event-clear; BA never entered — the four post-AZ2 commits touch none of their paths).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Maps list/view + AI-Dress toolbar + preview + INDOOR lanes (poi/item/token delete lanes) | deep (live 2026-11-01 BA) | `src/components/map/Map.jsx PlacedItems.jsx DeleteFromMapModal.jsx src/components/common/DeleteConfirmModal.jsx hooks/usePlacedItems.js hooks/useIndoorPois.js IndoorPoiContextMenu.jsx server/services/ai/authoring/dressMap.js` — post-parity-modal delete walk (dialog tier, cancel-inert, confirm-once, LAN adopt), dim 0.4 both lanes, Rotate write-only-face closed, 0 bugs |
| MapsManager row ops (Open/Activate/Delete) | deep (live BA rows; delete dialog AZ2) | `src/components/maps-manager/MapsManager.jsx` now consumes the shared DeleteConfirmModal |
| LAN player map-follow + hidden/show/delete differentials | deep-ish (live 2026-11-01 BA) | `src/components/map/hooks/useSSESync.js useFogOfWar.js` — creature-row hide/show/delete both directions re-proven through NEW delete wiring |
| Map 3D view (toolbar a11y, enter/exit) | live 2026-11-01 BA (a11y face closed) | `src/components/map/Map3D/Map3D.jsx` — aria-labels verified live; mesh geometry still not asserted (Target 4); 3D hidden-dim 0.4 unit-pinned not pixel-asserted |
| AI designer chat lane (Send/thread/JSON render) | deep (live 2026-11-01 BA) | `src/components/campaign-builder/AiDesignerSection.jsx server/services/ai/designNotes*` — pretty-print + role-scope both faces; design-notes residue lane mapped |
| Generator AI funnel (plan→generate→approve) | deep (live 2026-11-01 AZ2) event-clear | `server/services/ai/authoring/applyMaps.js designerPrompts.js` — BA chat-probed the same route family only; no commit touches funnel internals |
| Portal gate (indoor reject + hex targetMap) | carried — AZ2, unverified BA | gate code 0fe7d441b untouched by post-AZ2 commits |
| Music view | deep (live AW; 8b8897db3 pinned) event-clear | |
| World keeper / Referee ask-console / Drafts panel / NPC director | deep (live AW) event-clear | director needs_human Confirm → Target 1 (owner call) |
| Factions CRUD + conflict lanes / Quests CRUD | deep (live AW) event-clear | |
| Log view / Encounters+EB / Dice tray / Campaign admin / aiConfig UI / NPCs+ct-lanes / fog paint / Initiative board / SSE-general / spell overlays / wizard / player view / inventory / rules | carried — event-clear | BA used aiConfig POST/DELETE + admin API clears (no dialogs on API lane, re-confirmed); campaign-lock reads-open/writes-403 re-proven live |

## Baseline Fingerprints (canonical test-campaign state at BA exit — verified 2026-11-01)

- change-data `{}` + log `[]` + aiConfig GONE + cs null — GET-verified TWO-PASS after closing both tabs (a loaded GM tab had mid-run resurrected the 12-PC combatSummary skeleton + `__campaign__` + AasimarTest bucket — playbook resurrection rule re-observed, cleared last from quiet).
- test-map md5 **8e40779e** byte-identical to AZ2 baseline (placedItems Thug1/barrel/Zombie1 rotation:null visible:true, items [], pois [], players 11); battle-arena md5 **94fcd0bf** untouched. Maps list [Battle Arena, Test Map]; zero QA residue.
- Factions [The Iron Consortium] + quests [The Lost Artifact] + npcs [Marta Copperkettle @1793124887756] + encounters 31 — never entered BA, stamps AW-canonical. design-notes.json REMOVED (mine: 2 GM msgs + 2 SCOPE-echo replies).
- Snapshots `public/campaigns/.snapshots/` (cap-4, NOTE: lives at campaigns-level hidden dir, not under maps/): 11-01T20-25 (AZ2), 11-01T13-23 (AU), 10-31T22-40 (AR), 10-31T22-02 (parallel) — set unchanged by BA (no generate/upload).
- All 13 char files untouched (sheet never opened — default sheet view mount does no writes). Zero production writes; **lock denials 4** (deliberate Frostfall POST×3 + PUT×1 probe set); console errors 4 = exactly those 4xx; LAN tab console 0 errors, 0 failed requests.
- Rig: reused `.playwright-mcp/qa-fake-model-server-az2.mjs` (killed at exit via `kill $(lsof -ti :8123)`); ai rig traffic log `qa-fake-model-az2.jsonl` refreshed. dev:locked trio LEFT RUNNING on :80/:5173 for immediate reuse.

## Improvement Backlog


## Blocked / Deepen Targets (fold-gate ledger)

- OPEN (owner call): director needs_human Confirm asymmetry — live-proven AW, unchanged code since; adjudicate, don't re-prove.
- OPEN (infra): llama.cpp-style refusing-backend face for constrained decoding fallback — no such backend on this machine (unchanged since AQ).
- OPEN (infra, refreshed AS): oMLX + Qwen-mtp grammar-echo degeneration family — BA sidestepped entirely with the fake rig.
- DEFERRED (low value): 3D per-mesh geometry assertions (Target 4); 3D hidden-mesh dim pixel proof (0.4 unit-pinned).
- CLOSED this run: AZ2 Target 5 (dress-token Rotate — consumer audit + live probe, verdict = backlog, see header 5); the four post-AZ2 improve faces (all PASS live: modal delete parity, dim 0.4 unified, 3D aria-labels, designer JSON pretty-print).
- NOT A BUG (adjudicated BA): designer-chat rig SCOPE-echo on every greeting = fake-rig marker over-match ("build plan" in system prompt), app surface honest; MapsManager "Activate opens editor?" — ambiguous re-render race in BA's own click sequence, not reproduced cleanly, left unfiled.
