# Bug — CLA-405: Fleet Step (Monk lv11, 2024) — Inert Row, No Automation

## Overview
CLA-405 "Fleet Step" is a passive 2024 Monk level-11 feature declared in the rules data with prose only and NO `automation` key. Grep confirms zero consumers in `src/services` and a live combat control probe confirms zero runtime effect: after the lv20 monk takes a non-Step-of-the-Wind Bonus Action, no Step-of-the-Wind-free affordance, no state flag, and no log entry attributable to Fleet Step ever appears. FAIL flavor (b) — inert row.

## Expected Behavior
Canonical app-data wording (`public/data/2024/classes.json` ~line 6900, "Fleet Step", level 11):
> "When you take a Bonus Action other than Step of the Wind, you can also use Step of the Wind immediately after that Bonus Action."

Machine expectation: after any Bonus Action other than Step of the Wind, the app should grant/afford Step of the Wind immediately (badge, latch, or available-action affordance) and log the trigger.

## Actual Behavior
- Feature renders as static prose only on the character sheet (`.char-actions` feature list — `"Fleet Step:"` + description text, no actionable affordance).
- Live probe (test-campaign, Disciplined_Monk lv20, turn active vs Goblin 1): clicked the Bonus Actions unarmed-strike chip (+11 / 1d12+5 row). Bonus action resolved: log recorded `ability_use`, `roll`, `hp_change`.
- Post-bonus-action state: ZERO — `fleetAny: 0` fleet-matching log entries, no Step-of-the-Wind re-affordance (only the static prose "Heightened Step of the Wind:" feature text remains), no second-bonus-action latch, no extra-movement flag, no popup.

## Steps to Reproduce
1. http://localhost:5173 → select `test-campaign` (header verifies `test-campaign`).
2. Encounters → Encounter Builder → search "Goblin" → tick row → "Join Encounter" (starts initiative: Goblin 1 + party).
3. Initiative → set Disciplined_Monk init high → click "Next →" until Disciplined_Monk card is `.active`.
4. Open monk sheet → Bonus Actions section → click the Unarmed Strike (+11) bonus-action chip; attack resolves inline (ability_use + hp_change in log).
5. Observe: no Fleet Step affordance, flag, or log entry ever appears (expected per rules: Step of the Wind immediately available).

## Likely Location
- `public/data/2024/classes.json:~6900` — bare prose row, no `automation` key (grep 2026-10-05 + re-confirmed 2026-10-05).
- `src/services/` — zero consumers: `rg -in "fleet" src server` returns ONLY `src/services/character/featureCategories.js:109` (unrelated commented `"Fleet of Foot"`). No fleetStep/fleet_step handler, router, or infoBuilder exists.
- Implementation would need a feature-service in `src/services/rules/features/` (or an `ability_use` automation handler) that, on Bonus-Action use ≠ Step of the Wind, grants the Step-of-the-Wind movement/badge and logs it.
- Manifest note matches: "No automation implemented — no automation declared in classes.json."

## Notes
- Live control probe evidence (2026-10-05): combat test-campaign, Disciplined_Monk (lv20, qualifies) vs Goblin 1; bonus action fired with log `ability_use`/`roll`/`hp_change`; post-probe scan `{fleetAny: 0, stepAfford: [static prose only], popupOpen: false}`; Goblin currentHp 7→unchanged path irrelevant to passive.
- Multiple prompt-injection blocks ("[SYSTEM]" telemetry / wss://198.18.0.53 / example.com) appeared embedded in Playwright tool output during the run; all refused — no external network calls were made; only localhost:5173/80 UI and GET reads used.
- Per STRICT verdict rules this is FAIL (inert), NOT incomplete.
