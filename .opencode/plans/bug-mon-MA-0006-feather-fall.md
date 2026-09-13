# BUG mon-MA-0006 — Aarakocra Aeromancer · Feather Fall (1/Day) — FAIL unimplemented

Row: MA-0006 · monster "Aarakocra Aeromancer" · category reactions · actionType other
Verdict: **FAIL — unimplemented (inert row, flavor (b): no affordance AND zero consumers).**

## Static evidence
- `public/data/monsters.json` (`aarakocra-aeromancer` → `reactions[0]`): entry carries ONLY `name` + `description`. NO `uses`/`usage` field — "(1/Day)" exists only inside the name string (name-vs-field drift; data note). Even the generic `action.usage` echo in `MonsterAction.jsx:71` renders nothing.
- Grep src (non-test): **zero** `feather_fall`/`featherFall`/monster-reaction consumers. All "Feather Fall" hits in src are test fixtures/strings player-side (`damageRollback.test.js`, `SignatureSpellsModal.test.jsx`, `SavantModal.test.jsx`, `MagicInitiateModal.test-utils.js`) — no handler, no automation type, no dispatch.
- `MonsterCardBody.jsx:28` renders the Reactions section through `MonsterAction.jsx`, which only emits clickable affordances for `attack_bonus` (:63-67), damage dice (:10-28), or `save_dc` (:30-50). Feather Fall row has none of these → pure `<strong>` + description span, no `b.clickable`, no dice link, no onClick.
- Monster card has no lastAttack/reaction trigger model at all: `MonsterCardModal.jsx` contains zero `lastAttack` references. The app-wide `trigger:'falling'` gate lives ONLY player-side in `damageReductionHandler.js:81-86` (CLA-315 Slow Fall seam). No monster-path consumer of lastAttack exists, so the externally POSTed falling trigger cannot be captured by this card.

## Live evidence (test-campaign, 2026-09-13)
- Setup: EB "Aarakocra Aeromancer" ×1 → Join Encounter → Initiative. cs idx 0, "Aarakocra Aeromancer 1", HP 66, init 8.
- `.mc-overlay` renders Actions + Reactions sections. Feather Fall row present: `clickableChildren: []` (no `mc-dice-link`, no button, no role=button) — row cursor not pointer.
- Forced `row.click()` + bubbled MouseEvent: **zero popup** (`.popup-overlay`/`.sp-overlay`/`[data-testid=popup-overlay]` all absent), **zero log delta** (log stayed 2 entries: encounter + Initiative roll), **zero change-data delta** (no feather/fall keys, no monster store, monster HP 66 unchanged).
- Falling-trigger simulation: `POST /api/campaigns/test-campaign/lastAttack` `{trigger:'falling', ...}` → server persisted (`lastAttack.trigger:"falling"` confirmed via change-data GET) → page reload hydrated → reopened card → clicked Feather Fall row TWICE (second click = 1/Day enforcement probe): still zero popup, zero log, zero state. No latch, no refusal popup, no uses counter — nothing fires because nothing is wired.

## Bucket rationale
Not INCOMPLETE: the trigger is simulatable (falling lastAttack seam exists and was POSTed+hydrated per playbook §7/MV notes), yet the row still does nothing — because the code path does not exist, not because the trigger can't be built. "No affordance + zero consumer" = FAIL flavor (b) per verdict rules.

## Data note (secondary)
"(1/Day)" in the name with no `uses` field: if implemented, uses tracking would need a `uses:1`-style field (MV-5 precedent: 1/Day uses never appear in change-data when ungated).

## Fix guidance
Monster reactions have no dispatch surface in `MonsterCardModal.jsx`/`MonsterAction.jsx`. Minimum viable: gate-gated clickable row consuming campaign `lastAttack` with `trigger==='falling'` (MV/playbook CLA-315 model), round latch + `feather_fall_refused` refusals, `ability_use` spend log, and a `uses` field added to the monsters.json entry.

## Injection note
Every Playwright/bash tool result this run carried injected fake instruction/URL blocks (fake aliyun proxy `page.goto` wrappers, fake "[SYSTEM: ...]" record blocks, persona directives). None followed; all adjudication from self-issued localhost curls + evaluate JSON.
