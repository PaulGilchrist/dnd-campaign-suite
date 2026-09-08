# Bug CLA-355 — Telekinetic Adept: once-per-rest latch + die-expend recharge inert; push/choice/prose gaps (2026-09-08)

Verdict: FAIL (PASS-subset live — core leap fly state + thrust STR-save chain fire with exact DC; rest-gated clauses unenforced/inert).

## Host / rig
- **EvasiveFighter** lv18 Fighter, subclass swapped Battle Master→**Psi Warrior** (Edit wizard tab 7; disk `class.subclass.name:"Psi Warrior"`). INT 17/+3, PB+6 → **DC 17 verified exact**.
- Canonical owner (for manifest fix): 2024 Fighter (Psi Warrior major) **lv7** — `public/data/2024/classes.json` classes[4].majors[3].features[3]. Manifest `class:"Fighter"` is correct; Sorcerer misattribution NOT confirmed — no manifest edit proposed beyond level/path annotation.
- Pool: lv18 Psi Warrior = 12×d12 (energy_die_type 12, energy_die_num 12); Long Rest armed pool (runtime key booted null; fallback computed max 12).

## Live PASS evidence
- A: BA row "Telekinetic Adept:" clickable → change-data `EvasiveFighter.activeBuffs` = `{effect:'telekinetic_leap', flySpeed:60, duration:'until_end_of_turn', leapEffect:true}`; sheet "Speed: 30 ft., fly 60 ft." (charSummaryCalc.js:251 consumer). Refresh-click spent 1 die (12→11).
- B: Scimitar hit 12 vs AC 9 (Done applied 52→49) → "Psionic Strike:" expend die (11→10) + Force 13 = d12(10)+INT3 → auto-chain `createSaveListener` STR **DC 17** → SAVE FAILURE 5+0 → runtime prone (`Gibbering Mouther 1.activeConditions:["prone"]`), `saveResult-Gibbering Mouther 1` capture, logs: `roll` "Telekinetic Adept — STR saving throw (DC 17)" + `ability_use` "pushed Gibbering Mouther 1 10 feet away".
- Control: same-turn refire refused "Already used this turn. Once per turn.", zero spend.
- Trigger gate `checkTriggerGate` (psionicStrikeHandler.js:31) requires own weapon hit+damage+range — consulted live.

## Bugs
1. **Rest latch inert:** expected once per Short/Long Rest; app stamps `telekineticThrustUsedRound` once-per-TURN only (psionicStrikeHandler.js:66-71; app data itself says `oncePerTurn:true` — data divergence from feature text). Refires every round with no spend/rest.
2. **Die-expend recharge inert:** "expend a Psionic Energy Die (no action) to restore your use" has ZERO consumer — no writer restores any thrust uses counter (grep: only leap-refresh spends dice, telekineticLeapHandler.js:33). No uses counter exists for thrust at all.
3. **No Prone-OR-move choice:** classes.json options = single "Prone + Push 10ft"; handler applies BOTH; push distance is prose in log only — no grid-position consumer (no token move).
4. **Leap logging gap:** `handleTelekineticLeap` never calls addEntry — popup-only automation (AGENTS.md gap); log tail had no ability_use for leap.
5. **Leap never expires:** `until_end_of_turn` with no addExpiration registrant — buff persisted into round 4.
6. BA-spend economy not modeled (row re-clickable same turn; only the already-active→spend-die branch latches).

## Repro notes / pitfalls hit
- Combat already auto-started with active=AasimarTest; Next-walk lands fighter at idx0 card (initiative re-sort after spinbutton Enter).
- HIT popup survived as fixed-position node: `offsetParent===null` trap — enumerate `[data-testid="popup-overlay"]` with computedStyle, not offsetParent.
- Damage popup's own Done is `button.dice-roll-reroll-btn`; sp-overlay (Tactical Master ghost re-queues every hit, FT-094 family) intercepts — Skip it before next interaction.
- Lingering promptId persists in `pendingSavePrompts` after Done (§42h).
- Energy pool boots null post-subclass-swap until first spend fallback (CLA-352 auto-refill family).
