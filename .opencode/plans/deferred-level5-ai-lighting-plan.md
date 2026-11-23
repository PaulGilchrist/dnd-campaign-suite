# Deferred Plan — Level 5 Ramp, AI Readiness & Dynamic Lighting

> Origin: learnability-and-engagement plan (2026-11-22) — deferred items the
> owner explicitly wants kept and detailed, NOT rejected. Owner notes:
> *"I really like the dynamic lighting and improving the AI enforcement and
> ease of learning and use (perhaps a wizard, perhaps not)."*
>
> Context at time of writing: Phases 0–6 of the learnability plan are shipped
> (GM Copilot tips, Try-next invitations, Help drawer + sidebar "?", Sound
> Owner + cue gate, Nat20/Fumble flourish, staged loot reveal, e2e lane
> repaired, initiative overflow fixed). The owner's GM is still climbing
> Levels 1→4; these items serve the 4→5 step and table spectacle afterwards.
>
> Every item keeps the standing laws: guidance is additive (never hides a
> feature), everything defaults off, server-first state, no game timers, no
> backward-compat shims, ship gate = lint + targeted tests → full suite →
> live Playwright (GM + player + TV tabs) with screenshots checked against
> the shared design kit.
>
> **PRESSURE-TEST PASS 2026-11-22 (implementation-ready):** every file ref
> below was re-verified against HEAD; all open decisions are resolved inline
> with `DECIDED:` markers. Verification deltas worth knowing:
> - `lineOfSight.js` lives at `src/services/maps/lineOfSight.js` (NOT under
>   `src/components/map/hooks/`). It exports `bresenham(x0,y0,x1,y1)` and
>   `computeVisibility(players, walls, closedDoors, gridSize)`; fog sets are
>   `Set<"x,y">` string keys, not per-cell booleans.
> - `server/routes/maps.js` PUT is a **whole-document verbatim replace** —
>   token rows carry no field whitelist, so `light`/`imagePath` persist with
>   ZERO server change. Only the erasure guard + `normalizePlayerIds` run.
> - The AI referee POST (`server/routes/campaigns-ai.js:67`) already applies
>   NOTHING server-side — schema validation (`server/services/ai/schemas.js`)
>   happens inside that route; application is client-side `applyRuling.js`
>   behind a click. So a readiness "test ruling" is inherently dry-run and
>   **no new server route is needed** (the plan's `POST /api/ai/self-test` is
>   DROPPED).
> - `placedItems` rows ALREADY render an ad-hoc `item.imageUrl`
>   (`PlacedItems.jsx:272`: `npcImages[item.name] || item.imageUrl`), with a
>   test pinning that precedence (`PlacedItems-localhost-rendering.test.jsx`).

---

## A. Enforcement presets — "Level 5, one decision at a time"

**Problem.** Admin → Enforcement & Referee is a master switch + ten raw
checkboxes, each honestly titled but flat. A GM learning the app cannot
predict what "the table will feel like" when boxes flip, and there is no
off-ramp story beyond "Take over manually".

**Verified today (2026-11-22).** `src/components/campaign-admin/EnforcementSection.jsx`
(169 lines): `FLAGS` array of 10 (`:29-46`), debounced optimistic write lane
`writeDebounced`/`flushDraft` (`:62-83`, 600 ms trailing), master switch
zeroes flags through `ENFORCEMENT_DEFAULTS` (`:113-115`,
`src/services/combat/canTakeAction.js:34-53`), bulk Select All/Clear All
outside the fieldset (`:134-152` — disabled-fieldset occlusion law). Server
validator `server/validation/keyValidators.js:30-39` whitelists exactly these
11 keys (`unknown enforcement flag` 400s anything else) — presets writing the
same blob pass untouched.

**Design (additive; the ten switches remain the single source of truth).**

1. **Preset row above the checkboxes**: `Gentle · Standard · Strict · Custom`
   as segmented `session-phase-pill`-style buttons.
   - **Gentle** = turnLock + actionEconomy + movementBudget (the table's own
     bookkeeping; no LOS/zone policing).
   - **Standard** = all ten enforcement sub-flags except serverDice.
   - **Strict** = everything including serverDice.
   - **Custom** = whatever the checkboxes say.
   **DECIDED:** presets write `{ ...ENFORCEMENT_DEFAULTS, mode: 'on', ...flags }`
   through the EXISTING `writeDebounced` lane (rides the 600 ms coalescing,
   one POST per burst); the master switch stays separately rendered. Preset
   identity is NEVER stored — the active chip is derived by matching the
   current flag blob against the definitions; no match ⇒ Custom renders
   selected. Custom therefore auto-adopts the moment any checkbox moves
   after a preset click, with no extra logic.
   **DECIDED (kit reuse):** `.session-phase-pill` styles are scoped to
   `.session-section` (`SessionSection.css:8-24`). Widen those two selectors
   to also cover `.enforcement-section` (both sections always co-mount inside
   CampaignAdmin) instead of duplicating pill tokens.
2. **Plain-English consequence card** under the preset row: one live sentence
   recomputed from current flags ("Referee will: … / Referee will not: …"),
   phrases seeded from the `FLAGS[].hint` copy and users-guide §8 table.
   Derived, never stored (single source of truth = the flags). Renders even
   under a disarmed master (harmless preview text; the card itself is never a
   disabled-fieldset descendant — same occlusion law as the bulk row).
3. **First-denial explainer**: **DECIDED — canonical `rule` stamp on the
   existing `enforcement_denied` log rows, zero new state lanes:**
   - `canTakeAction.js` denial objects gain `rule`: `awayDenial→'away'`,
     `conditionDenial→'condition'`, `turnLockDenial→'turnLock'`,
     `economyDenial→'actionEconomy'`; the charge-race spent denial in
     `assertCanAct.js:188` stamps `rule:'actionEconomy'`.
   - Producers stamp directly: `lineOfSightGate.js` deny (`:85-98`)
     `rule:'lineOfSight'`; `usePlayerDragging.js` snap (`:70-77`)
     `rule:'movementBudget'`; `opportunityTrigger.js` (`:111-118` blocked,
     `:128-135` reaction spent) `rule:'opportunityAttack'`.
   - `reportDenial` (`assertCanAct.js:107-119`) forwards `rule` into the log
     entry (additive field on a pre-release shape — no compat branch).
   - New `DenialExplainer.jsx` (GMCopilot folder): GM-only
     (`src/services/ui/isLocalhostBrowser.js`), subscribes via
     `subscribeToSSE` and watches `log-*` events for
     `type==='enforcement_denied'`; the latest entry's `rule` maps to tip ids
     `denial-turnlock` / `denial-economy` / `denial-movement` /
     `denial-los` in `copilotTips.js` (unsettled rules only; `away`,
     `condition`, `opportunityAttack` explain themselves via the popup copy).
     The "recent denial" is a local `useState` (ephemeral UI — permitted),
     card settles forever through the EXISTING `gmCopilot` key
     (`useGmCopilot` dismiss — already registered in BOTH
     `server/utils/changeDataKeys.js:75` and
     `src/services/automation/common/campaignKeys.js:105`). Mounted in
     `Initiative.jsx` (turnlock/economy/LOS denials surface in the combat
     flow). No timers; the card persists until dismissed.
   - **DECIDED:** no history scan on mount (initial `getLog` NOT consulted) —
     the explainer is about the LIVE first-denial moment; older denials were
     already experienced without it.
4. **Preset definitions live in data, not code**: `src/config/enforcementPresets.js`
   (new; `src/config/` already holds mapConfig.js etc.) — each preset: flag
   map + one-line label + `match(flags)` helper exported by a shared
   `matchPreset(flags)` so the component and its test read one definition.

**Files.** `src/components/campaign-admin/EnforcementSection.jsx` (preset row
+ consequence card), `src/config/enforcementPresets.js` (new),
`src/services/combat/canTakeAction.js` + `assertCanAct.js` +
`src/services/combat/lineOfSightGate.js` +
`src/components/map/hooks/usePlayerDragging.js` +
`src/services/combat/opportunityTrigger.js` (rule stamps),
`src/components/GMCopilot/copilotTips.js` (4 new registry entries),
`src/components/GMCopilot/DenialExplainer.jsx` (new),
`src/components/initiative/Initiative.jsx` (mount), `SessionSection.css`
(selector widening), `EnforcementSection.css` (card styling from existing
tokens).

**Verification.** Unit: preset→flag matrices, Custom derivation, consequence
copy, rule stamps (canTakeAction/LOS/drag), DenialExplainer settled-forever
via mocked gmCopilot. Live: localhost Admin — click each preset, screenshot
checkbox states + copy; arm Gentle, attack off-turn on the tracker,
screenshot the one-time denial card; reload — card stays gone; player tab
sees the denial log row but NO admin chrome change.

---

## B. AI readiness — "know your endpoint before you need it"

**Problem.** The AI lane fails closed honestly (good), but a GM setting it up
first discovers failures mid-session. The pieces exist (model discovery via
`POST /api/ai/models` — `server/routes/ai-models.js`, localhost-gated `:22`,
bounded 5 s probe; `AiStatusBadge` '· endpoint down' — `AiConfigRow.jsx:7-29`;
server-side key storage `ApiKeyField`) — what is missing is a *guided first
run*.

**Design — an assistant, not a wizard.** **DECIDED: assistant face wins.**
A wizard forces a linear path over a surface whose fields are already a
single form; the readiness panel is ambient, optional, and re-runnable after
any config change — same information, no forced sequence, no feature ever
hidden. (The "wizard" would only differ by gating Save behind chips — which
would CONTRADICT the additive-guidance law, so it is rejected outright
rather than dual-shipped.)

1. **Readiness panel** inside `AiRefereeSection` (below `AiConfigRow`), shown
   whenever a mode other than `off` is selected. **DECIDED: three chips, not
   four** — the referee POST schema-validates server-side already, so a
   separate "schema probe" would just duplicate the same call; chips ③/④ of
   the original plan collapse into one round-trip:
   - ① **Endpoint reachable** — button `POST /api/ai/models`
     (`fetchAiModels` in `src/services/ai/aiClient.js:74`) with the SAVED
     aiConfig's endpoint/provider (not the unsaved form).
   - ② **Model listed** — derived from ①'s response + saved `aiConfig.model`
     (zero extra traffic; green only when the configured id is in the list).
   - ③ **Test ruling** — button `POST /api/campaigns/:c/ai/referee` via
     `askAiReferee` with a canned question ("Goblin 1 within 30 ft of
     Steadymark — propose one attack"). The server route applies nothing;
     the panel only DISPLAYS the returned ruling + confidence. **Dry-run
     requires no code change** — the client never calls `applyRuling` from
     the panel, and the panel must NOT route through `AiAskConsole` (which
     auto-applies in autopilot mode, `AiRefereeSection.jsx:145`).
     **EXECUTED — honesty fix found live:** `ok:false + code:AI_NEEDS_HUMAN`
     is the referee's FAIL-CLOSED fallback (model unreachable / invalid
     twice — `server/services/ai/index.js:42-43`), NOT a healthy round trip.
     The chip reads RED there (carrying the fallback sentence + the
     `AI_UNAVAILABLE: local model endpoint unreachable` tail); GREEN only
     on `ok:true` — including an ok:true ruling whose TYPE is needs_human
     (a genuine, schema-valid judgement deferral). First live pass exposed
     the wrong-green; fixed same session; both faces unit-pinned.
   - Every check is **click-only — no timers, no mount-time pinging, no
     automatic re-check**. (Existing behavior kept as-is: `AiConfigRow`'s
     400 ms model-list debounce fires only while the GM types the endpoint —
     that is config-time discovery, already shipped, not the panel.)
   - Chip faces reuse the `ai-badge--on/--off/--down` visual language
     (idle dim / pass green / fail red). Failure lines reuse
     `applyFailureDetail(error)` (`src/services/ai/applyFailureCopy.js:26`)
     plus one static `<details>` recipe each for oMLX / LM Studio / Ollama
     (copy seeded from users-guide §9 setup).
2. **"Level 5 without AI" signpost**: when aiConfig is unset/off, one muted
   line under the Mode select: *"Enforcement works entirely on its own — AI
   is optional. You can keep playing without a model server."* (Discovery
   copy only, derived from users-guide §3 promise.)
3. **Keep everything fail-closed and audited exactly as today** — discovery
   UX over the existing funnel, zero new authority lanes, **zero new server
   routes** (self-test route dropped per header delta).

**Files.** `src/components/campaign-admin/AiRefereeSection.jsx` (panel mount +
signpost), new `src/components/campaign-admin/AiReadinessPanel.jsx` (+ co-
located CSS riding `AiRefereeSection.css` tokens), no changes to
`aiClient.js` (existing `fetchAiModels`/`askAiReferee` suffice), no server
changes.

**Verification.** Unit: chip state derivation (mock fetch: reachable+listed+
valid ruling → 3 green; dead endpoint → ① red ②③ idle; listed-but-wrong-model
→ ② red), test-ruling click writes NOTHING (assert zero `setRuntimeValue`/
`addEntry`/`applyRuling` calls). Live: aiConfig pointed at a dead endpoint
(`http://localhost:9/v1`, the LV24 rig) → honest red + recipe visible,
screenshot; mock/local model passing → green chips; player tab sees none of
it (Admin is localhost-only already).

---

## C. 2D dynamic lighting — torchlight on the tactical map

**Problem.** The 3D viewer owns the atmosphere (`Map3D.jsx:160` local
`showTorch` PointLights); the map everyone actually fights on is flatly lit.

**Verified machinery (2026-11-22).** `useFogOfWar.js` (37 lines) returns
`{ fog, visible }` as `Set<"x,y">`; `FogOverlay.jsx` renders `<rect>` cells
`fog-cell` (GM 45 % black) / `fog-cell-player` (opaque `#3a3a42`); paint
order in `Map.jsx` svg = content → **FogOverlay (`:824`) → selection/context
→ SpellOverlayRenderer (`:899`)** — no z-index involved. Ray math:
`bresenham` + `lineBlocked` in `src/services/maps/lineOfSight.js`
(`computeEffectiveWalls` + `computeClosedDoors` feed it). Toggle lanes:
last-known mode lives ON THE MAP DOCUMENT
(`Map.jsx:665-672`, absent = OFF, GM press rides the ~1 s autosave PUT,
players get the SSE echo) — the model to copy. Token rows have no server
whitelist (header delta).

**Owner decision (locked):** **v1 is a read-only veil. NO stealth/awareness/
advantage wiring, NO culling** — light limits what the veil draws, nothing
else. Zone-visibility law stays with fog. Explored fog stays lifted.

**Design.**

1. **Torch radius model (per token):** token/document field `light` ∈
   `'none' | 'dim' | 'bright'` on indoor `players[]` and `placedItems[]`
   (npc/monster creature rows). **Absent key = `'bright'`** (single canonical
   shape; absent-is-default is the map-doc idiom, cf. `lastKnownMode` — NOT
   a legacy fallback). Radii: bright = 20 ft clear + 20 ft dim; `dim` = half
   (10 + 10). Feet→cells through the map's own `gridSize` (5 ft/cell
   convention). GM-editable per token via the existing context-menu lane
   (`ItemContextMenu.jsx` — extend `menuEntriesFor`/`menuFlagsFor`/
   `menuHeightFor`/`rotateOffsetFor` with the light cycle row).
2. **Per-map toggle `lighting` on the map document** (same lastKnownMode
   lane: absent = OFF ⇒ **default OFF everywhere, every existing map keeps
   today's rendering byte-identically** — the veil component mounts nothing
   when off). Toolbar button follows the `LastKnownModeToggle` idiom in
   `MapToolbar.jsx` (`aria-pressed` mirrors `.active`), GM presses, players
   follow via the map-data SSE echo.
3. **New `useLighting.js` sibling hook** (fog hook stays single-purpose) +
   `src/services/maps/lighting.js` pure math: for each light source, raycast
   cells within its bounding box (O(tokens × (2r+1)²) — far cheaper than
   `computeVisibility`'s full-grid sweep), walls/closed doors block via the
   existing helpers. Returns `{ bright:Set, dim:Set }` keyed `"x,y"` like
   fog. Sources: **GM view = every lit token** (spectacle); **player view =
   own tokens only** (matches the fog culled-by-player law).
4. **`LightingOverlay.jsx`** (sibling of FogOverlay, drawn immediately AFTER
   it in paint order — above content/fog, below selection chrome, context
   menus and spell overlays, so zones still read): unlit cells only.
   - GM: soft warm-dark veil (distinct from fog's neutral grey — light ≠
     fog, tier `light-veil-gm`, ~30 % indigo-black).
   - Player: explored-but-unlit → heavy veil; unexplored-and-unlit (fog ∩
     unlit) → near-solid. Two tiers ride the `fog-cell` class pattern.
   - Dim ring: lighter veil tier between bright radius and dim radius.
   Radii/veil constants live in `src/config/mapConfig.js` (existing file).
5. **Off-state byte-identity law:** `lighting !== true` ⇒ hook computes
   nothing, component renders `null` — no extra DOM at all (unit-pinned).

**Files.** `src/components/map/hooks/useLighting.js` (new),
`src/services/maps/lighting.js` (new), `src/components/map/LightingOverlay.jsx`
+ CSS tiers in `Map.css`, `Map.jsx` (hook mount + overlay paint slot +
toolbar wiring), `MapToolbar.jsx` (Lighting toggle),
`ItemContextMenu.jsx` + door-toggle lane (light cycle),
`src/config/mapConfig.js` (radii/veil constants). **No server change**
(verbatim PUT persists `light`/`lighting`; erasure guard untouched).

**Verification.** Unit: lit-cell derivation (open room, wall shadow, door
open/closed, bright vs dim radius, absent-key default); overlay mounts
nothing when `lighting` falsy. Live: GM vs player tabs side by side —
screenshot same board fog-off/lighting-on; token drag re-lights live; toggle
off = pixel-clean render identical to pre-feature; confirm indoor maps only
(hex maps never consult the hook).

---

## D. Custom token art (small, pairs with C)

**Verified today.** Character portraits already ride
`processImageUpload` (`server/utils/imageUtils.js:11-49`: body carries
`character.image` data URL + `imageName`, server writes
`public/campaigns/<c>/images/<file>`, stores relative `imagePath`, strips
the data URL — 5 MB body cap). NPC lane twin: `server/routes/npcs.js:76-85`
via PUT. Client: `FileReader.readAsDataURL` (NPCFormModal.jsx:101-112).
Static serving: `server.js:99` express.static(public) — local images are
plain `campaigns/<c>/images/<file>` URLs. Token renderers:
`Players.jsx:52-60` already draws `character.imagePath` for PC tokens
(initials fallback `:111-135`); `PlacedItems.jsx:265-370` creature tokens
resolve `npcImages[item.name] || item.imageUrl` with skull/initial fallback.

**DECIDED (no-legacy law applied to `imageUrl`).** The ad-hoc `item.imageUrl`
data-URL-ish lane is REPLACED in this same change by the canonical
`item.imagePath` (campaign-relative path, exactly the character/NPC shape):
- Render precedence flips to `item.imagePath` (explicit per-token art beats
  the name-keyed `npcImages[item.name]` cache — the GM chose it for THIS
  token), then cache, then skull/initials. Update
  `PlacedItems-localhost-rendering*.test.jsx` pins; delete the `imageUrl`
  branch (never write a dual-reader).
- **DECIDED: new tiny upload endpoint** `POST /api/campaigns/:campaign/token-image`
  (localhost-gated like every other GM image lane; reuses `imageUtils`'
  write pattern, saves under the existing `images/` dir with a `token-`
  prefix, returns `{ imagePath }`). Base64 lives only in the POST body —
  map JSON stores the PATH (never inline bytes: the 1 s autosave PUT would
  bloat past the 5 MB cap).
- **UI lane: `ItemDetailsDock`** (GM+2D click-select HTML dock), not the
  SVG context menu — an `<input type="file">` + emoji grid belongs in HTML;
  context-menu pixel math (`menuHeightFor` et al.) stays untouched. Dock gets
  "Set token art" (file picker → POST → `setMapData` row write, autosave
  persists) + "Remove art" (delete `imagePath`, and the server deletes the
  orphan file when a row losing it is saved… **DECIDED: v1 keeps files** —
  same posture as campaign assets, folder delete sweeps; note in backlog if
  it ever grows).
- **Emoji fallback picker** for placeholder NPC tokens: curated ~24-emoji
  grid in the same dock, writes `item.emoji`; `renderCreature` fallback
  order: `imagePath` → `npcImages` → `emoji` → skull/initial.
- PC tokens: unchanged — their art lane is the character sheet portrait
  upload that already exists (`Players.jsx` already renders it).

**Files.** `server/routes/token-image.js` (new, mount beside the other
campaign routes), `src/components/map/ItemDetailsDock.jsx` (art controls +
emoji grid), `src/components/map/PlacedItems.jsx` (imagePath precedence +
emoji fallback), `EnforcementSection` untouched. No `maps.js` change.

**Verification.** Unit: precedence derivation (imagePath beats cache beats
emoji beats initial; absent fields byte-identical fallback), upload payload
shape (data URL + imageName), imagePath lands on the row. Live: upload a PNG
onto a monster token from the dock on test-campaign's active map, screenshot
GM + player tabs (image over initials), remove → initials return; reload —
state persisted in the map JSON. Baseline: restore the map file byte-exact
afterward (pre-copy, never git-restore).

---

## Sequencing

1. **A (enforcement presets)** — cheapest, immediately useful, rides lanes
   this plan already shipped (copilot tips registry, pill kit).
2. **B (AI readiness panel)** — medium, unlocks honest Level-5 AI trials.
3. **D (token art)** — small, standalone.
4. **C (dynamic lighting)** — biggest, best last once the sheet/tracker ramp
   is fully owned by the GM.

## Carry-over (from the learnability plan, still open)

- **Phase 4 full visual-consistency sweep**: every new surface shipped so far
  reuses the kit (CreatureBadge/card/modal tokens), but the app-wide audit
  (one modal shell, one empty-state, one button hierarchy across all 17
  views) has not been done screen-by-screen. Run it with Playwright
  screenshots per view before/after each convergence.
  **DECIDED:** ride the final live pass of this plan — screenshot every view
  once A–D are in, converge only cheap single-file divergences (a stray
  button tier, an ad-hoc empty state), and record anything structural in the
  app-exploration Improvement Backlog rather than half-fixing mid-session.

## Baseline & campaign discipline (this execution)

- Only `test-campaign`. Pre-copy `public/campaigns/test-campaign/**`
  (change-data, log, maps) to the session temp dir before any live work;
  restore by plain file copy at session end (git restore/checkout is
  forbidden), then prove: change-data + log ABSENT on disk, the ten data/*.json
  md5 pins byte-exact, `git status --porcelain public/` EMPTY, ports dark.

---

## EXECUTION RECORD 2026-11-22 (A, B, D, C shipped this session)

All four items landed with green gates (lint 0 warnings, full vitest, live
Playwright GM + visitor-tab walkthroughs; screenshots `.playwright-mcp/` +
session root: A-01…07, B-01…03, C-01…06, D-01, P4-<view> sweep set).
Decisions taken while executing beyond the resolved plan above:

1. **A — DenialExplainer mounts TWO screens**: Initiative (tracker-side
   denials; `tvMode` prop self-gates the TV layer) AND CharSheet (the sheet
   IS the offending screen for wrong-turn button presses — Initiative-only
   mounting missed every sheet press, found live). All gates live inside the
   component (localhost + tvMode) so neither host gains a branch (both sit
   at their eslint ceilings).
2. **A — live truth learned**: the GM's monster-card dice-chip lane INTENTIONALLY
   bypasses turnLock (the GM is the referee — pressing an off-turn monster
   rolls). Denials come from player/sheet lanes. Recorded in the
   app-exploration backlog so nobody "fixes" it by gating the GM.
3. **A — sheet UX**: with economy ON, the sheet PRE-DISABLES a spent attack
   cell (`.attack-dwell-disabled`), so the economy denial face arrives via
   other lanes; the turnLock face was verified live (popup + audit
   `rule:"turnLock"` + card + settle-forever through reload + player tab
   shows the log row with zero admin chrome).
4. **C — lighting sources = the shared board**: every PC token + creature
   prop emits on EVERY tab (GM/player differ only in veil-opacity tiers —
   exact mirror of the fog-cell split). The plan's "player: own token only"
   line is superseded: per-client identity was complexity with zero
   spectacle gain, and fog already computes every PC's LOS on player tabs.
5. **C — PC-token light EDITING is v1-deferred** (players always emit the
   bright default; only creature rows get the context-menu cycle row).
   Backlogged.
6. **C — `FEET_PER_CELL` hoisted to `src/config/mapConfig.js`** (spellOverlay
   service's private copy folded into the import — code-simplicity law once
   a second consumer appeared).
7. **D — art UI lives in ItemDetailsDock (HTML), NOT the SVG context menu**
   (pixel math untouched); the LIGHT row did join the context menu with
   re-pinned heights (monster 94, npc 120, npc+stats 138). `item.imageUrl`
   deleted outright (no-legacy law) — canonical `item.imagePath` beats the
   name-keyed cache; upload bytes never touch map JSON (POST /token-image →
   `images/token-<ts>-<rand>.png`, row stores the relative path only).
8. **Route-mount law re-proved live**: a `/api/campaigns/:c/<word>` POST lane
   mounted AFTER `campaignsChangedata` is silently eaten by the `:key`
   wildcard (observed: change-data key `token-image` + a 200 with no
   `imagePath`). token-image mounts BEFORE it in server.js; API server does
   NOT hot-reload route mounts — restart the dev pair after touching
   server.js.
9. **Phase 4 carry-over**: sweep RIDDEN (17 GM views, screenshots `P4-*.png`,
   DOM chrome census per view). Structural finding: the `.ct-*` kit is
   adopted only by newer surfaces (Admin, Inventory, maps manager,
   Settlements, Factions); the legacy majority still render bespoke button
   tiers. NOT converged mid-session (out of cheap-single-file scope) —
   recorded as the top Improvement-Backlog item with the census numbers.
