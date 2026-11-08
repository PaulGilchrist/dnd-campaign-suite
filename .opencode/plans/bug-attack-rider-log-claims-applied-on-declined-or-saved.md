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
