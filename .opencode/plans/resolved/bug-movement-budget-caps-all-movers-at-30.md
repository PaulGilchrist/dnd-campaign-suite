# Movement-budget engine caps every mover at 30 ft — sheet speed (feat/mount bonuses) and monster speed are never threaded to the map drag lane

## Summary

With enforcement `movementBudget` on, the token-drag budget resolves the mover's speed from `player.speedFeet` on the map token, but nothing in the map layer ever sets `speedFeet` on tokens — so every mover (players, monsters, NPCs) is capped at `DEFAULT_SPEED_FEET = 30` regardless of actual sheet speed. Meanwhile the Initiative HEADER economy strip resolves real sheet speed, so the same creature is shown "30/40 ft — 10 ft remaining" while a 10-ft drag is refused as out of movement.

## Steps to reproduce

Fixture-surgery variant (sanctioned): temporarily grant the 2024 **Speedy** feat (+10 ft speed) to `EvasiveFighter.json` `feats[]`, reload, restore at exit.

1. In test-campaign, `POST /api/campaigns/test-campaign/enforcement {value:{mode:'on',opportunityAttacks:true,actionEconomy:true,movementBudget:true}}`; select the campaign; EB-join Goblin/Wolf/Gazer; hand-board via full-store `combatSummary` POST; sandbox map created and activated with EvasiveFighter token at (6,4).
2. Give EF a fresh budget: `POST /turnState {value:{}}` (or delete the key) and let the mirror settle ~3.5 s.
3. Open Initiative: EF's **card** economy strip reads `... 30/30 ft`; with `activeCreatureName=EvasiveFighter` the **header** strip reads `EvasiveFighter|...|30/40 ft` (true sheet speed 40 after Speedy — the +10 derives into `computedStats.speed`).
4. On the active map, trusted-drag EF (cell-stepped mouse drags):
   - From 30/30 used: a 2-cell (10 ft) drag — the header says 10 ft remain — is refused: sticky toast "EvasiveFighter cannot move — no movement left this turn." + `enforcement_denied` bucket:movement row "(0 ft this move)."
   - With a fresh budget (used 0, sheet speed 40): a 7-cell (35 ft) drag CLAMPS at 30 ft — lands after 6 cells, toast "EvasiveFighter snapped back to 30 ft of movement." + turnState `movementUsedFeet:30`.

## Expected behavior

The movement budget ceiling for a mover equals its derived game speed (sheet `computedStats.speed` for players — the same number the Initiative header strip already displays and the same number a monster's stat block authors, e.g. Wolf = 40 ft). A 40-ft creature gets 40 ft of budget per turn; displays and engine agree.

## Actual behavior

- Drag lane: every mover is capped at 30 ft even when sheet speed is 40 — legal movement is silently refused/clamped by enforcement.
- Per-card `TurnEconomyStrip` denominator: always 30 for every creature type. Witnessed live: Wolf card strip "0/30 ft" (actual speed 40), EF card strip "30/30 ft" while the header strip beside the same board reads "30/40 ft".
- Header strip alone is honest (looks up `characters.computedStats.speed`) — which is what makes the divergence visible and provable on one screen.

## Likely location

Confident (code read + live differential):

- `src/components/map/hooks/usePlayerDragging.js:52` and `:134` — `Number(player.speedFeet) > 0 ? Number(player.speedFeet) : DEFAULT_SPEED_FEET`; `src/components/map/hooks/useSelectMove.js:57` same pattern.
- `src/components/map/Map.jsx:315` passes raw `mapData` to `usePlayerDragging`; map player tokens carry only `{id,name,gridX,gridY}` (owner fixture battle-arena.json) — grep `speedFeet[:=]` app-wide finds ZERO producers that ever stamp it on a token, so the ternary always falls to 30.
- `src/components/initiative/CreatureCard.jsx:671` passes `speedFeet={creature.speed}` — combatSummary rows have no `speed` field for players (mount-merged keys: name/type/initiative/armorClass/maxHitPoints/currentHp/targetName/concentration) NOR for EB-joined monsters (join writes no speed key — verified live GET). Only `Initiative.jsx:799` (header) resolves `characters.find(...).computedStats.speed`.

## Suggested fix

Resolve speed once at the map layer from the same source the header strip uses: when building/annotating players for `usePlayerDragging`/`useSelectMove` (Map.jsx already has `characters` in scope), stamp `speedFeet` from `computedStats.speed` (fallback `speed`, fallback 30). For monsters, either thread the bestiary `speed` through the EB join into the cs row (and use it for both the card strip and, when NPC-token dragging grows a budget, the drag lane) or resolve from `monsters.json` by name. Also pass the resolved speed to `CreatureCard`'s `TurnEconomyStrip` (the `effectSubjectName`-resolved character is already available there). Fix run should keep the header lane bytes untouched and pin: Speedy-40 mover gets 40 ft budget; card denominator equals header denominator for the same creature.

## Severity

Broken feature (enforcement correctness): the L5 movementBudget gate denies legal game movement for every creature faster than 30 ft (Speedy feat, mounts, many monsters), while simultaneously the per-card readout misreports the budget (data-honesty of the readout). Display + engine divergence witnessed live on one screen.

## Resolution

FIXED 2026-11-09 (fix run, live-verified in test-campaign on `npm run dev:locked`).

### What was actually wrong

The original diagnosis was correct on the engine lane but missed one layer:

1. **Drag lanes read a field no producer writes.** `usePlayerDragging.js:52/:134` and `useSelectMove.js:57` resolved the mover's ceiling from `player.speedFeet` on the map token; tokens only ever carry `{id,name,gridX,gridY}`, so the ternary always fell to `DEFAULT_SPEED_FEET = 30`.
2. **The map layer's `characters` lane was the RAW list, not the derived one.** Threading `characters` into the hooks was necessary but NOT sufficient — `App.jsx` renders `MapsAreaView characters={characters}` (raw JSON, no `computedStats`) while Initiative/CharSheet get `computedCharacters` (`{...character, computedStats}`). The first post-fix live drag STILL clamped at 30 until `MapsAreaView` was switched to `computedCharacters`; the feat/mount +10 only exists on the derived list (the fixture authors no top-level `speed` at all). This was the real root cause one level under the suggested fix.
3. **Monster rows carried no speed byte.** Both EB-join builders wrote rows without `speed`, so the per-card `TurnEconomyStrip` (fed `speedFeet={creature.speed}`) fell to 30 for every row type. Note the store contract already EXPECTED a numeric feet `speed` on cs rows — `executeAttackRider.applyManeuveringAllyGrant` reads `ally?.speed || 30` — the join simply never stamped it.
4. **Header-when-monster-active** (witnessed again live this run): the header IIFE resolved only `characters` (miss for monsters) → 30 beside a Wolf card. The bug file asked to keep header bytes untouched, but "card denominator equals header denominator for the same creature" cannot hold for a monster-active board without it; the header now calls the shared resolver, whose PLAYER result is byte-identical (explicit row speed is absent on player rows → sheet lane → authored speed → 30).

### Fix (single shared resolution, mirrored patterns, no new architecture)

- `src/services/combat/turnState.js` — new exports `resolveSpeedFeet(mover, characters)` (token `speedFeet` / row `speed` → sheet `computedStats.speed` → authored `speed` → `DEFAULT_SPEED_FEET`, name taken as `name || id` — same identity law as the charge writers) and `monsterSpeedToFeet(monster)` (bestiary modes dict `{walk:"40 ft."}` → feet; walk first, other modes as honest fallbacks; null when unauthored — never a fabricated number).
- `src/components/map/hooks/usePlayerDragging.js` / `useSelectMove.js` — accept `characters` and route both budget read sites through `resolveSpeedFeet`; `Map.jsx` threads its existing `characters` prop into both hooks.
- `src/App.jsx` — `MapsAreaView` now receives `computedCharacters` (same list Initiative's header/gate lanes use).
- `src/services/encounters/encounterToInitiative.js` — BOTH join builders stamp `speed: monsterSpeedToFeet(monster)` onto npc rows (unconditional key, `null` = honest unknown, same idiom as `size`/`monsterIndex`).
- `src/services/encounters/initiativeService.js` — `applyNpcMonsterData` (the +NPC/rename monster-sync lane) keeps `speed` in sync with the matched bestiary block, mirroring the MN-015 `monster.size || creature.size` idiom.
- `src/components/initiative/CreatureCard.jsx` — the per-card strip denominator resolves via `resolveSpeedFeet({ speed: creature.speed, name: effectSubjectName }, characters)` (ST holder-remap included).
- `src/components/initiative/Initiative.jsx` — header strip `speedFeet` now calls the same resolver (player result unchanged; monster-active rows resolve through the join-stamped speed).

Dual-ruleset: every touched module is ruleset-agnostic; `computedStats.speed` derivation already runs in both rulesets (Speedy is 2024 and derived live during verification). No `speedFeet` is ever persisted to disk — tokens/map documents are byte-untouched by the fix (annotation is read-time only), so the persistence race pinned by `usePlayerDragging.movement-budget.test.js` is preserved (all its cases stay green).

### Verification

- **Repro re-run (browser, test-campaign)**: pre-fix, all bug-file faces reproduced verbatim — 35-ft drag CLAMPED at 30 (token landed (12,4) from (6,4), toast "snapped back to 30 ft of movement.", turnState `movementUsedFeet:30`); the 10-ft drag the header said was legal FULL-BLOCKED ("cannot move — no movement left this turn." + "(0 ft this move)." row); card "0/30 ft" vs header "0/40 ft". Post-fix, same rig: 35-ft drag lands RAW at 35 ft billed zero toast; the 10-ft drag at 5-remaining CLAMPS at the true 40-ft edge ("snapped back to 5 ft of movement.", row "(5 ft this move)."); full block only at genuinely-empty budget; header "0/40" == card "0/40" for EF; EB-joined Wolf cs row carries `speed:40` (GET-verified) and Wolf CARD strip reads 0/40; with Wolf ACTIVE the header strip also reads 0/40 (was 0/30).
- **New regression tests** (all passing): `src/services/combat/turnState.speed-resolution.test.js` (resolver precedence + bestiary parser), `src/components/map/hooks/usePlayerDragging.speed-resolution.test.js` (40-ft ghost edge, raw 40-ft drop, ex-full-block leg now legal, 30-ft default for unknown movers, token `speedFeet` still wins), `src/services/encounters/encounterToInitiative.speed-thread.test.js` (both join arms stamp 40; string/number shapes; null for unauthored; fly-only fallback), `src/components/initiative/CreatureCard.turn-economy-speed.test.jsx` (card denominator 40 via sheet, via row stamp, via ST holder, honest 30 for bare +NPC), plus a wiring pin in `Map.test.jsx` (both move hooks receive `characters`) and the two `encounterToInitiative.test.js` byte-exact pins updated for the intentional new `speed` row byte.
- **Folder suites**: `src/components/map` + `src/components/initiative` 189 files/1640 tests green; `src/components/initiative` + `src/services/combat` 280/3869 green; `src/App*` + Map.test 11/11 green. Full `npm run test:run` — 3172 files / 34,365 passed (+3 expected-fail), exit 0; `npm run lint` — zero warnings.
- **Exit hygiene**: Speedy fixture surgery restored (EF md5 `0df29ff3…` byte-exact, 16 feats no Speedy, API GET re-proved), sandbox map `fix-mb` deactivated+deleted (GET 404, 4 owner fixtures back, battle-arena md5 `94fcd0bf…` untouched), change-data `{}` + log `[]` GET-verified after closed-browser admin clears, campaigns/ = 5 baseline folders.

### Known remaining faces (out of scope, unchanged behavior)

- Summoned-monster rows (`monsterSummon.buildSummonedCreature`, `primalCompanionHandler`) build cs rows without `speed` — same display face, one-line stamp if a future run rides it.
- NPC-token drag still never charges movement (`useItemDragging` has no budget lane) — the exploration-doc PT1 priority target, unchanged by this fix.
