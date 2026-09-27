# Bug MA-1363 — Quaggoth Claw: Bloodied damage variant prose-only, no chooser, base-only fire

**Verdict:** FAIL(a) — **DATA-MISSING** (variant clause token absent; consumer seam live-unarmed)
**Row:** quaggoth | actions | 1 — "Claw" (+5, 1d6 + 3 Slashing, reach 5 ft.)
**Session:** 2026-09-26, test-campaign only, localhost:5173 (reused), 0 console errors.

## Expected (manifest/monsters.json description)
"Hit: 6 (1d6 + 3) Slashing damage, or 13 (3d6 + 3) Slashing damage if the quaggoth is Bloodied."
→ A variant-clause chooser (or Bloodied-aware damage swap) offering the boosted 3d6+3 branch when the quaggoth is Bloodied.

## Actual (live)
- Claw press opens stage-1 popup with buttons **[Done] only** (`.dice-roll-reroll-btn`); stage-2 **[Done] only** (`.popup-close-btn`). Regex `/Bloodied|3d6|variant|Charge/i` FALSE on every popup stage, healthy AND forced-Bloodied (9 presses).
- Every stage-2 rolls base **"1d6 + 3"** — "3d6 + 3" never offered, never rolled, even with Bloodied state forced (server cs `currentHp:20 / maxHp:999` ≤ floor(999/2), re-staged via full-store cs POST + reload + re-select + re-arm).
- §827 MA-1362 "Bloodied alt prose-only advisory" — **CONFIRMED live, not contradicted** (and per §827-line principle, the component row MA-1363 carries this axis for adjudication).

## Static proof (step 1)
monsters.json quaggoth actions[1] verbatim fields: `attack_bonus:5`, `damage_dice_primary:"1d6 + 3"`, `damage_type_primary:"Slashing"`, `reach:"5 ft."`, `save_dc:0`, `save_type:""`, `save_effect:""`. **NO structured variant field** — no `conditional_damage`, no `damage_dice_variant`/`variant_condition`/`bloodied` key; clause lives solely in `description` prose.

## Grep cites (no consumer)
- `buildChargeBonusOffer` (MonsterCardHelpers.js:622-624): `if (!cd?.dice) return null` — structured `conditional_damage` only (MA-0007); riders hit-popup only (DiceRollResult.jsx:836, useLoggedDiceRollAttack.js:277).
- Versatile/ranged variant machinery field-armed: `damage_dice_two_handed` (Helpers:687/742), `damage_dice_ranged` (§193/§284).
- `parseAnimalSpiritVariants` (Helpers:263-269): byte-locked to Fortify/Prey/Swarm save_effect headers — §8 MA-0275 chooser is SAVE-row-only; N/A to attack damage rows.
- `bloodied` grep: display badge (CreatureHp.jsx:67), split-reaction gate (Helpers:1488), PC healing gates (healingHandler.js:248, turnStartEffects.js:423) — **zero** hits in useLoggedDiceRollAttack / useLoggedDiceRollDamage / handlePlainDamage (attack damage seam).
- No description-prose parser for "or N (XdY + M) if <condition>" anywhere on the attack path (§125 MA-0485 fingerprint).

## Live ledger (9 rolls, 7 hits, 2 misses — base axis LIVE + exact)
| # | State | Roll | Result | Popup formula | fd | Bandit HP |
|---|-------|------|--------|---------------|----|-----------|
| 1 | healthy | d20 7 +5 | ✓ AC12 | 1d6 + 3: 2 +3 | 5 | 999→994 |
| 2 | healthy | d20 16 +5 | ✓ | 1d6 + 3: 5 +3 | 8 | 994→986 |
| 3 | healthy | d20 8 +5 | ✓ | 1d6 + 3: 2 +3 | 5 | 986→981 |
| 4 | healthy | d20 6 +5 | ✗ | — | 0 | — |
| 5 | healthy | d20 7 +5 | ✓ | 1d6 + 3: 5 +3 | 8 | 981→973 |
| 6 | **Bloodied** | d20 15 +5 | ✓ | 1d6 + 3: 2 +3 | 5 | 973→968 |
| 7 | **Bloodied** | d20 17 +5 | ✓ | 1d6 + 3: 5 +3 | 8 | 968→960 |
| 8 | **Bloodied** | d20 6 +5 | ✗ | — | 0 | — |
| 9 | **Bloodied** | d20 12 +5 | ✓ | 1d6 + 3: 4 +3 | 7 | 960→953 |

Σfd = 46 == |999−953| exact. Log: every attack entry bonus:5 vs ac:12 targetName "Bandit 1"; damage formula byte-exact "1d6 + 3" (cosmetic `combined_damage_roll` note §188); saveDc/saveType null on every entry; `pendingSavePrompts` null; zero `saveResult-*` keys (§117 decoy honest). Crit seam unobserved (no nat20 in 9; +5 crit-starved §720; same-chip precedent MA-1227/MA-1362).

## Rubric application (briefing §8 axis)
Variant-clause chooser IS implemented-for-others whenever data carries the structured token (MA-0007 conditional_damage live on seahorse/elk/giant-goat/galeb-duhr MA-0756; versatile MA-0636/0652; dual-mode MA-0436; animal-spirit save §8). This row lacks the clause token entirely → **FAIL(a)/DATA (data-missing)**, per MA-0485 (§125) precedent.

## Suggested fix (one field, existing seam)
`conditional_damage: {dice:"2d6", damage_type:"Slashing", condition:"bloodied"}` on actions[1] — arms the live GM-adjudicated HIT-popup offer (1d6+3 base + 2d6 bonus = 13 avg face of 3d6+3).
Fix-ticket notes: (a) offer label renders "Charge: +2d6 Slashing?" — `chargeOfferLabel` hardcodes "Charge" when no feet token (Helpers:616-619) → cosmetic, generalize label to condition text; (b) app does NOT auto-evaluate "bloodied" — offer is GM-adjudicated (Bloodied threshold machinery exists: CreatureHp.jsx:67 / Helpers:1488 if auto-eval wanted later).

## Cleanup
Admin clear-change-data + clear-log both 200; cs null + log empty verified after. Registry `Quaggoth.config.verifiedRow2` appended, JSON.parse OK.
