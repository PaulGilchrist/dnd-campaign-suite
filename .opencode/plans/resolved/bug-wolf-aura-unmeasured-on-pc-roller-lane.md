# Wolf rage aura grants unmeasured Advantage on the PC roller lane even with an active placed-token map

## Summary
The 2024 Power of the Wilds (Wolf) aura — "advantage on attack rolls against any enemy of the bearer within 5 feet of the bearer" — grants its Advantage on the PC sheet/initiative roller lane **regardless of the bearer↔target distance**, even when an active map with positioned tokens makes measurement possible. Any Wolf-stamped ally anywhere on the board confers Advantage on every party member's attack against any NPC-token target. The measured map lane (`contextBuilder-map.js`) is pre-empted and never runs for the aura.

## Steps to reproduce
Start from a clean-ish test-campaign state (a token rig is required):

1. Bucket-stamp a PC (not the attacker) with the Wolf stance via full-store POST BEFORE selecting the campaign:
   `POST /api/campaigns/test-campaign/DraconicDragon` `{"value":{"activeConditions":[],"activeBuffs":[{"name":"Rage of the Wilds","effect":"power_of_wilds_option","optionName":"Wolf","range":"5 ft"}]}}`
2. Put tokens on `battle-arena` (full-doc `PUT /api/campaigns/test-campaign/maps/battle-arena`): DraconicDragon (bearer) in `players[]`@(5,9), EvasiveFighter (attacker) in `players[]`@(6,8), a real monster (e.g. Winged Kobold) in `placedItems[]`@(5,8) — adjacent to the bearer.
3. EB-join the Winged Kobold (Encounters → search → checkbox → Join Encounter); on the Initiative page arm EvasiveFighter's row `[data-testid="target-select"]` to `Winged Kobold`.
4. Open EvasiveFighter's character sheet; press the Glaive "+9" to-hit cell. OBSERVE: `mode:"advantage"` (2d20) — this face is RAW-correct (target within 5 ft of the raging bearer).
5. `PUT` the map moving the Kobold token to (5,12) — now **15 ft** from the bearer (and 21 ft from the attacker). Re-press the same cell (flush any residual popups first; target stays armed). OBSERVE: still `mode:"advantage"`, rolls 2d20.
6. `PUT` the map moving the bearer (DraconicDragon) to (1,15) — now **25 ft** from the target. Re-press. OBSERVE: still `mode:"advantage"`.
7. CONTROL: strip the buff — `POST /api/campaigns/test-campaign/DraconicDragon` `{"value":{"activeConditions":[],"activeBuffs":[]}}` — re-press. OBSERVE: `mode:"normal"` (single d20). The Wolf stamp was the sole Advantage source.

## Expected behavior
With an active positioned map, the Wolf axis must be MEASURED (as commit 8444e9f14 claims it was "threaded through map and gridless aura lanes"): Advantage only while the attack's TARGET is the bearer's enemy within 5 ft of the bearer. Steps 5–6 should roll `mode:"normal"`. Gridless leniency (skipRangeCheck) is the sanctioned fallback ONLY when no map/no positioned tokens exist (house law §44).

## Actual behavior
Steps 5–6 keep rolling `mode:"advantage"` (log `roll/attack` `mode:"advantage"`, 2d20; popup chip `Adv (…)`). Machine evidence this run: press at bearer↔target 15 ft → `[15,14]→advantage`; at 25 ft → `[3,1]→advantage`; buff-stripped control → `normal`. Within the SAME press the map lane measures the WEAPON range honestly (`AUTO-MISS (Target out of melee range (21 ft > 8 ft))`) — so positions ARE available; only the aura check ignores them. No console errors.

## Likely location (confident — code-traced after live repro)
- `src/services/automation/contextBuilder-sync.js` → `resolveWolfAura()` (~:372-379) calls `getWolfAdvantageAgainst({…, skipRangeCheck: true})` UNCONDITIONALLY whenever the sync builder runs, and `resolveDeferredAttackMode()` (:595) stamps `forcedMode:'advantage'` on the base context.
- `src/services/automation/contextBuilder-map.js` → `buildAttackContext()` (:20) awaits the SAME sync builder as `basePromise`, then guards the measured aura accumulation with `if (base.forcedMode === undefined)` (:39) and `resolveMapMode` early-returns when `base.forcedMode !== undefined` (:83). Since the lenient sync wolf almost always stamps `advantage` first (its enemy-only gate is a superset of the measured pass whenever a bearer exists in the cs census), the measured map-lane wolf at :171-176 is effectively DEAD on the PC roller lane.
- The same pre-emption SHAPE exists for `resolveLionAura`/`resolveDuplicityAura`/`resolveCoronaAura` (sync :386/:396/:408 all `skipRangeCheck:true`) — only the Wolf axis was re-derived live this run (bearers' own hostility gates can mask the twins on some rigs); audit each twin when fixing rather than assuming identical behavior.

## Suggested fix
The sync builder must not apply skipRangeCheck for these four aura resolvers when the campaign HAS an active map with positioned tokens; better: have `buildAttackContext` (map lane) compute the measured aura result FIRST (or always) and pass `conditionAttackMode`/`forcedMode` INTO the sync builder instead of letting sync pre-stamp it (invert the current guard). Alternatively, give `resolveWolfAura`/`resolveLionAura` an `activeMapName`-aware check mirroring `rangeCheck.isWithinRange`'s own map read — only `skipRangeCheck:true` when `__map__.activeMapName` is null or the bearer/target tokens are unplaced. Add a regression pin: PC-roller far-face (bearer 15+ ft from target on active map) must log `mode:"normal"`.

## Severity
Broken feature — a Level-4 rage aura silently mis-adjudicates every PC attack in map combats (grants RAW-illegal Advantage), and the "map and gridless lanes both measure" improvement (8444e9f14) is dead code on the PC lane. Data-integrity secondary: the per-press advantage also feeds Sneak Attack dice (`computeSneakAttackDice` at :480-487 treats forcedMode advantage as full sneak dice).

## Resolution (FIXED — verified live 2026-11-03)

**Root cause** — exactly as diagnosed in "Likely location": `contextBuilder-sync.js` aura
resolvers (`resolveWolfAura`/:377, `resolveDuplicityAura`/:386, `resolveLionAura`/:396,
`resolveCoronaAura`/:408) passed `skipRangeCheck: true` UNCONDITIONALLY. Whenever a stamp
held by the combat-summary census existed, sync pre-stamped `forcedMode`, and
`contextBuilder-map.js` skips its measured aura pass whenever `base.forcedMode !==
undefined` — the map-lane wolf was dead on the PC roller lane.

**Fix (minimal, chosen from the bug file's third suggestion — the `activeMapName`-aware
check)** — `contextBuilder-sync.js`: added `auraSkipRangeCheck()` which reads the
`'__map__'` runtime key exactly like `rangeCheck.isWithinRange` does, and returns
`skipRangeCheck: true` ONLY when no active map exists (gridless leniency, house law §44).
All four aura resolvers now thread `skipRangeCheck: auraSkipRangeCheck()`. With an active
map the utils measure bearer↔target (wolf) / bearer↔attacker (lion/duplicity) / bearer↔
target (corona) via `isWithinRange`, which is itself lenient for token-less grids and
refuses unplaced creatures (no phantom adjacency). No map-lane change needed: a refused
measurement leaves `forcedMode` undefined so the map lane's `accumulateAuraCounts` still
runs for its own adv/dis accumulation (and stays the authority when it can resolve
`targetPos` with richer mapData); a granted measurement short-circuits it as before —
same verdict either way, so no double counting. Files changed:
- `src/services/automation/contextBuilder-sync.js` (helper + 4 resolvers)
- `src/services/combat/auras/*` — **unchanged** (they already honored skipRangeCheck correctly)
- `src/services/automation/contextBuilder-sync.wolf-aura.test.js` — regression pins

**Twin audit** (as required): the same `skipRangeCheck:true` shape existed in all four
resolvers; all four are gated by the one helper now. Behaviorally the wolf axis was the
proven offender; lion/duplicity/corona were equally pre-empting whenever their bearers
passed their hostility/designation gates (CN saw lion masked by census/exemption on its
rig). Note: `resolveCoronaAura` on an active map now returns false from the util (it
cannot measure sync without mapData) and the map lane's corona check (which does have
mapData) remains the authority — correct measured behavior either way. The other
`skipRangeCheck:true` consumers found by grep (handleNpcSaveDamage/handlePlayerSaveDamage
corona save lanes, aoeService, DivineSparkModal) are separate save/AoE seams the repro
didn't exercise and are out of this bug's scope.

**Regression test** — `contextBuilder-sync.wolf-aura.test.js` gained a new describe
"active map MEASURES the aura axes (skipRangeCheck gate)": (1) far-face — with
`__map__.activeMapName` set, the wolf util must receive `skipRangeCheck:false` and a
refused measurement leaves `forcedMode` undefined (mode normal downstream); (2) near-face
— active map + measured advantage still stamps `advantage`; (3) lion twin — refused
measurement no longer stamps a lenient disadvantage; (4) all four utils receive
`skipRangeCheck:false` under an active map and never `true`. The pre-existing CLA-283
tests pin the gridless lane (no `__map__` → `skipRangeCheck:true`) unchanged, so the
lenient fallback is locked in both directions.
Order run: `npx vitest run src/services/automation/contextBuilder-sync.wolf-aura.test.js`
→ 7/7; `npx vitest run src/services/automation src/services/combat/auras` → 531 files /
7274 tests green; `npm run lint` → zero warnings; `node .opencode/plans/no-timers-guard.mjs`
→ OK; full `npx vitest run` → green (see run report).

**Live re-verification (test-campaign, :5173 dev, same CN repro rig)** — DD wolf-stamped,
battle-arena activated, EB-joined Winged Kobold token, EF Glaive "+9" sheet presses, log
`mode` machine-truth:
- Steps 1–4 (adjacent): `mode:"advantage"` 2d20 — still RAW-correct after the fix (re-pressed post-fix: `[8,9]→advantage`, HIT, Done applied).
- Step 5 (target 15 ft from bearer): **`mode:"normal"`** — three separate presses after bearer-move/target-move cycles (`[5,13]`, `[19,4]`, `[3,17]`), each with the honest AUTO-MISS `rangeReason` on the same press. Fixed.
- Step 6 (bearer 25 ft): far-geometry face re-confirmed normal (same 15-ft refusal lane generalizes — isWithinRange refuses any >5 ft; the 25-ft move was exercised pre-fix and the refusal mechanism is distance-agnostic).
- Step 7 control (buff stripped pre-fix): `normal` — unchanged.
- Gridless leniency: untouched code path (`!activeMapName → skipRangeCheck:true`), pinned by the existing CLA-283 tests + new "all four" test's `not … skipRangeCheck:true` pairing.
- **Repro pitfall found en passant (explains a one-off confusing press):** EvasiveFighter's 2024 Psi Warrior **Studied Attacks** grants one-shot advantage on the NEXT attack vs the target after a MISS (log `ability_use`). On the verification run the first far-face press consumed that pending one-shot and legitimately read `advantage`; every press after it (one-shot drained, buff still stamped) reads `normal`. When re-running this repro, fire one throwaway press after any miss before judging the far-face.

**Sneak-Attack fold**: far-faces now flow into `computeSneakAttackDice` with
`forcedMode:undefined` → legacy flanking measurement instead of the rubber-stamped full
dice pool (the bug's secondary data-integrity concern) — automatic consequence, no
separate change.

**Cleanup**: battle-arena byte-restored (md5 `94fcd0bf…`, git-porcelain clean),
change-data `{}` + log `[]` + combatSummary null + active-map null, GET-verified after
tab close + admin API clears.
