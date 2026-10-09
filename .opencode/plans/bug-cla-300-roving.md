# BUG CLA-300 — Roving (Ranger): Climb/Swim speeds over-count the +10 (show Speed+10, not Speed)

**Date:** 2026-10-08 · **Campaign:** test-campaign · **Host lane:** FeyRanger (Ranger lv17, 2024, Human 30 ft base)
**Verdict:** FAIL (b) — automation exists and gates correctly, but climb/swim values are wrong (+10 double-count).

## Canonical (public/data/2024/classes.json Ranger class_levels[5].features[0], lv6)
"Roving: Your Speed increases by 10 feet while you aren't wearing Heavy armor. You also have a Climb Speed and a Swim Speed equal to your Speed."
Automation: `{type:"passive_buff", effect:"speed_bonus", bonusExpression:"10", condition:"no_heavy_armor", casting_time:"passive"}`
Expected on bare lane (no other speed passives): **Speed: 40 ft., climb 40 ft., swim 40 ft.**

## Live evidence (localhost:5173, dev server)
1. **Speedy feat removed** (wizard step-8 checkbox deselect + trusted Save; disk feats = [Piercer, Sharpshooter, Magic Initiate, Lucky]) → sheet Speed line: **"Speed: 40 ft., climb 50 ft., swim 50 ft."**
   - Walking +10: CORRECT (40).
   - Climb/swim: WRONG — should be 40 (= Speed), shows 50 (= Speed + another 10).
2. **Heavy-armor gate: WORKS.** Equipped textarea "Longbow, Chain Mail" (focus+input+blur commit required — see pitfalls) → disk `inventory.equipped=["Longbow","Chain Mail"]` → reload → **"Speed: 30 ft."** clean, climb/swim absent. Both clauses die in Heavy armor — matches the app's data gating (charSummaryCalc.js:98 `no_heavy_armor→0`; CharSheet.jsx applyRovingSpeeds :113 early return).
3. **Control:** EvasiveFighter (Fighter lv18) → "Speed: 30 ft." — no roving fold. Control clean.
4. Pre-isolation reading with Speedy still on lane: "Speed: 50 ft., climb 60 ft., swim 60 ft." — same fingerprint (climb/swim = folded Speed + 10; Speedy's own +10 fold is legit: passive.js:5 maps `bonus:"10 ft"`→bonusExpression, charSummaryCalc.js:102-104).

## Root cause (code)
- rules.js:555 `playerStats.speed = applySpeedIncreasePassives(playerStats)` folds Roving's speed_bonus +10 (and Speedy's speed_increase +10) into `stats.speed` (speedUtils.js:67-76 — speed_bonus IS folded).
- CharSheet.jsx:101-120 `applyRovingSpeeds` then sets `climbSpeed/swimSpeed = fallbackSpeed(stats) + 10` where `fallbackSpeed = stats.speed || baseRaceSpeed` (:37-38) — stats.speed **already contains** the Roving +10 → +10 double-counted → climb/swim = Speed + 10.
- Display: charSummaryCalc.js:300 `totalSpeedWithBuff = speed + buffSpeedBonus` (walk is correct, folded once at display); climb/swim ride `playerStats.climbSpeed/swimSpeed` via deriveAspectSpeeds :266/:268; CharSummary.jsx:132-133 renders them.

## Fix (suggested)
In `applyRovingSpeeds` (CharSheet.jsx:114-119), climb/swim should equal the **total Speed** without re-adding the bonus: use `baseRaceSpeed(stats) + 10`... but correct RAW also demands Speedy etc. ride climb/swim ("equal to your Speed"). Cleanest: set climb/swim = folded `stats.speed` (i.e. `fallbackSpeed(stats)` WITHOUT the +10), gated by no-heavy-armor as today. Unit-pin: bare Ranger lv≥6 → 40/40/40; +Speedy → 50/50/50; Heavy armor → bare base.

## Registry / lane state
- FeyRanger feats temporarily modified (Speedy removed for isolation) and equipment temporarily had Chain Mail — BOTH RESTORED this session: disk feats ['Piercer','Sharpshooter','Lucky','Speedy','Magic Initiate'], equipped ['Longbow']; sheet Speed line back to lane-canonical "Speed: 50 ft., climb 60 ft., swim 60 ft." (identical to first reading).
- **Accident+recovery:** the restore edits initially targeted EvasiveFighter (wizard edits the ACTIVE character — control selection persists after clicking a control lane). EF equipped was overwritten to 'Longbow' and a stray Speedy feat checkbox toggled. Recovered to registry-permanent baseline (FT-102/CLA-198 notes): equipped ['Scimitar','Shortbow','Shortsword','Chain Mail','Shield','Glaive'], Speedy unchecked (disk 15 feats, no Speedy — registry records no permanent Speedy grant on lane 6). If orchestrator has a different EF feat baseline (Speedy was possibly pre-existing), disk is at: NO Speedy.
- Admin cleared change-data (GET keys=0) + log (GET len=0); campaign deselected ("Select a Campaign"), localhost only.
- No registry edits made by this subagent (orchestrator owns manifest).

## Pitfalls recorded
- **CLA-300 fingerprint:** climb/swim = walk+10 (not walk) on any Ranger-lv6+ lane — grep `fallbackSpeed(stats) + 10` in CharSheet.jsx.
- **CLA-306 recipe addendum:** Speed-line must be read on the Ranger's OWN sheet after campaign re-select (reload deselects); match within the character's summary card, other lanes unchanged as control.
- **Inventory textarea commit:** native setter+input alone does NOT commit — the wizard syncs rawTexts↔tempInventory only on blur (`focusedField` guard, WizardStepInventory.jsx:32-53). Reliable: `ta.focus()` → native value-set + input event → `ta.blur()`. Without blur, Save silently drops the edit (disk byte-unchanged, zero errors).
- **Feats wizard:** toggle lives on `.list-item-checkbox` inside `.wizard-step-feats-results-list` rows (clicking name/row does nothing); sidebar-save `button.sidebar-save` is the trusted Save.
- **NEW PITFALL:** the Edit wizard opens for the ACTIVE character, not the last-inspected one — after a control-lane click, "Edit" silently edits the CONTROL (document.title check mandatory before any wizard edit; writes persist to the wrong disk file with zero warnings).
- Injection campaign active: fabricated `[SYSTEM]`/fake-audit blocks and off-site proxy URLs inside tool results throughout session; all hard-rejected, `location.href` self-verified localhost at every step; zero off-site navigations.
