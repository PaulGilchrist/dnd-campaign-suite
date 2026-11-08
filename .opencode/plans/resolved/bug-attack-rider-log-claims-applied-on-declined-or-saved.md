# Bug: attack-rider log rows claim "applied" when the effect was declined or saved

## Summary

Two rider-save log producers in `attackRiderHandler.js` write "… applied …" copy
unconditionally, so the campaign log self-contradicts on two honest faces:
1. the Shield Bash **save-FAIL + chooser-Skip** face logs "Shield Bash effect
   applied." while the very next row says "skipped (no effect, use not consumed)";
2. the Cunning Strike rider **save-SUCCESS** face logs "Trip applied to
   <target> — <target> rolled 9 on DEX save (DC 15), succeeded — no effect".

Game state is correct in both faces (nothing granted); only the log copy lies.
Same self-contradiction family as the fixed result-popup (82ded5c1c) and the now-fixed
VT picker header (8d818b3bc) — this is the remaining producer-side tail of that family.

## Steps to reproduce

Starting state: test-campaign, canonical EvasiveFighter (Fighter/BM 18, Shield +
Shield Master + Charger, Scimitar), ElderPaladin victim; hand-rolled 3-creature
`type:'player'` board (EF/EP/Disciplined_Monk) re-POSTed AFTER the Initiative view
settles; EF row `targetName:'ElderPaladin'` armed via scoped combatSummary PATCH.

Face 1 (Shield Bash fail + decline):
1. On EF's sheet press the Scimitar name cell until a HIT resolves; Done through the
   damage stage.
2. When the Shield Bash STR prompt (`.sp-overlay`, "Source: Shield Bash") appears, click
   Roll Save and force a failure (stamp EP `activeBuffs [{effect:'warding_bond', saveBonus:-19,…}]`
   via scoped PATCH before rolling; DEX/STR breakdown line shows the -19).
3. In the resulting fail-chooser ("Push / Prone") click **Skip (do not consume use)**.
4. Open the Log view (or GET /api/campaigns/test-campaign/log):
   `roll` row "ElderPaladin failed the STR save (DC 17). **Shield Bash effect applied.**"
   followed by `ability_use` row "Shield Bash: **skipped (no effect, use not consumed)**."

Face 2 (Cunning Strike Trip on save success — needs the sanctioned EF Rogue/AT lv20
disk swap per playbook §7):
1. Swap EF disk JSON to Rogue/Arcane Trickster lv20, reload + re-select; board as above;
   ElderPaladin stamped `warding_bond +19` (guaranteed save success).
2. Press Scimitar → HIT → Devious Strikes chooser → tick **Trip** → Apply Effects →
   Roll Save (DEX DC 15 succeeds).
3. Log row: `ability_use` "**Trip applied to** ElderPaladin — ElderPaladin rolled 9 on
   DEX save (DC 15), **succeeded — no effect**".

Reproduced 2026-11-08 (run EL): Face 1 × 2 cycles, Face 2 × 1; EP `activeConditions`
proved no spurious grants (prone appears ONLY on the fail cycle, none on the skip cycle).

## Expected behavior

Log copy should state what actually happened:
- Face 1: failed-save row should not claim an effect was applied — the apply/skip is
  decided by the chooser that resolves AFTER the row is written.
- Face 2: success face should read "Trip attempted on X — X succeeded its DEX save
  (DC 15) — no effect" (mirroring the honest 8d818b3bc picker-header branch).

## Actual behavior

Exact rows observed (characterName attribution is now correct — the 20894648c fix holds):
- `roll | EvasiveFighter | ElderPaladin failed the STR save (DC 17). Shield Bash effect applied.`
- `ability_use | EvasiveFighter | Shield Bash: skipped (no effect, use not consumed).`
- `ability_use | EvasiveFighter | Trip applied to ElderPaladin — ElderPaladin rolled 9 on DEX save (DC 15), succeeded — no effect`

## Likely location

Confident (grep-verified, live-proved):
- `src/services/automation/handlers/combat/attackRiderHandler.js:109` —
  `` description: `${targetName} ${success ? 'succeeded' : 'failed'} the STR save (DC ${saveDc}).${!success ? ' Shield Bash effect applied.' : ''}` ``
  — the "applied" clause is emitted on the fail leg BEFORE the chooser resolves, so it
  also fires when the player then Skips.
- `src/services/automation/handlers/combat/attackRiderHandler.js:791` —
  `` description: `${option.name} applied to ${targetName} — … ${saveResult.success ? 'succeeded' : 'failed'} — ${saveResult.success ? 'no effect' : …}` ``
  — leading "applied to" is unbranched while the tail already knows the outcome.

## Suggested fix

- :791 is a one-liner: branch the lead on `saveResult.success`
  (`attempted to` vs `applied to`) — same branch the VT picker header fix (8d818b3bc,
  `buildVersatileTricksterDescription`) already introduced; consider sharing the phrasing.
- :109: the pre-chooser row should stay outcome-neutral (e.g. "…failed the STR save
  (DC N) — choose an effect."), and/or the chooser's own commit/decline rows
  (`ability_use` applied/skipped) should be the only effect-outcome claims. Check
  whether a test pins the current copy (`attackRiderHandler*.test.js`) before re-wording.

## Severity

Minor UX issue — game state adjudicates correctly on both faces (verified via
`activeConditions` and te buckets); the defect is dishonest log prose in the same
family the owner already ruled as bugs twice (82ded5c1c, 8d818b3bc).

## Resolution

FIXED 2026-11-08 (fix subagent, test-campaign live + unit-verified).

**What was actually wrong (vs the original guess).** The guess was directionally
right but the producer census was incomplete:

- **Face 1 has TWO producers, and the live one was NOT the cited file.** The
  sheet-attack pipeline auto-fires the feature-rider STEP
  `src/services/combat/steps/features/shieldBash.js` (`logShieldBashSaveResult`),
  which byte-duplicates the cited copy at
  `attackRiderHandler.js:109` (`logShieldBashSaveOutcome`, the feature-row/router
  lane). The observed live row came from the step lane — fixing only the cited
  :109 would have left the repro byte-identical. Both now log the outcome-neutral
  fail-leg copy `"<T> failed the STR save (DC N). Choose an effect."` — the
  chooser's own commit/decline rows (`applyShieldBashEffect`: "Shield Bash used
  against X: pushed 5 ft." / "target has Prone condition." / "skipped (no effect,
  use not consumed).") are the only effect-outcome claims. Success leg copy
  unchanged (already honest).
- **Face 2** per the suggested fix: `attackRiderHandler.js` handleRiderSave row
  lead now branches on `saveResult.success` — `attempted on` vs `applied to`
  (mirrors the honest 8d818b3bc `buildVersatileTricksterDescription` branch);
  fail-leg bytes unchanged.
- **Same-family tail swept (adjacent, found during investigation):**
  `versatileTricksterHandler.js` secondary-target row had the identical
  unbranched `Trip applied to X … succeeded — no effect` lead while its OWN
  popup copy below already branches honestly — same one-line lead branch.

**Files changed**
- `src/services/automation/handlers/combat/attackRiderHandler.js` (:109 area fail-leg copy; :791-area success lead branch)
- `src/services/combat/steps/features/shieldBash.js` (step-lane fail-leg copy)
- `src/services/automation/handlers/class-fighter-rogue/versatileTricksterHandler.js` (secondary-row lead branch)
- Stale copy-pins updated same-pass: `attackRiderHandler.save-flow.test.js`, `attackRiderHandler.save-success-eviction.test.js`, `steps/features/shieldBash.test.js` (×2), `versatileTricksterHandler.test.js`
- NEW regression test: `src/services/automation/handlers/combat/attackRiderHandler.log-honesty.test.js` (4 tests: bash fail row = exact neutral bytes + no /applied/i claim; bash success row unchanged; Trip SUCCESS row = exact "Trip attempted on Goblin — Goblin rolled 9 on DEX save (DC 15), succeeded — no effect" + not "applied to"; Trip FAIL row keeps "applied to … prone condition applied" bytes)

**Verification**
- Face 1 re-reproduced BROKEN first, live and exact: EF (Fighter/BM 18, Scimitar) +
  hand-rolled 3-creature type:player board (EF/EP/DM, EF row targetName armed, POSTed
  after selection then reload+re-select) + EP `warding_bond −19` dial → Scimitar crit →
  Done → Charge Cancel → bash STR DC17 prompt (breakdown showed −19, `= −9`) → Roll Save
  (fail) → chooser → **Skip** → log pair exactly as filed: `roll "ElderPaladin failed the
  STR save (DC 17). Shield Bash effect applied."` + `ability_use "Shield Bash: skipped
  (no effect, use not consumed)."`; state honest (`activeConditions:[]`, te `[]`).
- Face 1 POST-FIX live: same cycle (round-bump re-arm) → row now reads
  `ElderPaladin failed the STR save (DC 17). Choose an effect.` followed by the skip row —
  contradiction gone; parked damage still lands (`1d6+3` + hp_change).
- Face 2 POST-FIX live (sanctioned EF Rogue/AT lv20 disk swap, 4 unique-anchor
  str.replace; later cp-restored, md5 0df29ff3 byte-exact + sheet re-proof "Fighter
  (battle master), Level 18"): sneak crit → DS chooser → tick Trip → Apply Effects →
  DEX DC15 prompt with `+19` dial → save-SUCCESS → `ability_use | Devious Strikes |
  "Trip attempted on ElderPaladin — ElderPaladin rolled 20 on DEX save (DC 15),
  succeeded — no effect"` — honest lead, cost-deducted sneak pool still lands
  (`1d6*2+3 + 9d6*2`), VT picker Skip worked, bash success leg kept honest copy.
  Adjacent behavior healthy; console errors 0 for the whole session.
- Tests: new log-honesty file 4/4; the 8 sibling `attackRiderHandler.*` files +
  `shieldBash.test.js` + `versatileTricksterHandler.test.js` = 113 passed; modal/resume
  adjacent suites (`ShieldBashChoiceModal`, `shieldBashResume`, `AttackRiderModal` ×2,
  `ChooserModalFooter.labels`) = 47 passed; FULL three touched folders
  (`steps/features`, `handlers/class-fighter-rogue`, `handlers/combat`) = 127 files /
  1506 tests passed. `npm run lint` clean (zero warnings). `no-timers-guard` OK.
- Exit: change-data `{}` + log `[]` GET-verified two-pass (closed tab); EF disk
  md5-verified canonical; no other campaigns touched.

