# MA-1260 — Oni "Shape-Shift" — FAIL(b)/DATA

Date: 2026-09-26 · Campaign: test-campaign · Manifest row NOT edited.

## Disk (pre-live)
`public/data/monsters.json` Oni `actions[3]`: name/description only + junk
`attack_bonus:0`; `save_dc:0`, `save_type:""`, no dice, no range/reach/recharge,
**no `automation`**, **no `advisory`**. Fingerprint = MA-1232 all-zero other-type row.

## Live census (EB native cb.click() exact-tick Bandit + Oni → Join Encounter → Oni 1 card)
Shape-Shift row (`div.mc-action`) contains EXACTLY ONE affordance:
- junk `+0` attack chip (`span.mc-dice-link` fa-dice-d20, arms off
  `attack_bonus != null` — MonsterAction.jsx:383/409, §490 admits 0)
- cosmetic `<em> ()</em>` usage tail
- ZERO advisory chip (`AdvisoryLink` arms iff `!!row.advisory` —
  MonsterAction.jsx:335-343), ZERO DC/save chip, ZERO zone chip, ZERO summon/reaction chip.

`+0` pressed ONCE → MA-1232 junk pattern reproduced exactly:
- popup: `Shape-Shift 19 d20 … Advantage/Disadvantage click to dismiss Done` (bogus to-hit roll)
- log delta +1: `roll` `rollType:'attack'` `name:'Shape-Shift'` `characterName:'Oni 1'`
- cs Oni 1 `lastAttack` ABSENT (MA-1232: junk press does not write lastAttack)
- popup flushed via enumerated real-pointer `.popup-close-btn` (1-click clean, no ×2 ghosts)

Center-click row prose: zero popup, zero log delta, zero console errors.
Console: 0 errors entire session.

## Grep
- `shape.?shift` app-wide: **PC Wild Shape machinery only**
  (`handlers/class-druid/wildShapeCreatureBuilder.js`, `charSummaryCalc.js`,
  `handlePlayerSaveDamage.js` …) — none consume monster rows.
- **UNEXPECTED AFFORDANCE FOUND → pre-diagnosis REASSESSED.** The ticket's
  "§70 advisory-unbuilt, fix = generic advisory string" plan is superseded:
  `src/services/encounters/monsterShapeShift.js` (MA-1020) implements a LIVE
  `monster_shape_shift` automation type — `isMonsterShapeShiftRow` gates on
  `automation.type==='monster_shape_shift'` + non-empty `forms[]`; chip press →
  form chooser → stamps form Speed dict onto cs combatant + logs; "True Form"
  reverts. Disk byte-twin precedents in the SAME file: **Imp** and **Lizardfolk
  Shaman** Shape-Shift rows (`automation:{type:"monster_shape_shift",
  effect:"shape_shift", forms:[…,{name:"True Form"}]}`, NO attack_bonus key →
  no "+0" chip).
- Generic advisory seam still true (`isMonsterActionAdvisoryRow = !!row.advisory`,
  value-agnostic, monsterActionAdvisory.js:18) — but inferior here.

## Fix (DATA-only, zero code)
Oni `actions[3]`: **remove `attack_bonus:0`** (kills §490 junk "+0" leg, MA-1232
pattern) and author the sanctioned Imp byte-shape:

```json
"automation": {
  "type": "monster_shape_shift",
  "effect": "shape_shift",
  "forms": [
    { "name": "Humanoid", "speed": 30 },
    { "name": "Giant", "speed": 30 },
    { "name": "True Form" }
  ]
}
```

## §70 honest residual
RAW: "Other than its size, its game statistics are the same in each form."
The stamp surface is Speed-dict only; **size change has zero consumer** — Humanoid/
Giant forms stamp walk 30 ft. (cosmetic no-op vs base), size reverts unmodeled;
revert is GM re-click (no clock, MA-1020 "until they shift back" precedent);
equipment non-transformation stays prose.

## Cleanup
Admin clear-change-data + clear-log: log count 0, change-data `{}`. Board clean.
