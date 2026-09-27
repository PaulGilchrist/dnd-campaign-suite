# BUG MA-1334 — Poltergeist "Telekinetic Thrust": half-default leak on RAW silent-zero success

**VERDICT: FAIL (a) / DATA** — successful save deals HALF (finalDamage 5 of rolled 10);
RAW text grants a SILENT ZERO on success (no "half as much" clause). Engine stamps
`dcSuccess:'half'` because the row's `dc_success` is UNSET (§523 default).

## Expected (RAW / row, public/data/monsters.json index 428 "Poltergeist", action "Telekinetic Thrust")
> "Strength Saving Throw: DC 12, one creature the poltergeist can see within 30 feet.
> Failure: 9 (2d6 + 2) Force damage, and the target is pushed up to 30 feet straight away
> from the poltergeist."

RAW: "or be pushed" / failure-only ⇒ **SUCCESSFUL SAVE = ZERO damage, no push**. There is
no "half as much damage on a successful save" clause anywhere in the text — silent-zero success.

Disk fields: `save_dc:12, save_type:"Strength", damage_dice_primary:"2d6 + 2",
damage_type_primary:"Force", attack_bonus:0 (junk chip, not pressed)` — **`dc_success` key
ABSENT** (confirmed on disk this session).

## Actual (live, test-campaign, Bandit 1 STR save +0, HP rigged 200, Playwright :5173)
- Save #1 FAIL: d20 4 +0 = 4 vs DC 12 → 2d6 [5,2]+2 = **9 FULL** → HP 200→191 (hp_change −9 == rolled ✓)
- Save #2 FAIL: d20 8 +0 = 8 vs DC 12 → 2d6 [6,1]+2 = **9 FULL** → HP 191→182 (hp_change −9 ✓)
- Save #3 SUCCESS: d20 13 +0 = 13 vs DC 12 → rolled 2d6 [4,4]+2 = 10 → **finalDamage 5 (exact HALF)**
  → HP 182→177 (hp_change −5). RAW expects **0**. ⇒ half-default leak CONFIRMED live.
- Log `save_result` entries: `saveDc:12, saveType:"Strength", saveResult:"failure|success"`,
  **`dcSuccess:"half"` stamped on ALL legs** (the leak marker).
- Machine keys: no `saveResult-Bandit 1` change-data key created for the NPC target
  (MA-1329 precedent); verdict on attacker store `Poltergeist 1.lastSaveRoll`
  `{d20:13, bonus:0, saveType:"Strength", targetName:"Bandit 1"}` + `_lastRollContext`
  `{saveType:"Strength", saveDc:12, actionName:"Telekinetic Thrust", oldTotal:13, oldSuccess:true}`.
- DC enforced == 12, type Strength: CORRECT on all faces.
- §508 verified: `cs.creatures["Poltergeist 1"].targetName === "Bandit 1"` (armed via own-row
  Target select, card closed→reopened §MA-1330).

## Push clause — §524 by-design advisory (NOT a fail)
"pushed up to 30 feet straight away" is structural GM-adjudicated. No push/position te appeared
on either leg (`Bandit 1` store empty, no `push`/`position` change-data keys, targetEffects []) —
expected: single-target save rows have NO push te; `registerTargetEffect` is AoE-picker only.

## Likely Location (DATA → engine default)
DATA: `dc_success` unset on the row ⇒ `resolveBlockSaveDcSuccess` (`MonsterCardModal.jsx:252-255`:
`Number(action?.save_dc) > 0 ? (action.dc_success ?? 'half') : null`) stamps `'half'`, and
`saveProcessing` pays half on success. Same lineage as §63/§678 MA-1301, MA-0781, and MA-1332
(this same chip as multiattack component: nat-12 SUCCESS dealt finalDamage 5 of 11).

**Fix = author `dc_success:"none"` on the Telekinetic Thrust row** (no code change needed;
the engine honors `'none'` — see `MonsterCardModal.jsx:1308` spell path precedent).
