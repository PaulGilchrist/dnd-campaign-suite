# MA-1146 — Merfolk Spear: versatile "or 1d8 two hands" clause inert (FAIL(a))

## Overview

Merfolk `actions[0]` "Spear" is a melee-or-ranged weapon attack whose prose carries a
versatile damage clause: "or 4 (1d8) piercing damage if used with two hands to make a
melee attack." The versatile variant is authored ONLY in prose. The live two-handed
chooser seam (`buildTwoHandedVariantOffer`) arms solely on the structured
`damage_dice_two_handed` field, which is absent from disk. Result: the base attack
adjudicates byte-exact (+2 / 1d6 Piercing), but the 1d8 two-handed leg can never
surface — no chooser, no variant, zero `1d8` in the log. Same family as MA-0325 /
MA-0636 (drider Longsword) / MA-0652 (druid Quarterstaff) / MA-0871 (gnoll Spear).
One-field data fix required.

## Expected (row text, manifest MA-1146)

> Melee or Ranged Weapon Attack: +2 to hit, reach 5 ft. or range 20/60 ft., one target.
> Hit: 3 (1d6) piercing damage, **or 4 (1d8) piercing damage if used with two hands to
> make a melee attack.**

A GM should be able to adjudicate the two-handed 1d8 variant via the HIT-popup chooser
(seam precedent: Azer Warhammer, MA-0636/MA-0652/MA-0647 fixed twins).

## Actual (live evidence, test-campaign, 2026-09-24/25)

- Base attack exact: ONE "+2" chip on Spear row (§116 single-primary), zero DC chips;
  10 attacks vs Bandit 1 AC 12: nats 12✓ 9✗ 16✓ 3✗ 7✗ 13✓ 9✗ 16✓ 4✗ 15✓ — 6 hits,
  4 honest misses (nat ≤ 9). Popup totals byte-confirm nat+2: "14 = d20 12 +2",
  "18 = d20 16 +2", "17 = d20 15 +2" (§452 leading-total chrome).
- Damage applied 2x (Done-confirmed): formula **"1d6"** finalDamage 5 Piercing each;
  hp_change Δ−5, Δ−5 (999→994→989); |Δ| == finalDamage exact both, sum 10 exact;
  secondaryFormula null; note `combined_damage_roll` cosmetic (§183).
- Toggle audit (card + every popup, live-DOM rect/visibility census):
  `[role=switch]`=0, `[role=radiogroup]`=0, `[role=tablist]`=0, `select`=0,
  two-handed/versatile/melee-ranged chooser buttons = 0.
- Campaign log grep: **"1d8" zero**, "two-handed"/"versatile" zero — variant never fired.
- Victim rig: init-card HP inputs → cs Bandit 1 currentHp 999 unclamped (§450);
  armed via Merfolk init-card Target select → cs.creatures["Merfolk 1"].targetName
  = "Bandit 1" (§447 order, §452 creature-entry read).
- Note: attack-log `total` stamps the nat (12/9/16/...) while popup adjudicates
  nat+bonus totals — §414 mis-stamp family, cited not counted as defect.

## Likely Location — data gap, seam live-but-unarmed

`public/data/monsters.json` → merfolk → `actions[0]` (disk-verified):
`attack_bonus: 2`, `reach: "5 ft."`, `damage_dice_primary: "1d6"`,
`damage_type_primary: "Piercing"` — **NO `damage_dice_two_handed`**, NO
`range`/`damage_dice_ranged`. `prof_bonus: null` (advisory).

Seam citations (live code, unarmed for this row):
- `src/components/encounter/MonsterCardHelpers.js:793-795` — `buildTwoHandedVariantOffer`
  reads `action?.damage_dice_two_handed`; `if (!variant ...) return null` →
  "Rows without the key are byte-inert (null)" (:790 comment).
- Wired: `src/components/encounter/MonsterCardModal.jsx:1087`
  (`twoHandedVariantOffer: buildTwoHandedVariantOffer(v.action, v.name)`).
- Consumed: `src/hooks/combat/useLoggedDiceRollAttack.js:280` — HIT popup chooser only.
- Ranged leg twin seam `buildRangedVariantOffer` (MA-0436, Modal:1088) equally unarmed:
  no `range`/`damage_dice_ranged` authored.

## Fix

One-field data fix (Azer/MA-0636/MA-0652/MA-0647 placement: after
`damage_dice_primary`, before `damage_type_primary`). The row prose carries NO damage
modifier ("Hit: 3 (1d6) ... or 4 (1d8)"), unlike the MA-0652 quarterstaff twin whose
prose rode "+2" — so the exact field mirrors the base leg's modifier-less shape:

```json
"damage_dice_two_handed": "1d8"
```

Note `variant === base` guard (Helpers:796) does not trip ("1d8" ≠ "1d6").

Secondary note: the "range 20/60 ft." ranged leg is inert-by-construction (gridless;
no `range`/`damage_dice_ranged` authored; rangeReason null lenient, MA-0661 Duodrone
Javelin / MA-0872 precedent) — record as by-construction, not a separate defect; add
`damage_dice_ranged:"1d6"` + `range:"20/60 ft."` only if a melee-vs-ranged chooser is
ever prioritized (MA-0436 seam).

## Steps to Reproduce

1. localhost:5173 → select **test-campaign** (verify header).
2. Encounters → search "Merfolk" → tick exact row → search "Bandit" → tick exact
   `td` text "Bandit" → **Join Encounter** (auto-navigates to Initiative).
3. Initiative: rig Bandit 1 current HP 999 (fill+Enter), then arm Merfolk 1 card
   Target select → "Bandit 1" (§447 order).
4. Open Merfolk 1 card (`img[alt="Merfolk 1"]`) → Spear row → click "+2" chip.
5. On any HIT popup press exact-text "Done" → damage stage applies "1d6" Piercing.
6. Observe: no two-handed/versatile chooser ever appears (card + popups toggles 0);
   log never prints 1d8; two-handed 1d8 option is unreachable.

## Verdict

**FAIL(a)** — base attack exact BUT versatile 1d8 clause inert-by-missing-data
(live chooser/toggle/grep audit + seam grep proven live-but-unarmed).
Per MA-0652 precedent: fix = one field `damage_dice_two_handed:"1d8"`.
