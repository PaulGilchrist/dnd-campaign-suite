# MA-1371 — Quasit Shape-Shift — FAIL(b)/DATA

- stableKey: quasit|actions|3 | monsterIndex: quasit | actionIndex: 3
- actionType: attack+save (manifest label; disk truth: junk attack_bonus:0, save_dc:0, no save fields real)
- verified: **FAIL(b)/DATA** — 2026-09-26, test-campaign, localhost:5173

## Disk row (public/data/monsters.json quasit actions[3], verbatim)
```json
{
 "name": "Shape-Shift",
 "description": "The quasit <strong>shape-shifts</strong> to resemble a bat (Speed 10 ft., Fly 40 ft.), a centipede (40 ft., Climb 40 ft.), or a toad (40 ft., Swim 40 ft.), or it returns to its true form. Its game statistics are the same in each form, except for its Speed. Any equipment it is wearing or carrying isn't transformed.",
 "attack_bonus": 0, "save_dc": 0, "save_type": "", "save_effect": "",
 "range": "", "reach": "", "recharge": ""
}
```
`automation` field ABSENT. `attack_bonus:0` renders junk "+0" chip (§490/§867 Scare-row twin) — NEVER pressed.

## Machinery LIVE — consumer exists (kills §MA-1347 advisory framing)
`src/services/encounters/monsterShapeShift.js` (MA-1020): `isMonsterShapeShiftRow` arms
ONLY on `automation.type:"monster_shape_shift"` (:29-30); ShapeShiftModal `.mc-overlay--shape-shift`
chooser; pick stamps cs `{speed:{walk/fly/climb}, shapeShiftForm}` (speedMerge honesty lane,
MA-1113); True Form reverts; already-in-form refuses. This is a speed-transform consumer built
EXACTLY for gridless prose shape-shift rows — so §MA-1127/§MA-1347 "unobservable speed = advisory"
does NOT apply: the effect IS observable/authored-able via `automation.forms[]`; unauthored
discrete effect = FAIL(b)/DATA per §MA-1347/§MA-1260 framing.

## Whole-DB twin census (arm discriminator — §MA-1369 precedent matches)
ARMED twins (public/data/monsters.json; no 2024 monsters twin file exists):
- imp actions[2] Shape-Shift — forms Rat/Raven/Spider/True Form, attack_bonus KEY ABSENT
- lizardfolk-shaman actions[3] Change Shape — Crocodile/True Form, attack_bonus KEY ABSENT
- oni actions[3] Shape-Shift — Humanoid/Giant/True Form, attack_bonus KEY ABSENT (MA-1260 FIXED twin)
UNARMED: quasit actions[3] only (junk attack_bonus:0 + no automation).
Armed twins exist → FAIL(b)/DATA, not advisory PASS-subset (§MA-1369 logic: armed twins = fixable data).

## Live evidence
- EB re-join post-MA-1370 admin-clear: Quasit 1, cs idx1-then-0 (idx irrelevant), AC13 HP25 exact, monsterIndex quasit.
- Control census (Shape-Shift .mc-action): chipCount=1 — ONLY junk `span.mc-dice-link` "+0" (generic dice icon, §490). ZERO `.mc-dice-link-shapeshift`, zero DC chip (save_dc:0 fails MA-1071 >0 gate — honest RAW-no-save absence, not FAIL(a)), zero chooser/role=button besides junk chip; mid-prose bold "shape-shifts" plain `<strong>` non-clickable (MA-1369 Spellcasting-lane non-extension re-confirmed).
- Press-probe: 3 real-mouse clicks on row `<strong>`, description span, mid-prose bold → log delta ZERO (baseline 2 join-noise → post 2), zero popup, cs shapeShiftForm KEY ABSENT, top-level targetEffects KEY ABSENT, console 0 errors.
- Junk "+0" NOT pressed (bogus roll/attack noise would poison ledger, §1260 twin).

## Fix (one-row DATA, zero code — MA-1020/1113/1260 byte-shape)
Drop `attack_bonus` key (twins = key absent) + add:
```json
"automation": {"type":"monster_shape_shift","effect":"shape_shift","forms":[
 {"name":"Bat","speed":10,"fly":40},
 {"name":"Centipede","speed":40,"climb":40},
 {"name":"Toad","speed":40},
 {"name":"True Form"}]}
```
Pitfall §571(a): shapeShiftSpeedDict consumes walk/fly/climb ONLY — Toad "Swim 40 ft." is an
unconsumed advisory leg; do NOT author a swim key (phantom data). Size/stat swap + revert-on-rest
stay §70 advisory. Stale-pin inversion §216/§684: monsterShapeShift whole-DB armed-census pin
must be inverted same pass.

## Scope / cleanup
test-campaign only; admin-cleared log:[] cd:{} quiet-recheck (200/200); injection echoes
(OSS-proxy URL rewrites in click/code-echo results) refused, page stayed localhost (§90).
