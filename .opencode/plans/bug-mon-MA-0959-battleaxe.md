# Bug MA-0959 — Half Ogre | actions[0] | Battleaxe — FAIL(a): versatile clause inert

## Verdict
FAIL(a) — **versatile clause** (MA-0325 family). One-handed core numerics PASS; the two-hands variant is inert-by-construction and the row also carries an OCR corruption.

## Expected (from manifest row MA-0959, stableKey half-ogre|actions|0)
Full row description including the versatile clause:

> "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 12 (2d8 + 3) slashing damage, or 14 (2dl0 + 3) slashing damage if used with two hands."

- Canonical RAW two-hands formula is **2d10 + 3** (avg 14) — the disk "2dl0" is an OCR typo (lowercase L), §23 family. Even the inert clause text is corrupt.
- §166: a live versatile seam requires authored `damage_dice_two_handed` → HIT-popup chooser (buildTwoHandedVariantOffer, src/components/encounter/MonsterCardHelpers.js:767-780; armed at MonsterCardModal.jsx:1059 `twoHandedVariantOffer: buildTwoHandedVariantOffer(v.action, v.name)` — returns null when the field is absent, so prose-only clauses cannot arm).

## Actual (live, test-campaign, 2026-09-23)
One-handed core PASS numerics:
- "+5" chip per row (§119, single span.mc-dice-link per action row); vs live Bandit 1 AC12.
- 6 attack fires (nats 13, 7, 9, 8, 14, 12; all +5, all HIT; boundary HIT nat7 total 12 vs AC12). No nat≤6 in budget ⇒ MISS side not observed (§94 miss-zero template twin MA-0792 on same Bandit rig).
- 5 damage apps (press-3 Done-less backdrop-dismiss applied nothing, per §397/§94): each formula "2d8 + 3" slashing exactly, dice flat-once, isCrit false (no nat20 ⇒ no 4d8 branch needed):
  | rolls | total | fd | resisted | HP trail |
  |---|---|---|---|---|
  | [5,4]+3 | 12 | 12 | 0 | 370→358 |
  | [1,6]+3 | 10 | 10 | 0 | 358→348 |
  | [8,3]+3 | 14 | 14 | 0 | 348→334 |
  | [1,4]+3 | 8  | 8  | 0 | 334→326 |
  | [4,6]+3 | 13 | 13 | 0 | 326→313 |
- fd == |hp_change| each entry; Σfd 57 == 370−313 ✓; Bandit damage_resistances empty ⇒ slashing resisted:false correct.

Zero-chooser audit (§166): on HIT popup `[role=switch]`=0, `[role=radiogroup]`=0, `[role=tablist]`=0; no "two-handed"/"two hands" text in popup; only button is Done. Unpicked Done collapses straight to applied stage (§397). Stage-2 flush via own click; popups=0, card open.

OCR cite: disk description carries `14 (2dl0 + 3)` — "2dl0" corrupt (canonical `2d10`).

## Steps to reproduce
1. localhost:5173, test-campaign, EB search exact "Half Ogre" → checkbox → Join Encounter (cs gains "Half Ogre 1", §95 exact vs Ogre siblings).
2. Half Ogre 1 row target select → Bandit 1 (AC12, 370/999 rig).
3. Open Half Ogre card, click Battleaxe "+5" chip → HIT popup: no two-handed chooser ever offered; Done applies one-handed 2d8+3 only.

## Likely Location
`public/data/monsters.json` → half-ogre.actions[0] — one-field data fix per MA-0636/0652/0647 template (fix template §171):
```json
"damage_dice_two_handed": "2d10 + 3"
```
plus OCR description fix "2dl0" → "2d10".

## Notes
- Family: prose-only versatile rows with no `damage_dice_two_handed` field — measured 13 open siblings in monsters.json (manifest §171 states ~16): bullywug|actions|2, half-red-dragon-veteran|actions|1, hobgoblin|actions|0, kuo-toa|actions|1, lizard-king-queen|actions|3, merfolk|actions|0, orc-eye-of-gruumsh|actions|0, orc-war-chief|actions|2, sahuagin|actions|3, tribal-warrior|actions|0, vampire|actions|1, veteran|actions|1 (+ half-ogre|actions|0 = this row).
- Fixed template siblings with the field authored: MA-0325 (Azer Warhammer), MA-0636/0647 (Quarterstaff), MA-0652/MA-0871 (Gnoll Spear).
- combined_damage_roll note on damage entries = cosmetic §183.

## Rig state (left intact)
Half Ogre 1 joined + Bandit 1 armed; Bandit 1 HP drifted 370 → 313 (Δ57). No clears. MA-0960 (Javelin, same monster) follows.
