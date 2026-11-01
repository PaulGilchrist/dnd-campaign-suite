# App Exploration Map

**DESCENT RUN AY — 2026-11-01 (same-day post-AW fold: 6 landed fix/improve commits re-entered the maps/dress face).** AY re-derived **Target 1 live and CLOSED** the indoor-POI fix (2b617ef71): full fake-rig dress cycle on test-map — applied POI renders in `g.indoor-poi-layer` (landmark use + label + GM hit-area), right-click menu options are SVG `<text>` Hide/Show/Delete (Delete fires named confirm `Delete POI "X"?`), hidden marker dims `use` opacity 0.4 while the label layer stays, `visible:false` round-trips through map autosave (GET-verified), hidden POIs are fully INVISIBLE to a LAN-origin tab while a re-Shown POI appears on the LAN tab **live via SSE** (and its later delete also lands live — differential proven both directions). The POI-chest companion renders named via the placedItemLabel lane (8566bac9b live-confirmed: `g[title="QA AY Chest"]`). **Target 2 walked → BUG FILED**: dress `token` ops are a write-only lane — digest-aware add/move/remove all validate + persist into `doc.items[]` server-side (id `ai-dress-token-3-3-0`), preview markers mirror on grid, Apply reports success… and NOTHING renders them ever (2D PlacedItems filters `placedItems` only; Map3D.jsx:72 feeds the scene `placedItems`; the only `mapData.items` consumer app-wide is useSSESync's adoption at :53) and there is no UI to remove them (bug-ai-dress-tokens-invisible-write-only-lane). **New finding → BUG FILED**: `poi.targetMap` is offered by the dress prompt for ALL map kinds and applies/persists on indoor maps, but `linkedMap` has ZERO indoor consumers — no Enter badge, no click lane, dead portal (hex POILayer.jsx:11-16/117-128 is the live twin) (bug-ai-dress-poi-portal-inert-on-indoor-maps). **Outdoor negative passed clean**: token op on a throwaway hex map → honest inline modal error `ops[0] "add token": item/token ops are indoor-only (hex maps carry terrain + POIs)`, no Apply button, modal stays open. Console errors 0, failed requests 0, lock denials 0.

**Freshness rule (unchanged):** before trusting a Coverage row for an area you ENTER, `git log --since="<row date>" --oneline -- <paths>`; commits the row doesn't account for ⇒ re-derive live. AY entered the maps/dress face because 2b617ef71/e0c9cd076/8566bac9b/6503338e3 landed AFTER the AW fold. No commits since 10-31 touch AiDirectorPanel/applyDirectorIntent (director rows event-clear), fog paint/reveal services (fog row event-clear), music (8b8897db3 is the aria-label improve itself, test-pinned), or world/referee/drafts paths.

**qa-temp exception (owner ruling, 2026-10-29):** exactly ONE throwaway campaign named `qa-temp` may be created/exercised/deleted for cross-campaign seams. All other campaigns PRODUCTION. `POST /api/campaigns` 403s while `CAMPAIGN_LOCK` is set.

## Priority Targets (next descent)

1. **Token-lane fix re-verify** — when bug-ai-dress-tokens-invisible-write-only-lane lands (route tokens into `placedItems` or add an IndoorTokenLayer), walk add/move/remove live incl. 3D + LAN faces + removal affordance; confirm `buildMapDigest.tokens` source agrees with the renderer.
2. **Indoor-portal resolution follow-up** — owner call on the filed bug: gate `poi.targetMap` outdoor-only (INDOOR_ONLY idiom in dressMap.js applyOne) vs wiring indoor entry; whichever lands, re-verify the dress proposal/preview copy names the destination.
3. **Director needs_human Confirm asymmetry** — UNCHANGED since AW live (no commits on `src/components/initiative/AiDirectorPanel.jsx`/`src/services/ai/applyDirectorIntent.js`); still owner-adjudication-owed before filing — don't re-prove, adjudicate.
4. **`jsonSchema:true` vs a refusing backend** — STILL owed (unchanged since AQ): no llama.cpp-style refusing backend on this machine.
5. **Fog-of-war deep face** — rows event-clear since AS; AY entered the indoor board but fog lanes are byte-untouched by every post-AS commit. Descend if any commit touches fog painting/reveal.

## Depth Seeds (live 2026-11-01 AY unless noted)

- **Indoor-POI lanes (AY, closes AW's bug):** apply → live render (no reload); GM right-click → Hide/Show/Delete menu (SVG `<text>` options — dispatchEvent click, no .click() method); hidden = `use` opacity 0.4 GM-only, invisible to LAN; Delete named confirm; visible flag persists via 1s-debounce map autosave; LAN tab adopts show/hide/delete LIVE via map SSE. Companion `item` add renders with title (8566bac9b) and its item menu adds Rotate (Hide/Delete/Rotate vs poi Hide/Delete).
- **Token lane (AY):** server-side honest (digest exposes `tokens.rows` with real ids; move/remove cite them, all-or-nothing rejects; add idiom `ai-dress-token-x-y-N`; label-by-name in client preview, kind in server copy) — client render/removal ZERO (bug filed). Outdoor token op rejected with exact modal inline error (repair-loop burns 2 model calls then surfaces `errors`).
- **Portal POI (AY):** `poi.targetMap` → `linkedMap` persists on indoor docs, renders as plain landmark, click zero delta (no popup/nav/log/network/console); hex lane owns the whole enter-portal machinery (Enter badge gated on party adjacency).
- **MapsManager row lane (AY):** rows expose Open/Activate/Rename/Description/AI Dress/Delete; Delete opens `.maps-manager-modal-overlay` React modal (NOT role=dialog — invisible to `[role=dialog]` probes) with Cancel + "Yes, Delete Permanently"; the overlay intercepts underlying row clicks until handled.
- **LAN map-follow (AY):** player nav shows singular "Map"; view follows `activeMaps` (`PUT /maps/:name/activate` → publishes + stamps change-data `__map__ {activeMapName}`; GET /active-map reads memory; Admin clear-change-data also clears the active-map). Unactivated → "Waiting for the GM to open a map… / Check Again".
- **Quick-rig outdoor map (AY):** `POST /api/campaigns/:c/maps {name,type:'outdoor',terrain:{"0,0":"grass",…}}` creates a dressable hex doc in one call; UI Delete-modal or API DELETE both clean.
- Music mood fix / world scrutiny+receipt / override-HP CHANGE / cross-kind approve-all / director autopilot seam / drafts SSE / factions+quests races / EB light faces / campaign admin / aiConfig / dice tray / LAN mirror: AW + AU/AV faces stand (event-clear; AY never entered — post-AW commits on those paths are the improve fixes only, test-pinned: 8b8897db3 music aria, e0c9cd076 log copy, 6503338e3 dress re-click invariant).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Maps list/view + AI-Dress toolbar + preview + INDOOR lanes (poi/item/token/portal) | deep (live 2026-11-01 AY) | `src/components/map/Map.jsx IndoorPoiLayer.jsx IndoorPoiContextMenu.jsx hooks/useIndoorPois.js PlacedItems.jsx Map3D/Map3D.jsx src/services/maps/dressPreview.js server/services/ai/authoring/dressMap.js server/routes/maps.js` — indoor POI fix closed; 2 bugs filed (token write-only, indoor portal inert); outdoor negative clean |
| MapsManager row ops (Open/Activate/Delete modal) | live AY (delete modal walked) | `src/components/maps-manager/` — Delete = custom overlay modal, not role=dialog, not native confirm |
| LAN player map-follow + fog-aware POI visibility | deep-ish (live AY) | `src/components/map/hooks/useSSESync.js useFogOfWar.js` activate lane server-side — waiting-state, activate/SSE adoption, hidden-invisible differential both directions; player sheet/overlay faces AV/AK unchanged |
| Music view | deep (live 2026-11-01 AW; 8b8897db3 improve-pinned) | `src/components/music/MusicPlayer.jsx` — not entered AY; the post-AW commit IS the filed a11y fix, test-pinned |
| World keeper (scrutiny + receipt) | deep (live 2026-11-01 AW) event-clear | `src/components/campaign-admin/AiWorldConsole.jsx src/services/ai/proposalNameAudit.js` |
| Referee ask-console (override incl. CHANGE) | deep (live 2026-11-01 AW) event-clear | `src/components/campaign-admin/AiRefereeSection.jsx src/services/ai/applyRuling.js` |
| Drafts panel (SSE + races + batch) | deep (live 2026-11-01 AW) event-clear | `src/components/campaign-builder/CampaignBuilder.jsx src/services/campaign/draftActions.js` |
| NPC director (Initiative) | deep (live 2026-11-01 AW) event-clear | `src/components/initiative/AiDirectorPanel.jsx src/services/ai/applyDirectorIntent.js server/routes/campaigns-ai.js` — needs_human Confirm asymmetry → Target 3 (owner call) |
| Factions CRUD + conflict lanes | deep (live AW) event-clear | `server/utils/jsonEntityCrud.js` |
| Quests CRUD | deep (live AW) event-clear | id-DELETE lanes |
| Log view (labels/search/filters) | deep (live AT/AW; e0c9cd076 copy-improve test-pinned) | `src/components/log/Log.jsx log-utils.js` — not entered AY |
| Encounters/EB | live AV + AR/AP deep faces event-clear | `src/components/encounter/` — not entered AY |
| Dice tray (GM) + LAN mirror | deep (live AV) event-clear | |
| Campaign admin (download/upload/rollback/rename) | deep (live AU) event-clear | `server/routes/campaigns-admin.js` — AY used admin clears (API lane: no dialogs) |
| aiConfig UI + validator | deep (live AU/AW; AY API rig) | mode enum off\|suggest\|autopilot — 'chat' 400s |
| NPCs/Settlements CRUD + ct-lanes | live AQ/AP/AR | not entered AY; npcs [Marta] untouched |
| Maps fog paint/reveal | live 2026-10-31 AS (event-clear) | zero commits touch fog lanes; AY dress edits left fog/revealed/walls byte-identical (full-doc restore round-trip) |
| Initiative walk/board ops | deep (live AW) event-clear | `src/components/initiative/` |
| SSE sync (general), rests, death saves, EffectAdder, hex travel, spell overlays, wizard, player view, inventory, rules | carried — event-clear | AY rode map-SSE heavily (POI adopt, LAN delete) — zero regression |
| AI designer chat/plan/generate | live AR/AQ + improve-proven | not entered AY |
| Enforcement section | live AQ/AP/AR | not entered AY |

## Baseline Fingerprints (canonical test-campaign state at AY exit — verified 2026-11-01)

- change-data `{}` + log `[]` + aiConfig gone + `activeMapName null` GET-verified two-pass from closed-tab quiet (pre-entry leftovers — a 11-PC 1/1 combatSummary rig from the fix/improve runs — wiped by the clear).
- test-map canonical: placedItems [npc Thug 1@(2,1), barrel@(10,10), npc Zombie 1@(19,19)], `items: []`, `pois: []`, players 11 (untouched lane); battle-arena NEVER opened, byte-untouched. Maps list [Battle Arena, Test Map] (throwaway "QA AY Hex" created via API, exercised, UI-Delete-modal removed).
- Factions [The Iron Consortium] + quests [The Lost Artifact] + npcs [Marta Copperkettle] + encounters 31 — never touched AY, stamps AW-canonical.
- All 13 char files untouched (no sheet opened). Zero production writes; **lock denials 0**; console errors 0; failed network requests 0 whole session.
- QA rig files left (gitignored): `.playwright-mcp/qa-fake-model-server-ay.mjs` + `qa-fake-model-ay.jsonl` (digest-aware, killed at exit) + evidence `ay-3d-tokens.png`; repo clean apart from this run's docs/bug files.

## Improvement Backlog

- (2026-11-01 AY) Map-view toolbar back-button tooltip differs by kind: indoor "Back" vs hex "Back to maps" — unify the a11y label (MapToolbar.jsx vs hex toolbar).

## Blocked / Deepen Targets (fold-gate ledger)

- OPEN (owner call): director needs_human Confirm asymmetry — live-proven AW, unchanged code since; adjudicate, don't re-prove.
- OPEN (infra): llama.cpp-style refusing-backend face for constrained decoding fallback — no such backend on this machine (unchanged since AQ).
- OPEN (infra, refreshed AS): oMLX + Qwen-mtp grammar-echo degeneration family — AY sidestepped entirely with the fake rig.
- UNVERIFIED (AY, honestly): token absence in 3D is static-proven (scene fed placedItems only) — WebGL canvas opened but meshes not pixel-inspected; hex live-portal Enter-badge differential not re-walked (hex deleted pre-emptively; twin evidence = POILayer code + earlier-cycle faces).
- CLOSED this run: AW Target 1 (indoor-POI fix live re-verified end-to-end incl. LAN differentials); Target 2 (token lane walked — outcome: bug filed, not a pass).
