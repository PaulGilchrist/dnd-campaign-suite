# Corona of Light save-Disadvantage ignores the authored 60 ft "in the Bright Light" range

## Summary
Corona of Light (`sunlight_aura`, authored range "60 ft") applies Disadvantage to Fire/Radiant saving throws of targets that are far outside the aura — even on an active map where both bearer and victim token positions are known and measurable. Every runtime consumer hardcodes `skipRangeCheck: true`, so the measurement branch that exists in `getCoronaSaveDisadvantage` is dead code: the aura is effectively unlimited-range whenever the damage type matches and the victim is on the bearer's (empty = all) enemy list.

## Steps to reproduce
1. In `test-campaign`, activate the Battle Arena map (Maps → Activate "Battle Arena").
2. Put the bearer token and victim token > 60 ft apart on the grid (5 ft/cell): `PUT /api/campaigns/test-campaign/maps/battle-arena` with full doc including `players: […baseline trio, {id:'elderpaladin', name:'ElderPaladin', gridX:5, gridY:5}]` and `placedItems: [{id:'koboldprobe', name:'Winged Kobold', gridX:18, gridY:5, …}]` → separation = 13 cells = 65 ft.
3. Stamp the bearer's aura: `POST /api/campaigns/test-campaign/ElderPaladin` `{"value":{"activeBuffs":[{"name":"Corona of Light","effect":"sunlight_aura","enemiesDisadvantageSaves":["Radiant"],"distance":"60 ft"}]}}`.
4. Encounter Builder → join a Winged Kobold.
5. Select War_Cleric → `.attacks` row "Sacred Flame" (Radiant DEX save) → `Cast Spell` popup button.
6. Read the NPC inline save popup and `change-data.lastAttack`.

## Expected behavior
Per the authored class text ("Your enemies **in the Bright Light** have disadvantage on saving throws against ANY spell that deals fire or radiant damage", 60 ft), a victim at 65 ft with both positions measurable on the active map must NOT get Disadvantage. The `!skipRangeCheck` branch (coronaAuraUtils.js:54-59, `isWithinRange(player, target, 60)`) should gate it.

## Actual behavior
The save pays Disadvantage at 65 ft:
- Inline popup: `✓ SAVE SUCCESS (18 vs DC 15) (d20 15 + 3) [Disadvantage]`
- Machine truth in `change-data.lastAttack`: `d20Rolls: [18, 15]` (2d20, lower kept → 15), and the `save-damage` log row: `"saveRawRolls":[18,15],"forcedMode":"disadvantage"`.
Zero measurement happens despite an active map with positioned tokens for both creatures.

## Likely location
Confident (source read + live):
- `src/hooks/combat/handlers/handleNpcSaveDamage.js:110` — `skipRangeCheck: true` hardcoded.
- `src/hooks/combat/handlers/handlePlayerSaveDamage.js:~111` — same.
- `src/services/rules/combat/aoeService.js:44 & :103` — `getCoronaSaveDisadvantageSync({…, skipRangeCheck: true})`; the sync lane returns `{disadvantage:false}` WITHOUT the flag, so even flipping the callers can't measure there (needs a positional sync path or async conversion).
- `src/components/char-sheet/modals/divine/DivineSparkModal.jsx:161` — same sync-lane call.
- `src/services/combat/auras/coronaAuraUtils.js:41-65` — the measured branch exists but is unreachable from all 4 consumers.

## Suggested fix
Stop passing `skipRangeCheck: true` when an active map with positioned tokens exists (mirrors how the wolf/lion attack lanes consult-and-fork: measured on map, lenient gridless). The async handlers can call `isWithinRange` directly — `skipRangeCheck` should only short-circuit the tokenless/gridless case, not the positioned case. For the sync lane (aoeService, DivineSparkModal) either resolve the aura BEFORE the non-awaitable seam (precompute on the caller that can await) or add a sync token-position comparator (`isDistanceInRange(getDistanceFeet(a,b), 60)` already exists in `rangeCheck.js`). Note `isWithinRange` returns FALSE for unplaced creatures once the map tracks positions — so the fork must be "no active map / no positioned tokens → lenient (current behavior)", not merely "flag off".

## Severity
Broken feature — an aura gate that is authored, documented in the buff tooltip ("60 ft"), and enforceable on the map is silently unenforced; GMs get wrong save odds for out-of-aura victims (and the machine-truth `forcedMode` misleads any downstream audit). Adjacent auras (wolf 5 ft / lion 5 ft) DO measure+fork honestly on the same lane — corona is the outlier.

## Resolution
FIXED 2026-11-04 (subagent run, live-verified both faces + gridless lenient + 60 ft boundary).

**What was actually wrong** (matches the black-box diagnosis, with one correction): all four runtime consumers hardcoded `skipRangeCheck: true`, making the measured branch in `getCoronaSaveDisadvantage` dead code. The bug file's "Suggested fix" premise that the aoeService seam is non-awaitable turned out to be only half-true — `handleAoeDamage` IS async (it already awaits `readAoeContext`), but `processAoeNpcs`/`sendAoePlayerSaves` are sync functions, so the sync lane stays sync and was given real measurement instead of pre-await restructuring. Additionally, simply flipping the flag could never have worked: with no `mapData` (both async handlers) the util short-circuited `{disadvantage:false}` before ever pooling bearers, and the sync lane returned false without the flag.

**Fix — the range fork now lives INSIDE the util** (consumers just stop force-skipping; single source of truth, mirrors the wolf/lion consult-and-fork convention in `contextBuilder-map.js accumulateAuraCounts`):
- `src/services/combat/auras/coronaAuraUtils.js` — removed the `skipRangeCheck` escape hatch entirely from both exported functions. New `coronaBearerReaches` (async): no active map → lenient; else load the active map document (`loadMapData`, same read path as `isWithinRange`) and only when BOTH bearer and victim tokens are positioned measure bearer↔victim via `isWithinRange(bearer, target, parseInt(buff.distance) || 60)`; unplaced pair members stay consulted-and-passes LENIENT (phantom/tokenless targets cannot be gated — house law; intentionally distinct from `isWithinRange`'s "unplaced → false" attack-range law). `getCoronaSaveDisadvantageSync` gains real sync measurement from the caller-threaded `mapData` using `isDistanceInRange(getDistanceFeet(bearer, victim), rangeFt)`; bearer pooling semantics unchanged. Type-gate moved before the range fork (identical results, skips map loads on non-Fire/Radiant saves).
- `src/hooks/combat/handlers/handleNpcSaveDamage.js`, `handlePlayerSaveDamage.js` — dropped `skipRangeCheck: true`.
- `src/services/rules/combat/aoeService.js` — `processAoeNpcs`/`sendAoePlayerSaves` accept `mapData` and thread it to the sync util (no flag). `resolveNpcSaveDisadvantage` converted to object arg (max-params lint).
- `src/hooks/combat/handlers/handleAoeDamage.js` — builds `mapData = { players, placedItems: npcs }` from the live `readAoeContext` map document and threads it to both lanes. **Bonus fix discovered en route:** line 33 called `processAoeNpcs` with 11 POSITIONAL args while the service destructures a single object (stale caller — the overlay NPC-save lane would have thrown on any map-targeted NPC save cast); call normalized to the object shape.
- `src/components/char-sheet/modals/divine/DivineSparkModal.jsx` — `handleHarm` is already async (30 ft gate), so the sync-lane call was pointless: switched to `await getCoronaSaveDisadvantage(...)` (measured + lenient fork for free).

**Dual-ruleset:** consumers/util are ruleset-shared (no 2024 twin) — one fix covers both.

**Tests** (`npx vitest run` green):
- `src/services/combat/auras/coronaAuraUtils.test.js` — rewritten contract + new regression describe "60 ft range gate regression": async lane measures on positioned map (65 ft → `{disadvantage:false}`, `isWithinRange('ElderPaladin','Winged Kobold',60)` called), in-range grants, tokenless victim/bearer → lenient-unmeasured, no active map → lenient without any map load, map-fetch failure → lenient; sync lane measures mapData tokens (65 ft false / exactly-60 ft true / gridless-lenient). Stale pins updated (no-grid now pools from combat summary; conservative-false pin replaced). 41 tests.
- `src/services/rules/combat/aoeService.test.js` — new face: threaded mapData 65 ft victim NOT disadvantaged, 60 ft twin is.
- `handleNpcSaveDamage.advanced.test.js`, `handlePlayerSaveDamage.advantage-disadvantage.test.js`, `useLoggedDiceRollDamage.save-disadvantage.test.js`, `DivineSparkModal.test.jsx` — pins flipped: callers must NOT pass `skipRangeCheck`; DivineSpark mock/expectations moved to the async util.
- Touched-area runs: `src/hooks/combat` + `src/services/combat/auras` + `src/services/rules/combat` = 2639 passed (290 files); `src/services/automation` + divine modals = 7268 passed (532 files). `npm run lint` zero warnings. `node .opencode/plans/no-timers-guard.mjs` OK.

**Live re-verification (Playwright, test-campaign, Battle Arena, EP token (5,5), buff `sunlight_aura` Radiant "60 ft", War_Cleric → Sacred Flame, machine truth = `lastAttack`/save-damage log):**
- PRE-fix repro: kobold token (18,5) = 65 ft → popup `(d20 15+3) [Disadvantage]` class, `saveRawRolls:[13,5]`, `forcedMode:"disadvantage"` — bug confirmed exactly as filed.
- POST-fix face A (65 ft, measured): popup `(d20 5 + 3)` with NO `[Disadvantage]`, `forcedMode:"normal"` ✓ EXPECTED.
- Face B (boundary 60 ft, token (17,5), measured): `[Disadvantage]`, `saveRawRolls:[15,11]` (kept 11), `forcedMode:"disadvantage"` ✓ in-range still pays.
- Face C (gridless — map deactivated): `[Disadvantage]` granted (consulted-and-passes lenient = pre-fix behavior preserved) ✓.
- Sync-lane sanity: DivineSparkModal static-import + zero console errors across the session (no test-campaign character actually holds the Divine Spark feature, so its live face is unit-locked instead — 5 component tests on the new async lane); aoeService threading locked by its new vitest face + `useLoggedDiceRollDamage.aoe-overlay.test.js` green.
- Cleanup: change-data `{}` + log `[]` + no active map re-verified from a closed browser; battle-arena.json byte-restored from its dist twin (md5 94fcd0bfe9e4cf6e1118f736b920e7a2 == baseline fingerprint); zero campaign-lock denials.
