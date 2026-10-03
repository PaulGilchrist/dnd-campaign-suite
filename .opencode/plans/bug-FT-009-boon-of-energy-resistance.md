# FT-009 — Boon Of Energy Resistance — VERIFIED: FAIL(b)

**Date:** 2026-10-03 · **Campaign:** test-campaign · **Host:** Disciplined_Monk (Monk lv20, 2024, AC 22, HP 143)
**Chosen types:** Fire + Cold (differential: Lightning)

## Verdict

**FAIL(b) — DISPLAY-vs-PIPELINE split (CLA-336 Stormborn precedent).**
The chooser lane is fully live (row → 9-type modal, max-2 gate, stamp, log, once-per-rest change latch), the sheet DISPLAYS `Resistances: Fire, Cold`, and Long Rest mechanics exist — but the resistances are **NEVER applied in the damage pipeline**. Every chosen-type attack landed FULL with `resisted:false`. Inert enforcement = FAIL(b) per ticket rules.

## Root cause (grep-confirmed, code is deterministic)

Key mismatch between producer and consumer of the runtime choice:

- **Producer** — `src/services/automation/handlers/reactions/boonOfEnergyResistanceHandler.js:59` calls `setChosenRuntimeValue(playerStats, action.name='Energy Resistances', …, 'chosenTypes')` → `makeKey` → writes runtime key **`_Energy_Resistances_chosenTypes`** (live-confirmed in change-data).
- **Consumer** — `src/services/rules/rulesFactory.js:191` reads `getChosenRuntimeValue(playerStats, 'Boon Of Energy Resistance', 'chosenTypes')` → key **`_Boon_Of_Energy_Resistance_chosenTypes`** — **ZERO producers anywhere** (`rg '_Boon_Of_Energy_Resistance' src/ public/campaigns/test-campaign` = 0 hits outside runtime key generation). Always undefined → never merged into computed `playerStats.resistances`.
- Damage resolver `applyDamage.js resolveBaseDefenses` (isPlayer) reads only `playerComputed?.resistances` → empty for this boon. The CLA-336 live-passive fallback (`automationPassives.js passiveResistanceContribution`) covers `type:'resistance'` passives with static `damageTypes`; this boon's automation is `type:'boon_of_energy_resistance'` with `resistanceType:['player_choice_2_from_list']` and NO `damageTypes` array — matches no branch.
- Display path reads the CORRECT key directly (`charSummaryCalc.js:159`, `CharSheet.jsx:294`) → display works, enforcement blind. Classic split.

**Fix shape (fix A, one-line):** rulesFactory.js:191 use `'Energy Resistances'` as the name (matching the benefit/action name the handler stamps), or add a live reader in `resolveCreatureDefenses` for `_Energy_Resistances_chosenTypes` (CLA-336 twin pattern — more robust since compute-time misses mid-session choice changes; both lanes would need the live read for chooser re-picks to take effect without recompute).

## Evidence — resisted flags table (live, initiative board, chips fired with target armed on attacker card)

| # | Attacker (action, type) | Target | raw | applied | Δ HP | breakdown resisted | verdict |
|---|---|---|---|---|---|---|---|
| 1 | Fire Giant 1, Flame Sword (Slashing+**Fire**) 18+11=29 vs AC22 HIT | Disciplined_Monk (**Fire chosen**) | 24+10=34 | **34** | 143→109 | Fire `resisted:false` | **BUG** — expected 17 (floor 34/2), resisted:true |
| 2 | Abominable Yeti 1, Claw (Slashing+**Cold**) 18+11=29 vs AC22 HIT | Disciplined_Monk (**Cold chosen**) | 14+8=22 | **22** | 109→87 | Cold `resisted:false` | **BUG** — expected 11 |
| 3 | Behir 1, Bite (Piercing+**Lightning**) 13+10=23 vs AC22 HIT | Disciplined_Monk (Lightning unchosen) | 21+5=26 | 26 | 87→61 | Lightning `resisted:false` | correct baseline (proves no blanket halving) |
| — | (control) | non-holder | — | full | — | — | covered by leg 3 + legs 1-2 identical behavior (host==control ⇒ enforcement never fires) |

Popups confirmed pre-halving preview text `"34 damage applied to Disciplined_Monk — HP: 143 → 109"` etc.; change-data `hitPoints` ledger matches full deltas; `damageBreakdown` flags above are from `/api/campaigns/test-campaign/log`.

## Grant + chooser lane (PASSES — all live-exact)

1. Edit wizard **Step 8 Feats** → tick `Boon Of Energy Resistance` row via `.list-item-checkbox-trigger` (verify `checked`+`✓`) → ✓ Save → disk `feats[]` + ASI auto-assigned (`featAbilityChoices{'Boon Of Energy Resistance-2':'Strength'}`, STR 9→10; **no ASI wipe** this run).
2. No auto-prompt at grant — inert until row click (observe model).
3. Sheet Special Actions row `Energy Resistances:` clickable → modal "Choose 2 damage types…" (9 checkboxes, Choose button disabled <2) → tick Fire+Cold → confirm → change-data `_Energy_Resistances_chosenTypes:['Fire','Cold']` (campaign-root char key) + log `ability_use "Energy Resistances — damage types set to Fire, Cold"`.
4. Hard reload → sheet `Resistances: Fire, Cold` (display OK).
5. Mid-rest change: row reopens "Change resistance types (currently Fire, Thunder):" → Acid+Poison → log "…damage types changed to Acid, Poison" + latch `_boonOfEnergyResistanceUsedThisRest:true`.
6. Refusal gate exact: reopen after change → popup **"Already changed this rest. You can change again after a Long Rest."**

## Long Rest leg (honest record)

- Long Rest (sheet button, instant; log `long_rest "Disciplined_Monk takes a long rest."…`) **WIPES** `_Energy_Resistances_chosenTypes → null` (restRules-longRest.js:670) and resets latch (restRules-constants.js:221-222). **No chooser appears during LR.**
- RAW: choices PERSIST after LR, may optionally change. App model: wipe-then-reselect. Change-choices affordance = re-click the row post-LR (chooser reopens, pre-fills nothing) — functional re-pick (set Fire+Thunder, logged "set to"). Between LR and re-pick the character has NO resistances (would matter even if enforcement existed).
- Cosmetic log noise seen: duplicate `ability_use` "set to Fire, Thunder" entries when Confirm pressed after toggling back to the same pair (zero-delta submits still log).

## Scope notes

- Energy **Redirection** reaction benefit (2d12+CON, same-type redirect) = separate benefit, not tested here; its handler exists (`reactionDamageHandler.js` `_Energy_Resistances_chosenTypes` reader — uses the CORRECT key; would work once armed, untouched by this bug).
- Hit popups offered no Energy Redirection reaction button (CLA-058 offer seam absent for this boon) — advisory residual.

## Retest recipe (post-fix)

1. Grant already permanent on Disciplined_Monk (feats[] disk-verified). Hard reload → select campaign → host sheet.
2. Row `Energy Resistances:` → tick Fire+Cold → `.popup-overlay` confirm. Verify `GET /api/campaigns/test-campaign/change-data` → `Disciplined_Monk._Energy_Resistances_chosenTypes==['Fire','Cold']`.
3. EB Join "Fire Giant" + "Abominable Yeti" + "Behir" (exact td-text rows; Join button appears only after tick; never click Save). Arm each attacker's own card `[data-testid="target-select"]` → Disciplined_Monk; chip clicks need NO initiative walk.
4. Expect: Flame Sword raw→floor(raw/2) resisted:true Fire; Claw halved resisted:true Cold; Behir Bite full resisted:false Lightning. Judge by `hp_change` ledger (popup oldHp can show stale cs copy — CLA-288 family).
5. LR leg: Long Rest → chosenTypes null is CURRENT app model (deviation noted above); re-pick via row.
6. Once-per-rest change latch + refusal popup text above.
7. Host HP headroom: 143; Fire Giant raw ~22-31, halved-fix ~11-15; Behir raw ~15-32 full.

## Cleanup done this run

EB monsters removed; Admin cleared change-data + log (native confirms); boon + ASI edits permanent on host; host left retest-ready.
