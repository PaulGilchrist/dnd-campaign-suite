# Plan — Strengthen Levels 1–4 (TV Mode, Control Delegation, Arena Play, Starter Campaign)

> Written 2026-11-01 from the levels-1–4 improvement discussion. Level 5 is intentionally
> parked until 1–4 are strengthened; several items here deliberately build its rails
> (controller field, seeded-sandbox campaign, feedback juice).

## Status

> **qa-arena / qa-starter exception (owner ruling, 2026-11-01):** exactly TWO throwaway
> campaigns named `qa-arena` and `qa-starter` may be created/exercised/deleted for
> Phase 3/4 Arena & Starter verification. All other campaigns remain PRODUCTION —
> never touch. Same doctrine as the `qa-temp` ruling in docs/app-exploration.md.

| Phase | State | Notes |
|---|---|---|
| 1 — TV mode + juice | ✅ **DONE + LIVE-VERIFIED 2026-11-01** | `useTvPresentation.js`, `TvToggleButton`, `TvNextUpStrip`, `HpFeedback`, `VictoryBanner` (extracted for the complexity ratchet); `handleClear` stamps `campaign.lastCombatResult` (kills-only). Unit: `Initiative.tv.test.jsx` (6) + `handleClear` assertions; full suite 32,956 green, lint 0, no-timers guard OK (floaters are timer-free via animationend). Playwright live pass on test-campaign: toggle/fullscreen/persist, spotlight order+pulse (incl. re-center fix on mode entry), up-next reactivity, −11/−103/+5 floaters + flash + retire/re-arm, bloodied badge, target chip, victory banner honest copy ("0 foes defeated · 1 drove off", 13/13), dismiss persists across reload, zero console errors; baseline restored (change-data `{}`, log `[]`, tab closed). |
| 2 — Control delegation | ✅ **DONE + LIVE-VERIFIED 2026-11-01** | `services/encounters/creatureControl.js` (precedence: explicit `controller` > summoned te > wild-shape/shapechange source > `summonedBy`-player); GM 🎮 picker on NPC cards (`ControlRow`, localhost-only, auto-note for derived lane), `handleControllerChange` (write + `control_assigned`/`control_released` automation log), LAN "Your turn!" cue; CreatureCard/Initiative wired; `computePlayerSummoned` removed (single source). Unit: creatureControl.test.js (10) + createCreatureHandlers.control.test.js (6) + CreatureCard.control.test.jsx (10); full suite 32,982 green, lint 0, timer guard OK. Two-tab Playwright live pass: picker options + assign → combatSummary `controller:"FeyRanger"` + verbatim audit row; LAN visitor opens the Skeleton's full interactive card, NO picker on LAN, real Shortsword roll (d20 9+5=14 vs AC 18, honest MISS, retro adv/dis); zero console errors both tabs; baseline restored two-pass closed-tab. |
| 3.1 — Arena campaign preset | ⬜ next (see `.opencode/plans/arena-starter-build-and-verify.md`) | |
| 3.2 — In-campaign betrayal / ally editing | ✅ **DONE + LIVE-VERIFIED 2026-11-02** | Engine allegiance already shared one model (`selectedAllies` read by auras/Redirect/AoE). Surfaced a **GM-only 🤝 Allies editor on every tracker card** (players included → defectors work), reusing the existing `AllySelectionModal` + key (D4: edit at any time, no restore switch). Files: `useAllyEditor.js`, `AlliesButton.jsx` (self-gating), `AllyEditorModal.jsx`, wired into `Initiative`/`CreatureCard`; logged `ability_use / Ally Selection`. Unit: `useAllyEditor.test.js` (5) + `Initiative.allyEditor.test.jsx` (3). Playwright live: 13 buttons on test-campaign, opened AasimarTest → Clear All (0 → confirm disabled) → tick self (1) → Confirm ⇒ store `selectedAllies:["AasimarTest"]` + verbatim audit row, modal closed, 0 console errors; baseline restored `{}`/`[]`. |
| 4 — Starter campaign | ⬜ next (see `.opencode/plans/arena-starter-build-and-verify.md`) | |

> **Campaign-lock infra (enables 3.1/4 live verification):** `campaignLock.js`
> extended to a **comma-separated allowlist** (single name = byte-identical prior
> behavior; production never an element stays denied). Added body-aware
> `createCampaignCreateGuard` (POST /api/campaigns creates only a set member) +
> primary-protection in the rename guard (first lock entry never renamable;
> throwaway↔throwaway renames allowed). spell-overlay lane uses set membership.
> Tests: `campaignLock.test.js` extended (allowlist create/rename/production-deny).
> **Restart the QA-locked API** with:
> `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js`
> (vite `npm run dev:react` on :5173 unchanged). Verified 2026-11-02: qa-arena/
> qa-starter → 201, Frostfall → 403, then both probes deleted (DELETE also
> allowlist-gated). Full suite 33,001 green, lint 0, timer guard OK.

## Guiding decisions (from owner)

| # | Decision | Consequence |
|---|---|---|
| D1 | The TV experience **is** the Initiative tracker — no separate spectator view | Phase 1 is a presentation mode of `Initiative.jsx` |
| D2 | LAN-only forever; no accounts, no auth, no HTTPS work | Identity is per-browser "which characters am I playing", trust-based |
| D3 | **Control delegation follows the player, on the same device**: a device that plays character X also controls everything X controls (summons, GM-assigned NPCs/monsters). No per-seat picker separate from the characters | `controller` = a character name, not a device/seat id |
| D4 | Ally lists (`useAllySelection.js`) are the allegiance model; edit at any time is sufficient (no special "restore party" switch) | Phase 3 betrayal support = surfacing the existing editor + validation pass |
| D5 | Arena pickup play lives in its **own campaign folder** (create → play → delete), not event-copies of real sheets | Phase 3 scenario 1 = an "Arena Campaign" quick-create flow |
| D6 | Starter campaign is **seeded-generated, not hardcoded**: fixed teachable skeleton, fresh content each roll, rerollable for replay | Phase 4 = generator orchestration + checklist, zero hardcoded story content |
| D7 | Rules reference stays the separate hosted D&D Tools app (serves standalone users) | No in-app compendium; optional deep-links only |
| D8 | One person may control multiple characters; visitors play NPCs/monsters, not just PCs | Phase 2 must handle N creatures per player |
| D9 | Multi-character control, one subagent at a time; only `test-campaign` may be mutated in verification; full app rules in AGENTS.md apply throughout | Verification workflows below |

---

## Phase 1 — TV mode inside the Initiative tracker

**Goal:** the tracker screen thrown on the living-room TV becomes big, glanceable, and
alive — whose turn, who's next, who's hurt, who's targeting whom — readable from 10 feet,
with satisfying damage feedback on every device.

### 1.1 Presentation mode toggle

- New `TV` button in the tracker toolbar (`src/components/initiative/Initiative.jsx`),
  stored as a **local UI flag** (per-client `useState`/localStorage-per-view setting is
  allowed — it is display formatting, not game state; server-first rule untouched).
  Any browser (GM, player, or the TV itself) can enter TV mode on its own.
- Fullscreen (`requestFullscreen` on toggle, Escape exits) + `initiative--tv` root class.
- Layout changes are **CSS-driven** (new `Initiative.tv.css` scoped to the component) plus
  a light `tvMode` prop threaded into `CreatureCard.jsx` to swap sizes/reordering:
  - Active creature: scaled-up card, animated pulsing spotlight ring, moved to top of list
    in TV mode (DOM order preserved via CSS `order` so all existing tests/refs stay valid).
  - **Next-up strip**: compact row of the next 3–5 creatures after the active one
    ("on deck"), computed from `combatSummary` order — pure derivation, no state write.
  - HP bars: `HpBar.jsx` gains a tall TV variant; **bloodied** state (≤50% max HP) turns
    the bar/ portrait rim red — a threshold flag is *derived at render*, never stored.
  - Condition/target badges scale up (`CreatureBadge` sizes via CSS variables, no new
    components).
  - Round counter enlarged; creature count and difficulty-free chrome (add-NPC buttons,
    admin affordances) hidden in TV mode unless the viewer is localhost.

### 1.2 Feedback juice (all modes)

- **Damage/heal floaters**: when a creature's `currentHp` changes between SSE renders,
  float `−12` (red) / `+7` (green) / crit-sized variant above the card for ~1.5s.
  Implement as a diff in `CreatureCard.jsx` (previous value in a `useRef` — benign UI,
  not game state). Animation via CSS keyframes only; the `setTimeout` that removes the
  floater is a benign animation-close timer (add to `no-timers-guard.mjs` allowlist with
  one-line justification).
- **Hit flash** on the card when damage lands; shake on failed death save result if
  cheaply detectable from the existing change writes (optional stretch).
- **Victory banner**: when combat is cleared / `Complete Encounter` fires
  (`useLootHandlers.js`, navigation/clear handlers), show a banner over the tracker:
  "Victory! — X rounds, Y XP each, loot awarded" composed from data already produced by
  the encounter-complete flow. TV mode shows it full-screen. Dismiss on click or Next
  encounter; it is transient UI, nothing persisted beyond the existing log entries.

### 1.3 Tests

- Vitest (jsdom): TV toggle sets root class; next-up strip derivation (wraparound at
  round end); bloodied threshold derives correctly; floater renders on hp decrease and
  removes after timer (fake timers); victory banner composes from combatSummary + XP data;
  localhost-gate tests (`initiative.localhost-gate.test.jsx`) still pass with TV chrome
  hidden for non-localhost.
- Manual (test-campaign): join an encounter, open two tabs, toggle TV on the LAN tab,
  confirm HP/condition/target sync and floaters on both.

### Acceptance

TV laptop + TV browser show identical, readable state; GM play is unchanged when TV mode
is off; zero new server routes or game-state keys.

---

## Phase 2 — Control delegation (visitors & multi-character players)

**Goal:** let a GM hand any NPC/monster to a player device by assigning it to a *player
character name*, reusing the existing summoned-creature control lane; a player running
multiple characters sees all their creatures on their device.

### 2.1 Data model — `controller` on combatSummary creatures

- Add optional `controller: <characterName>` to creature rows in
  `src/services/encounters/initiativeService.js` / `encounterToInitiative.js`
  (joined encounters, `+ NPC` slots, summons).
- **Derivation rule** (single helper, e.g. `getCreatureController(creature, allCreatures)`
  in a new `src/services/encounters/creatureControl.js`):
  1. explicit `creature.controller` (GM-assigned), else
  2. existing `summonedBy` if that name is a player-type creature (current behavior), else
  3. `wildShapeSource` / `shapechangeSource` (already player-owned forms), else
  4. unassigned → GM only.
  This keeps every existing summon/wild-shape flow byte-identical; the new part is (1).
- `computePlayerSummoned()` in `CreatureCard.jsx` becomes a thin wrapper over the shared
  helper (delete the duplicated logic per code-simplicity rule; existing tests updated to
  the helper's behavior contract).

### 2.2 GM assignment UI

- On each NPC/monster card (initiative `CreatureCard.jsx` avatar context / a small
  "Assign control…" button, localhost only): dropdown of player creatures → sets
  `controller` on the combatSummary row (via `initiativeService` mutator, SSE-published
  like every other cs write; log `creature control assigned` to the campaign log per the
  automation-logging rule). "Release control" clears it.
- Assigning to a player automatically adds the creature to that player's **targeting-ally
  set only if it isn't already hostile-listed** — do NOT silently rewrite `selectedAllies`
  (allegiance is owned by the ally-list editor, D4).

### 2.3 Player device surface ("my creatures")

- A LAN device already selects its character(s); extend with a **controller-aware switcher
  in the sidebar**: the selected character plus every creature whose
  `getCreatureController(...)` equals the selected character (or any character the device
  has ticked — multi-character control). Ticking characters is the per-browser UI flag
  allowed by D2 (not game state).
- For each controlled creature the device renders its **interactive stat card**
  (existing `onNpcClick(..., { allowNonLocalhost: true })` lane in
  `createNpcClickHandler.js`) — dice chips roll through the exact same monster-action
  engine lanes; everything already logs/SSEs.
- Turn cue: controlled creature cards that are `activeCreatureName` get an "Your turn!"
  badge in TV and normal modes (read-only derivation).
- Flesh-to-stone/prismatic-spray interim-control states keep their current prompt routing;
  note in code that `controller` is permanent assignment, `_fleshToStone_` prefixes stay
  temporary control overrides and win while active.

### 2.4 Enforcement (L5 rail, minimal now)

- If turn-lock enforcement exists (`Admin → Enforcement & Referee`), have it accept
  actions from the *controller's* device for a creature, not just the GM. Keep the
  server-side validator as the authority; client gate is UX only. Do not expand
  enforcement scope beyond recognizing `controller`.

### 2.5 Tests

- Unit: `creatureControl.js` derivation table (explicit > summonedBy-player > wildshape >
  unassigned); summon flows regression (existing `computePlayerSummoned` tests must pass
  through the wrapper unchanged); assignment mutator writes + logs; non-localhost card
  gate opens only for controlled creatures.
- Manual (test-campaign): GM assigns a zombie to FeyRanger; LAN tab shows the zombie card
  and rolls an attack; victory/defeat states sync; release control returns it to GM-only.

### Acceptance

Visitor at the table can be handed "the ogres" in two clicks and play them from their own
phone; one player can run three characters + their summons from one device; no behavior
change for anyone who never touches the feature.

---

## Phase 3 — Arena play

**Goal:** quick, fun same-room play in both scenarios: disposable arena campaigns, and
in-campaign PvP (defector / split party) on top of the existing ally-list model.

### 3.1 Scenario 1 — Arena Campaign quick-create

- **"New Arena Campaign"** button on campaign selection
  (`src/components/campaign-selection/*`), calling the existing create route
  (`server/routes/campaigns-basic.js` / `campaigns-admin.js` create lane +
  `src/services/campaign/campaignService.js`) with a generated name (`Arena <date>`),
  then client-side post-create seeding (reuse the same service functions Phase 4 builds —
  implement the seeding orchestrator once, parameterize by preset):
  - 1–2 arena maps via the BSP dungeon generator (symmetric-leaning config: 2 spawn
    rooms, wide central hall — expose small generator-option presets in
    `src/services/maps/` dungeon pipeline), one activated.
  - A pre-saved **sparring encounter pool**: saved `encounters.json` rows of classic
    low-CR monsters (see Phase 4 monster list) for co-op-vs-monsters games.
  - No quests/factions/NPCs — arena folders stay lean.
- **Team setup on the tracker**: when a fight is joined in an arena campaign (and
  optionally anywhere), a compact "Teams" popover on the initiative header lets the GM
  (or, by convention, the two captains) assign combatants to Team A / Team B / FFA.
  Implementation = write `selectedAllies` per creature via `setAllyList` (team members +
  self), i.e. exactly what the existing ally model already consumes for auras,
  Redirect Attack, and target legality. **No new allegiance field.**
- Flow: pick format (1v1 / 2v2 / FFA / party-vs-monsters) → assign → Join Encounter /
  start initiative → fight → **victory banner** (Phase 1) naming the surviving team →
  Rematch (re-join same roster, reset HP via existing rest/restore lanes).
- XP/loot default **off** in arena campaigns (no `Complete Encounter` auto-prompt); a
  toggle can enable rewards. Killing monsters still logs normally.

### 3.2 Scenario 2 — In-campaign betrayal / split party

- **Surface the ally editor in Initiative**: GM-side "Ally list…" button on each creature
  card opening the existing selection UI (`useAllySelection.js`; reuse the
  `AllySelection` common component flow used elsewhere) so mid-session edits take seconds
  ("Grim is no longer anyone's ally"). Editable at any time — no scripted switch (D4).
- **Validation pass (spike first, fix where it fails)**: audit every ally/hostility
  consumer for hardcoded `type === 'player'` / "all PCs are allies" assumptions instead
  of `getAllyList(...)` checks. Known-good starting points: aura damage
  (`auraDamageService.js`), Redirect Attack (`monsterRedirectAttack.js`), AoE
  auto-targeting from overlays, save-prompt fan-out, opportunity-attack target selection,
  sneak-attack adjacency helpers. Any place that assumes player-creatures are mutual
  allies gets converted to ally-list checks; add regression tests for
  player-attacks-player and NPC-attacks-party-subset on an active map.
- Friendly-fire UX: when a hit targets a name in the attacker's own ally list, add a
  confirm step ("X is on your allies list — attack anyway?") in the attack lane,
  log-flagged. (Confirm is UI-local; the engine still resolves the roll.)
- Death saves and party-wellness displays must treat non-allied players honestly (a
  defector at 0 HP still gets their own prompts; healing spells restricted by ally list
  where the spell says "a creature of your choice that you can see" — do **not**
  over-restrict: healing/targeted buffs remain free-choice; only *effects that already
  consult ally lists* (auras, AoE auto-select, redirection) change).

### 3.3 Tests

- Unit: teams popover writes `selectedAllies` exactly; validation-pass conversions each
  get a targeted regression test (PvP-legal targeting, aura exempts own team, overlay
  AoE auto-select excludes allies per list); arena create seeds maps+encounters and is
  deletable like any campaign.
- Manual (test-campaign only): run a 1v1 with two characters + two hand-controlled
  monsters (Phase 2), betray mid-fight by editing ally lists, confirm targeting/auras
  flip immediately, clear combat, no XP awarded.

### Acceptance

A pickup arena night runs entirely from campaign-selection → victory banner in under a
minute of clicking; a campaign betrayal moment is a two-click ally-list edit with the
engine following immediately.

---

## Phase 4 — Starter campaign (seeded, replayable)

**Goal:** "New Starter Campaign" produces a ready-to-play, teachable sandbox with fresh
content each time, built 100% from existing generators; rerollable adventure layers so a
group can replay it without repeated content.

### 4.1 Seeded skeleton (fixed shape, rolling content)

Create via the normal create-campaign route, then run an **orchestrator service**
(`src/services/campaign/starterCampaignService.js`, server-side variant under
`server/services/` if creation perf demands — client orchestration of existing APIs is
preferred; no new data model):

1. **Seed** stored in campaign data (`data/starter-seed.json`): one hex-map terrain
   generation, settlement generation, dungeon generation, encounter picks, treasure,
   quest flavor. "Regenerate adventure" re-rolls a **new layer** (new dungeon map, new
   monster table, new treasure) into the same campaign and re-points the main quest's
   dungeon link, keeping the settlement, party, and log intact.
2. **Settlement**: existing settlement generator (village size, culture-based names,
   services, named NPCs, rumors) — plus 2–3 rumor strings referencing the current
   adventure layer's hook.
3. **Outdoor hex map**: small (e.g. 24×24) terrain-gen map with the settlement POI and a
   **dungeon POI linked to the dungeon map** (portal/enter lane already exists:
   linkedMap + adjacency `isEnterable`), party marker at the settlement.
4. **Dungeon**: BSP-generated indoor map (classic one-entrance layout), activated, with
   2–3 prop clusters and treasure pockets as placed items.
5. **Monsters**: populate from a curated **level-1 classics pool** drawn only from
   `monsters.json` by name (guaranteed present, CR-appropriate): **skeleton, zombie,
   goblin, hobgoblin, kobold, orc, giant spider, wolf, bandit, bugbear**. Each layer
   seeds a lair mix (CR budget respecting party size once characters exist; a default
   4×level-1 budget otherwise). Encounters saved into `encounters.json` as "Dungeon
   Wave 1/2/3" so the GM can tune before joining.
6. **Quests** (2–3): hook (settlement trouble → dungeon), side (missing NPC in wave 2),
   payoff (boss + treasure), generated with flavor names from the seeded generator;
   rewards mention the actual seeded loot tier.
7. **Loot cache**: loot generator run at the layer's CR band, saved as an unawarded
   "hoard" encounter reward row (or placed-item chests on the map — pick whichever the
   existing lanes support without new code; placed-item chests with `view stats` off is
   likely the shortest path).

### 4.2 First-session checklist (teaching, content-agnostic)

- Dismissible checklist panel (new `src/components/campaign-starter/` component) shown on
  campaign load when `data/starter-seed.json` exists and `starter-checklist.json`
  (per-campaign done-flags — this is UI progress, but keeping it server-side with the
  campaign is fine and survives device changes) isn't complete.
- Steps reference **current generated names** ("Defeat whatever lurks in *Blackroot
  Hollow*" → open Encounters → Join) and walk: build/print a sheet → teams/TV toggle →
  join wave 1 → move tokens through fog → short rest → read the log → award loot →
  regenerate adventure. Each step is a deep link into the right view.
- Checklist completion changes nothing mechanically (no gates) — pure onboarding.

### 4.3 Wiring

- Entry points: `New Starter Campaign` on campaign selection (alongside Arena from 3.1 —
  both call the shared seeded-create orchestrator with different presets: `starter` vs
  `arena`).
- Regenerate button lives in Campaign Admin (GM-only lane) with confirm.

### 4.4 Tests

- Unit: orchestrator produces the expected entity set against mocked CRUD (maps POI
  linkage, quests wired to the layer, monster names all resolve in `monsters.json` — a
  data-integrity test that the curated pool names exist); regenerate keeps settlement
  and bumps layer number; checklist done-flags persist.
- Manual (test-campaign): create starter, verify settlement+hex+dungeon+POI link+quests
  +encounters render; play wave 1 end-to-end on TV mode with one visitor-controlled
  monster (exercises Phases 1–3); regenerate; confirm second dungeon differs (md5
  compare); delete campaign cleanly.

### Acceptance

New users get a playable, different-but-familiar adventure in one click; veterans get a
sandbox that exercises every Level 1–4 feature; replaying means pressing one button.

---

## Cross-cutting constraints (all phases)

- **No game timers** (AGENTS.md mandate): Phase 1 floaters are the only permitted
  new `setTimeout` (animation cleanup) — add to `no-timers-guard.mjs` allowlist with
  justification.
- **Server-first**: `controller`, ally lists, maps, encounters, quests, seeds → runtime
  store / campaign JSON via existing routes. TV-mode flag and "my characters" ticks are
  local UI flags. Respect the custom ESLint rules.
- **One shared SSE connection** — all new live reads subscribe via existing hooks; never
  new `EventSource`.
- **targetEffects registry**: no new effect keys expected; if the victory/floater work
  tempts one, register in `targetEffectDefinitions.js` first.
- **Docs to update**: `docs/users-guide.md` (§3 level table gains TV/Arena/Starter
  rows, new §"TV mode", "Arena play", "Starter campaign"), `README.md` feature bullets,
  `AGENTS.md` gotchas if any new load-bearing order appears.
- **Doc-drift backlog (tiny, opportunistic, fix when touching the file)**: stale 10s
  debounce comment in AGENTS.md/`server.js`; legacy `.eslintrc.cjs` deletion (needs owner
  OK); `deleteCharacterImage` path sanitization.

## Out of scope (explicit)

- Accounts/auth/HTTPS/remote hosting (D2).
- In-app compendium browser (D7) — optional future deep-links from monster cards/spells
  into the hosted rules site.
- Level 5 conductor/solo-GM loop, enforcement on-ramp wizard — revisit after Phases 1–4
  land, per owner.
- Full automation-completeness push to drop the Alpha warning — continuous background
  track, not part of this plan.

## Suggested sequencing & sizing

| Order | Item | Rough size | Depends on |
|---|---|---|---|
| 1 | Phase 1 TV mode + floaters | S–M | — |
| 2 | Phase 2 controller delegation | M | — |
| 3 | Phase 3.2 betrayal ally-list surfacing + validation pass | S–M | — |
| 4 | Phase 2/3.1 → 3 teams popover + Arena campaign preset | M | Phases 2, 3.2 |
| 5 | Phase 4 starter campaign + checklist | M–L | shares create-orchestrator with 3.1 |

Re-analyze Level 5 after all five land.

## Verification protocol (every phase)

1. Minimal targeted Vitest files → full `npm run test:run` once green.
2. `npm run lint` (zero warnings) + `npm run guard:no-timers`.
3. Live walkthrough in **test-campaign only** (two-tab LAN check where SSE-visible),
   restore baseline fingerprints after, per `docs/app-exploration.md` conventions.
