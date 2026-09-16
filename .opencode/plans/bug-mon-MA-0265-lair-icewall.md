# BUG — MA-0265 Ancient White Dragon lair_actions[2] "Unnamed lair actions 3" (wall of ice) — FAIL (inert row)

**Date:** 2026-09-16 · **Campaign:** test-campaign · **cs idx1** "Ancient White Dragon 1", init 9, hp 333/333, round 15.

## Live evidence (Playwright + curl GET, zero mutating POSTs)
- Row DOM: `<div class="mc-action">` containing ONE plain `<span>` (full RAW prose) — `buttons:0, links:0 (a/.mc-dice-link/.mc-dice-link-lair/[role=button]), strong:0`. Raw-string fingerprint (MV-24/MA-0167: raw rows render with NO name token).
- Trusted click on row → **zero affordance, zero popup, zero refusal**, log 215→215 (curl before/after). Whole log scan: **zero** entries containing "wall" or "lair".
- Control same card same session: Freezing Burst `4d6` chip → SaveAttackAoe picker opened live ("DC 20", "Half damage on successful save", Roll Save/Dismiss) → Dismiss. Control affordance proven live; log 215→216 (picker-flow CON roll, zero HP/condition change: dragon 333/333, ElderPaladin 1/1).

## Root cause — DATA (raw-string gap)
`public/data/monsters.json` lair_actions[2] (ancient-white-dragon, ~:4731) is a RAW STRING → `isLairRowClickable` returns false at the `typeof row !== 'object'` type-gate (src/services/encounters/monsterLairActions.js:26) → `lairRowAffordance` null → static render, no chip. Same raw-string family as MA-0254/MA-0264. Self-documented scope guard: monsterLairActions.test.js:1842 asserts ancient lair[2] `typeof === 'string'` (untouched by adult fix).

## Residual — NEEDS-SUBSYSTEM (distinct from data gap)
Even if named per adult sibling template MA-0151 (`{name:'Wall of Ice', advisory:'wall_of_ice'}` — adult-white lair[2] on disk), the fix yields only an advisory chip + spell-named ability_use log; every mechanical clause stays unconsumed:
- grep `ice_wall|lair_wall_of_ice|wall_of_ice` non-test src/server: **zero hits**; `wall` in targetEffectDefinitions.js: **zero** (test :1838 asserts `lair_wall_of_ice` unregistered).
- No damageable-object model app-wide: `wall` in src = map cosmetics/LOS/drawing only (GridAndWalls, useWallDrawing, fog, SVG); zero consumers of "AC 5 / 30 hp per 10-ft section", zero push-out-of-area producer, zero keyed-replacement ("disappears when used again") state.
- Playbook §7 (:383): "exotic terrain/wall/te effects have no producers (grep)".

## Fix (if ever built)
Step 1 data-only (parity with MA-0151): name + `advisory:'wall_of_ice'` → clickable chip + record log. Step 2 needs-subsystem (out of scope): persistent wall object (per-10ft-section AC/HP, fire-vuln/5-immunities), push-on-appear, keyed replacement, `lair_wall_of_ice` te.

## Verdict
**FAIL** — inert-by-design raw-string row; no affordance, zero click effect; mechanical clauses need a wall-object subsystem with zero consumers.
