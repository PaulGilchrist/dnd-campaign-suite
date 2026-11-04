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
