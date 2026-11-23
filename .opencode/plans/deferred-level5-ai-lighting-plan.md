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

---

## A. Enforcement presets — "Level 5, one decision at a time"

**Problem.** Admin → Enforcement & Referee is a master switch + ten raw
checkboxes, each honestly titled but flat. A GM learning the app cannot
predict what "the table will feel like" when boxes flip, and there is no
off-ramp story beyond "Take over manually".

**Design (additive; the ten switches remain the single source of truth).**

1. **Preset row above the checkboxes**: `Gentle · Standard · Strict · Custom`
   as segmented `session-phase-pill`-style buttons (reuse that kit).
   - **Gentle** = turnLock + actionEconomy + movementBudget (the table's own
     bookkeeping; no LOS/zone policing).
   - **Standard** = all today's enforcement flags except serverDice.
   - **Strict** = everything including serverDice.
   - **Custom** = whatever the checkboxes say (auto-selected the moment any
     box moves after a preset click).
   Presets write the SAME `enforcement` change-data key through the existing
   lane (no new key). The master switch stays separate and untouched.
2. **Plain-English consequence card** under the preset row: one live sentence
   recomputed from current flags, e.g. *"Referee will: refuse off-turn actions,
   clamp token drags to speed. Referee will not: charge zones, check line of
   sight."* Derived, never stored (single source of truth = the flags).
3. **First-denial explainer**: the first time a *specific* denial class fires
   in a campaign (turn-lock, economy, LOS…), show a copilot-family card
   (GMCopilot registry entries `denial-turnlock`, `denial-economy`, …) on the
   offending screen explaining the rule and the off-switch, settled forever
   via the existing `gmCopilot` key (already registered in changeDataKeys +
   campaignKeys — zero new state lanes).
4. **Preset definitions live in data, not code**: `src/config/enforcementPresets.js`
   (flag → preset map) so tuning copy never requires handler changes.

**Files.** `src/components/campaign-admin/EnforcementSection.jsx` (preset row +
consequence card), `src/config/enforcementPresets.js` (new), denial seams
(where `enforcement_denied` entries are produced — attach the one-time tip id),
`copilotTips.js` (new registry entries).

**Verification.** Unit: preset→flag matrices, Custom adoption rule, consequence
copy. Live: localhost Admin — click each preset, screenshot checkbox states +
copy; arm Gentle, attack off-turn on the tracker, screenshot the one-time
denial card; reload — card stays gone; player tab sees the denial log row but
NO admin chrome change.

---

## B. AI readiness — "know your endpoint before you need it"

**Problem.** The AI lane fails closed honestly (good), but a GM setting it up
first discovers failures mid-session. The pieces exist (model discovery via
`POST /api/ai/models`, AiStatusBadge with '· endpoint down', local-only guard,
server-side key storage) — what is missing is a *guided first run*.

**Design — an assistant, not a wizard (owner: "perhaps a wizard, perhaps
not"). A wizard forces a linear path the GM may want to skip; the readiness
panel is ambient and optional.**

1. **Readiness panel** inside AiRefereeSection (below the config row), shown
   whenever a mode other than `off` is selected:
   - **Step chips (status, not gates)**: ① Endpoint reachable → ② Model
     listed/selected → ③ Schema probe passed → ④ Test ruling succeeded.
     Each chip = the existing `AiStatusBadge` visual language (green/dim/red).
   - **"Run a check" button** per chip (manual, no timers, no automatic
     pinging — the app never talks to the model without a click):
     reachability = `POST /api/ai/models` (already exists); schema probe = one
     bounded referee question with a canned expected shape, validating the
     reply via the existing schema validation; test ruling = the same
     question the AI Referee panel asks, run in dry-run (result displayed, no
     engine write).
   - Honest failure faces reuse existing refusal copy (applyFailureCopy.js);
     a dead endpoint shows the provider's own error line plus the
     recipe link (Ollama / LM Studio / oMLX snippets — one `details` each,
     static copy).
2. **"Level 5 without AI" signpost**: when aiConfig is unset/off, one muted
   line under the Mode select: *"Enforcement works entirely on its own — AI
   is optional. You can keep playing without a model server."* (Discovery
   copy only.)
3. **Keep everything fail-closed and audited exactly as today** — this item
   is discovery UX over the existing funnel, zero new authority lanes.

**Files.** `src/components/campaign-admin/AiRefereeSection.jsx` +
`AiConfigRow.jsx` (chips + buttons + recipes), new `src/components/campaign-admin/AiReadinessPanel.jsx`,
`src/services/ai/aiClient.js` (dry-run flag for the test ruling), possibly a
tiny server route `POST /api/ai/self-test` reusing provider registry +
validation (localhost-gated like the other AI admin routes).

**Verification.** Unit: chip state derivation (mock fetch), dry-run writes
nothing (store/log untouched — assert zero setRuntimeValue/addEntry). Live:
with aiConfig pointed at a dead endpoint (like the LV24 rig:
`http://localhost:9/v1`), every chip honest-red with recipe visible; a mock
model server passing schema → green chips; screenshot GM-only (player tab
must not see any of it).

**Note:** real-model behavior of autopilot director stays on the
harness-unverifiable ledger (already there); this item makes the *failure*
faces discoverable, which is what the GM actually needs.

---

## C. 2D dynamic lighting — torchlight on the tactical map

**Problem.** The 3D viewer owns the atmosphere (torch point lights, fog
volumes); the map everyone actually fights on is flatly lit. Owners love the
3D look but play 2D.

**Design.**

1. **Torch radius model (per token, rules-light):**
   - New per-token prop `light` ∈ `none | dim | bright` (default `bright` for
     characters and monsters unless the GM sets otherwise; `dim` = half radius).
   - Radii from the 2024/5e torch convention: bright 20 ft + 20 ft dim;
     lantern 30+30; GM-editable per token via the existing context menu
     (reuse the door-toggle context-menu lane). Stored on the token row in
     map data (single canonical shape; no legacy field — pre-release law).
   - Campaign toggle in the map toolbar: **Lighting: On/Off** (off = today's
     rendering byte-identical; default OFF, matching every optional-feature
     promise).
2. **Rendering:** the existing fog layer is the machinery to reuse — a cell
   is *lit* when within any friendly/own token's bright radius (walls +
   closed doors block, Bresenham rays already in `lineOfSight.js`).
   - GM: unlit areas render at a dim veil (like GM fog but darker, distinct
     color so light ≠ fog).
   - Players: unlit cells render near-solid dark, own token's circle lit —
     mirroring the 3D torch feel without hiding what fog-of-war already
     revealed: **lighting limits what is CURRENTLY visible; explored fog
     stays lifted (brighter veil than unexplored).** This keeps the two
     systems orthogonal and explains itself visually.
3. **Spell overlays & hazards unaffected** (still drawn above the veil;
   zone-visibility law stays with fog, not light).
4. **Performance:** reuse the fog's per-cell visibility pass — one extra
   boolean per cell, computed in the same render tick; no per-frame loop.

**Files.** `src/components/map/hooks/useFogOfWar.js` (or sibling
`useLighting.js` — prefer sibling, keep fog hook single-purpose),
`lineOfSight.js` (radius variant — rays already support wall blocking),
`Map.jsx` toolbar toggle, token context menu, map-data schema (token.light),
`Map.css` veil tiers, server `maps.js` PUT shape (tokens already carry props —
extend validation).

**Verification.** Unit: lit-cell derivation (open room, wall shadow, door
open/closed, bright vs dim radius). Live: GM vs player tabs side by side —
screenshot same board fog-off/lighting-on; token drag re-lights live; toggle
off = byte-clean render; confirm indoor map only (hex maps unchanged).

**Risk/size:** largest item here — recommend building it as a *read-only veil
first* (no new gameplay mechanics), and NOT wiring light into stealth/awareness
rules in v1 (explicit follow-up decision, keeps enforcement orthogonal).

---

## D. Custom token art (small, pairs with C)

Per-token image upload (portrait already exists on characters/NPCs — reuse
`imageUtils` upload lane + `npcImages` pattern) and emoji fallback picker for
placeholder NPCs; token renderer falls back to initials exactly as today.
Kept separate from C to avoid bundling a spectacle item with a
data-shape change.

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
