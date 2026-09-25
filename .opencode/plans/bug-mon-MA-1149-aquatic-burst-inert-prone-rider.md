# Bug — MA-1149 Merfolk Wavebender "Aquatic Burst": Prone hit rider inert (FAIL(a)/DATA)

## Title
MA-1149 Aquatic Burst — "If the target is a Large or smaller creature, it has the Prone condition" hit rider never applied (unauthored `hit_conditions`); numeric attack/damage axis byte-exact.

## Overview
Verified 2026-09-25 (test-campaign, Playwright E2E live fire + source grep + read-only GETs). Fresh run, not trusted from MA-1148 context: numeric axis re-confirmed byte-exact standalone on this row (ONE "+7" chip, "3d10 + 4" Cold, |hpΔ|==fd), but the Prone-on-hit rider is fully inert — zero condition logs, victim change-data KEY-ABSENT, disk/store `hit_conditions`/`hit_target_effect`/`hit_condition_roll` ALL ABSENT. Live transport seam exists and works for authored rows (§449 codified 2026-09-24: raw manifest `conditions` has ZERO attack consumers; hit-clause transport = `hit_conditions`/`hit_target_effect`/`hit_condition_roll`). MA-1141 (Mastiff prone rider, identical shape) already codified FAIL(a)/DATA — this is its twin.

## Expected Behavior (row)
> "Melee or Ranged Attack Roll: +7, reach 5 ft. or range 60 ft. Hit: 20 (3d10 + 4) Cold damage. If the target is a Large or smaller creature, it has the Prone condition."

monsters.json merfolk-wavebender actions[1] (index "aquatic-burst"): `attack_bonus:7`, `reach:"5 ft."`, `range:"60 ft."`, `damage_dice_primary:"3d10 + 4"` Cold, `save_dc:0` decoy. Prose carries `<strong>Prone</strong>` in `description` but NO `hit_conditions` / `hit_target_effect` / `hit_condition_roll` authored. Bandit is Medium → "Large or smaller" RAW-true; prone must be granted to victim on hit.

## Actual Behavior
- Numeric axis exact: ONE "+7" chip on the row, zero DC chips. Press 1 = HIT 21 vs AC 12 (nat 14); defender overlay "✓ HIT (21 vs AC 12)" → Done. Toast `3d10 + 4: 3, 5, 2 +4` → **14**; `14 damage applied to Bandit 1 — HP: 99 → 85`; |hpΔ| = 14 == fd. change-data `lastAttack`: `damageFormula:"3d10 + 4"` (byte-exact), `damageType:"Cold"`, `rolls:[3,5,2]`, `rawDamage:14`, `actualDamage:14`, `damageApplied:true`, `targetAc:12`, `total:21`. Log: "Aquatic Burst → Bandit 1 / Cold / 3d10 + 4 (3, 5, 2) 14" + "Bandit 1 Takes Damage −14 HP Cold".
- Prone rider inert: post-hit victim change-data — **"Bandit 1" KEY ABSENT entirely** (no `activeConditions`, no `activeConditionMeta`); whole-store `/prone/i` = false; `hit_conditions|hit_target_effect|hit_condition_roll` grep across store = false. Whole-log GET grep `/prone/gi` = **0 matches** (2275 bytes). Bandit 1 initiative-row/card: zero condition badges. Zero observable grant, ever.

## Steps to Reproduce
1. localhost:5173 → test-campaign (verify header) → Encounter Builder → check "Merfolk Wavebender" + "Bandit" → Join Encounter (both join initiative: Wavebender Init 16+4, Bandit 1 Init 7).
2. Rig Bandit 1 max+current HP 99 via trusted keyboard (spinbutton select-all/type/Tab); set Wavebender 1 Target combobox → Bandit 1; arm AFTER rig.
3. Open Wavebender stat card → Aquatic Burst row → press "+7" chip (nat≥5 vs AC 12 hits) → close defender overlay via Done before any attacker-side Done (§448).
4. Inspect victim: no Prone in activeConditions (key absent), no condition log, no badge — rider never fires.

## Likely Location
`public/data/monsters.json` data gap (not resolution code):
- Transport live: `MonsterCardHelpers.js:648-661` `buildHitConditionClause` reads ONLY authored `action.hit_conditions` / `hit_target_effect` / `hit_condition_roll` (keys absent on this row → clause null); armed at `MonsterCardModal.jsx:873` (`hitClause: buildHitConditionClause(action)`); consumer `applyHitClauseConditions` at `handlePlainDamage.js:543` (canonical activeConditions write + condition log + badge meta).
- No prose parser can substitute: the only description-text condition extractor `extractConditionsFromSaveEffect` is applied to `action.save_effect` only (`MonsterCardModal.jsx:580`, `:1012`) — never to attack `description`; this row's `save_dc:0` keeps the save path disarmed entirely.
- Row twin precedents: MA-1141 Mastiff (prone rider, FAIL(a)/DATA codified); grapple-row twins ma0801/ma0812/ma0930 tests document "reads hit_conditions key only, prose inert".

## Fix
One field on disk row: `hit_conditions:["prone"]` on merfolk-wavebender actions[1]. No escape_dc authored (RAW = no save; prone persists per normal rules). Consumer grants via badge meta automatically; re-fire to verify `activeConditions:["prone"]` + condition log + badge on hit.

## Notes
- Gridless size-gate moot: no tokens on a grid; `isLargeOrSmallerTarget` (handlePlainDamage.js:520) is ram-clause-specific — Bandit Medium passes RAW "Large or smaller" regardless; gating is not the failure cause.
- `range:"60 ft."` melee-or-ranged 60 = advisory only (gridless, MA-0672 reach-first family; `rangeReason:null` observed); never a defect by itself.
- Log max display quirk: "85/11 remaining" shows base monster max while row spinbox edit reads 99 — cosmetic, current-HP arithmetic correct.
- Session: EB joined Wavebender 1 + Bandit 1; admin-cleared change-data + campaign log; console clean (sole error = agent's own 404 probe GET).
