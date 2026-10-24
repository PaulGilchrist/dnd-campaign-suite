# Player (LAN, non-localhost) client can hijack initiative — Next/Prev/+NPC/Clear write to server

## Summary
On the non-localhost player view, the Initiative page exposes fully-enabled **Clear / + NPC / ← Prev / Next →** (and Loot) buttons, and Next actually performs the complete GM turn-advance write cascade against the server. Any network client can seize turn control and mutate shared combat state — violating the documented invariant "GM features are localhost-only; network clients get read-only view."

## Steps to reproduce
1. Run `npm run dev`. GM works on `http://localhost:5173` in `test-campaign`.
2. GM: Encounters → search "Bandit" → check Bandit → Join Encounter (initiative now has Bandit + 12 PC placeholders, round 1).
3. Open the player view on the LAN URL (e.g. `http://100.92.171.80:5173`), select `test-campaign`, click **Initiative** in the sidebar.
4. Observe: `Next →`, `← Prev`, `+ NPC`, `Clear`, `Generate Loot` buttons are all rendered and **enabled** (no `[disabled]`).
5. Click **Next →** as the player.
6. GET `/api/campaigns/test-campaign/activeCreatureName`.

## Expected behavior
Per app architecture (AGENTS.md "GM features are localhost-only"; same pattern as the fog-write localhost gate in `Map.jsx:234` / fix 790286e7d), the player client must not mutate initiative state — controls should be hidden/disabled on non-localhost, and ideally the server should reject turn-admin writes from player sessions.

## Actual behavior
Player click advanced the shared turn and persisted server-side:
- `activeCreatureName` moved `Disciplined_Monk` → `DivinationWizard` (GET-verified).
- Network from origin `100.92.171.80`: `POST /api/campaigns/test-campaign/combatSummary` (200, ×2), `POST /activeCreatureName` (200), `POST /__initiative__` (200), `POST /lastAppliedTurnStartCreature` (200) — the entire GM turn-turnover cascade, including turn-start effect stamps.
- Contrast control lane: the same player tab authored ZERO map writes post-fog-fix — initiative simply has no equivalent gate.
Verified live 2026-10-24 on the current dev build.

## Likely location
- `src/components/initiative/Initiative.jsx` — Prev/Next/Clear/+NPC handlers are rendered without an `isLocalhost` guard (confident: player DOM shows them enabled; writes match the handler cascade). Sidebar already threads `isLocalhost` into nav items (`Sidebar.jsx` NAV_ITEMS `localhostOnly`), but `initiative` nav is deliberately visible to players — the page itself never gates its mutating buttons.
- Server `server/routes/` (combatSummary / change-data writers) has no localhost/role gate (except the CAMPAIGN_LOCK when `dev:locked` runs — which does not distinguish player vs GM on the same campaign).

## Suggested fix
Hide or disable the mutating controls on non-localhost (`isLocalhost && <controls>`, mirroring the map toolbar gating that already strips Paint/Erase/Select for players), so players see only the read-only board + their own interaction lanes (Target select etc. as product decides). A defense-in-depth follow-up: gate `POST /combatSummary`, `/activeCreatureName`, `/__initiative__`, `/lastAppliedTurnStartCreature` server-side behind a localhost (or GM-token) check, same spirit as the campaign-lock 403.

## Severity
Data integrity risk — a connected player (or their kid, or any LAN device) can silently walk initiative forward/backward, spawn/clear combatants, and fire turn-start automation, corrupting everyone's live combat state with no GM feedback.

## Resolution
FIXED 2026-10-24. Reproduced live first: LAN tab (`http://192.168.0.239:5173`, en0) on `test-campaign` Initiative rendered all four control-row buttons + Loot enabled, and **Next →** fired the full cascade (`POST /combatSummary` ×2, `/activeCreatureName`, `/__initiative__`, `/lastAppliedTurnStartCreature`, all 200; `activeCreatureName` `AasimarTest` → `AberrantSorcerer`).

**What was actually wrong (more than the original guess).** Four ungated lanes, not just the buttons:
1. `Initiative.jsx` `.combat-controls` — Clear/+NPC/← Prev/Next →/End Turn rendered for everyone.
2. `Initiative.jsx` global **keydown** lane (ArrowRight/ArrowLeft/`+`) registered on every tab — a hidden-button player can still walk the tracker with the keyboard.
3. `Initiative.jsx` **mount auto-write** — opening the page POSTed the merged combatSummary (and seeded round/`activeCreatureName` when empty) from ANY tab: the same player-tab-clobbers-GM-authorship family as bug-player-clients-clobber-fog-reset.
4. `CreatureCard.jsx` — found during live re-verify: the NPC **MonsterNameAutocomplete** and the **initiative number input** were editable on LAN tabs (a stray `+` keystroke really renamed the joined Bandit → `Bandi+t` and POSTed combatSummary ×2 through `handleNameChange`, disk-verified). `CardName`/`InitiativeControl` were the two exceptions in an otherwise fully `isLocalhost`-gated card prop flow.

**Fix (mirrors the established gates — no new architecture).**
- `src/components/initiative/Initiative.jsx` — `{isLocalhost && …}` strips the whole `.combat-controls` row (incl. End Turn + AiDirectorPanel, which self-gates) and the `InitiativeLoot` panel (Generate/Award are XP/party-inventory writes and the panel never reaches players anyway), mirroring `MapToolbar.jsx` Paint/Erase/Reset strip; keydown handler early-returns `if (!isLocalhost)` (Map.jsx:234 fog-guard style); mount effect POSTs (`storage.set('combatSummary'|'activeCreatureName')`) only on localhost, local setState stays unconditional so players still mirror via SSE.
- `src/components/initiative/CreatureCard.jsx` — `CardName`: npc autocomplete replaced by plain name span on non-localhost; `InitiativeControl`: `disabled={!isLocalhost}` (same pattern as `TargetSelect`'s existing disabled gate, keeps the value visible).
- `src/components/initiative/createCreatureHandlers.js` — dead `_isLocalhost` param activated: `handleInitiativeChange` + `handleNameChange` early-return for LAN clients (handler closes behind the UI).
- `server/validation/keyValidators.js` — defense-in-depth via the EXISTING `validateAuthority(..., engaged=true)` chokepoint pattern (mirrors the `'__map__'` GM-owned row): `activeCreatureName` + `lastAppliedTurnStartCreature` refused from non-localhost hosts (400 + SSE `denied` + persistent `enforcement_denied` audit log, all pre-existing machinery). `combatSummary` intentionally NOT gated — honest player tabs legitimately write target-select into it; `__initiative__` intentionally NOT gated — every tab stamps the idempotent SSE-echo dedupe key at `sseHandlers.js:87`.
- Dual-ruleset: Initiative UI + keyValidators are ruleset-agnostic (shared by 5e and 2024) — no twin module needed.

**Verification.**
- Live LAN re-run: player tab shows NO `.combat-controls`, NO loot panel, 0 editable name inputs, 13/13 disabled initiative inputs, board + SSE mirror intact (13 cards); ArrowRight/ArrowLeft/`+` attempts produced ZERO turn-admin POSTs and `activeCreatureName` never moved.
- Live server backstop (production-faithful, direct `:80` with LAN Host header — the dev Vite proxy `changeOrigin:true` rewrites Host to localhost and masks origin, a pre-existing property of every localhost gate here): forged `activeCreatureName`/`lastAppliedTurnStartCreature` ⇒ **400** "only localhost (the GM)…", target-select + character-store lanes ⇒ 200.
- GM localhost sanity: all controls present/enabled, Next advanced `AberrantSorcerer→Disciplined_Monk`, Prev rewound back, +NPC spawned NPC 1, Clear renamed joined monsters NPC N + reseeded round 1 (documented semantics).
- Tests: new `src/components/initiative/initiative.localhost-gate.test.jsx` (6: controls/loot/keydown/mount-write lanes per origin) + LAN-lane pins appended to `createCreatureHandlers.test.jsx` (2) and `campaigns-changedata-l5-validation.test.js` (5). `npx vitest run src/components/initiative/` ⇒ 59 files / 435 pass; `server/routes/` ⇒ 49 files / 1039 pass; `npm run lint` ⇒ 0 errors 0 warnings; `guard:no-timers` ⇒ OK (no timers added).
- Cleanup: GM Clear ran, Admin cleared change-data (`{}`) + log (`[]`) GET-verified; `combatSummary`/`activeCreatureName` back to `value:null`; all repro residue (incl. `Bandi+t`, `Mallory`) wiped; tabs left quiet; dev servers left running.
