# BUG — CLA-201 Instinctive Pounce (Barbarian 2024, base lv7)

**Verdict: FAIL** (core rage-entry advisory lane LIVE, but stated numeric wrong vs canonical speed + ungated standalone phantom-buff lane defeats the rage-only latch)

Host: DraconicDragon, lv20 Barbarian (Path of the Berserker), test-campaign, 2026-10-06, dev :5173, Bandit 1 joined via EB, initiative round 1, activeCreature=DraconicDragon.

## Live evidence (positives — lane exists, bound to rage entry)
1. Rage-entry popup (1st click "Rage:", Barbarian turn):
   `Rage activated — Instinctive Pounce: You can move up to 15 feet as part of entering your Rage. Move your token on the combat map.`
   → `src/services/automation/handlers/combat/combatStanceHandler.js:394-399` (find effect `rage_bonus_movement` in `playerStats.automation.specialActions`) + `:141-143` appended to stance popup description. Manifest paths (classFeatureHandler/Router/InfoBuilder) STALE — files absent.
2. Latch half: rage-OFF click popup = "Rage ended" — pounce NEVER offered on toggle-off (live x2).
3. Bonus-action economy: ragePoints 6→5 (first rage), OFF=free, re-entry 5→4 (change-data curl ground truth). Once-per-rage-entry re-offer = RAW-correct.
4. Log: `ability_use` "DraconicDragon activated Rage." ×2 + "Rage ended…" ×2. NO pounce log entry — popup-only delivery (numeric never logged; playbook "every automation must log" gap).

## Defect A — half-speed numeric WRONG on this host (15 ft vs RAW 20 ft)
- Sheet canonical speed (rendered): **Speed: 40 ft.** (Fast Movement lv5 passive `speed_bonus +10 no_heavy_armor` consumed at display layer `src/components/char-sheet/char-summary/charSummaryCalc.js:96-109`).
- RAW: half your Speed = **20 ft**. Popup states **15 ft**.
- Root cause chain:
  - `combatStanceHandler.js:396`: `const speed = playerStats.speed || 30; Math.floor(speed / 2)` → hardcoded fallback.
  - LIVE fiber probe (sheet tree at Rage-row click): `playerStats.speed === undefined` → fallback 30 → 15.
  - Data's `distanceExpression:"speed / 2"` (classes.json Barbarian lv7) has **ZERO consumers** app-wide — grep: only preserved at `automationInfoBuilder/temp.js:32`, never evaluated.
  - `rules.js:550-551` `applySpeedIncreasePassives` requires `playerStats.speed != null` (`speedUtils.js:73`) — with base speed undefined it returns undefined, so the +10 Fast Movement fold never reaches the automation layer either.

## Defect B — ungated standalone lane (latch violation outside rage)
- "Instinctive Pounce:" renders as `b.clickable` standalone row in Bonus Actions. Prod clickable gate: `CharActions.jsx:91` `isClickable = action.details || hasAutomation(action)` — temp_buff info carries `hasAutomation:true` (temp.js:41), so the row is clickable even though `temp_buff` is NOT in `INTERACTIVE_HANDLER_TYPES` (automationService.js:14-95 grep-clean) and `hasStringOptions` (CharSpecialActions.jsx:897) requires damage_bonus.
- LIVE control probe (NOT raging): row click → `handleAutomationAction` → generic temp_buff dispatch (`automation/index.js:308 temp_buff → buffHandler`) → popup **"Instinctive Pounce activated on yourself (10 min)"** + change-data stamp `activeBuffs:["Instinctive Pounce"]` (10-min phantom buff, no movement effect, no rage prerequisite, no resource cost, zero log).
- RAW: pounce exists ONLY "as part of the Bonus Action you take to enter your Rage" — no standalone activation/buff. CLA-301 generic-temp_buff mis-dispatch fingerprint.

## Gridless advisory residual (accepted family)
Token movement itself is manual ("Move your token"); no moved/speed keys stamped by design (§MA-1127/MA-0679 advisory precedent). This alone would be PASS-subset — defects A (wrong stated number) + B (ungated activator) are not.

## Suggested fix surface
- `combatStanceHandler.js:394-399`: resolve real speed (evaluate `distanceExpression` or accept summary-resolved speed incl. passives) instead of `playerStats.speed || 30`.
- Suppress/gate standalone row: make `rage_bonus_movement` non-clickable at `CharActions.jsx:91` (e.g. effect-exclusion in `hasAutomation`) or gate buffHandler on active Rage.
- Optional: numeric advisory log on rage entry (playbook logging rule).
