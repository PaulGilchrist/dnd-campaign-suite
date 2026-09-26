# bug-mon-MA-1267-spear — Orc War Chief · Spear (FAIL(a)/DATA, two-axis — FAST twin of MA-1264 + MA-1266)

**Row:** MA-1267 · `stableKey: orc-war-chief|actions|2` · verified: `not verified` (manifest untouched)
**Manifest description (byte-match disk):**
> Melee or Ranged Weapon Attack: +6 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 12 (1d6 + 4 plus 1d8) piercing damage, or 13 (2d8 + 4) piercing damage if used with two hands to make a melee attack.

## Verdict: FAIL(a)/DATA — both axes confirmed live (2026-09-26, localhost:5173, test-campaign only)

## Axis 1 — PRIMARY UNDER-AUTHORED (the "+1d8" Gruumsh's Fury rider has NO transport)

### Disk (static, byte-recorded)
`public/data/monsters.json` orc-war-chief actions[2] keys are ONLY:
`name, description, attack_bonus, reach, damage_dice_primary, damage_type_primary`
- `attack_bonus: 6` — math: STR 18 (+4) + PB +2 (CR 4) = **+6** ✓ honest (same monster/ability as MA-1266 Greataxe twin)
- `damage_dice_primary: "1d6 + 4"` (avg 7.5, max 10) vs description "12 (1d6 + 4 **plus 1d8**)" (avg 12, max 17) → **the +1d8 rider is dropped**
- `damage_dice_secondary` ABSENT (whole-monster grep: zero `secondary`/`two_handed` keys on ANY of the 4 actions) → `buildSecondaryDamageTransport` (MonsterCardModal.jsx:893) returns null — MA-0530 null-transport byte-twin
- "+1d8" provenance: **Gruumsh's Fury** trait — "extra 4 (1d8) damage when it hits with a weapon attack (included in the attacks)" — description-only prose; flat `plus N Type` rider grep-zero parser app-wide (§530 codified; MA-1266 same-monster proof)

### Live ledger (rig: cs empty admin-cleared → EB native cb.click exact td "Bandit"+"Orc War Chief" → explicit Join Encounter [EB auto-added party + ×2 duplicates — inert noise, never pressed]; Bandit 1 full-store cs POST `/campaigns/test-campaign/combatSummary {value:cs}` → 999/999 GET-verified, AC 12, resistances[] clean; own-card arm `img.avatar-image[alt="Orc War Chief 1"]`→closest('.creature-card') selectOption "Bandit 1" (self-absent options §149), cs.creatures[orc].targetName="Bandit 1" GET-verified; log baseline 10)

Spear row ONE "+6" chip (§116; ActionDamageLinks self-suppresses damage chip on attack_bonus rows). 2 presses, 2/2 first-click, both HIT, fully dismissed between presses (openPopups 0 verified pre-press-2):

| # | nat | total vs AC | popup | damage entry | finalDamage | hp chain |
|---|-----|-------------|-------|--------------|-------------|----------|
| 1 | 7 | 13 ✓ | "✓ HIT (13 vs AC 12)", buttons [Done] only (dice-roll-reroll-btn) | formula **"1d6 + 4"** rolls[4] Piercing, `note:"combined_damage_roll"` (§183 cosmetic), secondary* keys ABSENT | 8 | 999→991, Δ−8 exact, breakdown Piercing 8 resisted:false |
| 2 | 7 | 13 ✓ | "✓ HIT (13 vs AC 12)", buttons [Done] only | formula **"1d6 + 4"** rolls[6] Piercing, secondary* keys ABSENT | 10 | 991→981, Δ−10 exact |

Damage entries verbatim (log ids b793e683…, 5f9202ad…): `"formula":"1d6 + 4"`, `"finalDamage":8` / `10`, **no "1d8" anywhere** in formula/popup/breakdown/secondary (`wholeLogFormulaHas1d8:false`). Attack entries verbatim (669004be…, 0b9691eb…): bonus:6, targetName "Bandit 1", targetAc/effectiveAc 12, hit:true, `rangeReason:null` (gridless-lenient §197; band 20/60 inert-by-construction — no `range` key on disk). Same-nat repeat honest per §77 (damage dice 4 vs 6, distinct ids/ledgers). |hpΔ| sum 18 == ΣfinalDamage exact, unclamped maxHp 999. Misses: zero (2/2 hit; miss-zero integrity N/A).

**Decisive proof:** popup damage lines verbatim `"1d6 + 4: 4 +4"` → "8 damage applied to Bandit 1 — HP: 999 → 991" and `"1d6 + 4: 6 +4"` → "10 damage… 991 → 981". Described hit avg 12 (1d6+4+1d8, range 6–17); formula capped at 10 — every real hit ≤10 < described average. MA-1266 byte-twin on sibling row; hits deal LESS than described. FAIL(a).

## Axis 2 — VERSATILE two-hands clause INERT

- Disk: `damage_dice_two_handed` ABSENT (whole-file census: 11 authored rows — azer/drider/drow-mage/druid/gnoll/half-ogre/half-red-dragon-veteran/hobgoblin/kuo-toa/lizard-king-queen/merfolk — none orc-war-chief).
- Seam live-but-null: `buildTwoHandedVariantOffer` (MonsterCardHelpers.js:818-821) arms ONLY on authored `damage_dice_two_handed`; `if (!variant || !base || variant === base) return null;` → HIT-popup chooser never offered (§166/§193; MA-1264 Eye-of-Gruumsh twin same-day; fixed twins MA-0636/0959/1146 prove seam LIVE when authored).
- Live audit with popups open: stage-1 popup buttons `["Done"]` ×2, stage-2 buttons `["Done"]` (popup-close-btn) ×2; zero "Two-Handed:" offer buttons; whole-overlay `[role=switch]/[role=radiogroup]/[role=tablist]` census = **0/0/0**. No "2d8" on any popup surface (body grep only card-prose echo); described "13 (2d8 + 4)" variant has zero surface.

## Fix proposal (DATA, two-field — MA-1264 twin + MA-0636 placement family)

1. `"damage_dice_primary": "1d6 + 4 + 1d8"` — closes Gruumsh's Fury rider on every weapon hit incl. ranged (trait wording "included in the attacks" = unconditional ride, primary-slot expansion preferred, keeps secondary pool free; MA-1264/MA-1266 sibling choice). Avg 3.5+4+4.5 = **12** == row's own stated 12.
2. `"damage_dice_two_handed": "2d8 + 4"` (after damage_dice_primary, before damage_type_primary — Azer/MA-0636 byte-shape) — arms HIT-popup chooser; avg 2d8+4 = **13** == row's own stated 13. Chooser swaps PRIMARY only, so two-handed pick correctly replaces the full 1d6+4+1d8 with 2d8+4.

Acceptance: one-handed hit-popup damage line contains full formula with the 1d8 leg, finalDamage avg ≈ 12; "Two-Handed: 2d8 + 4"/"One-Handed: 1d6 + 4 + 1d8" chooser buttons appear on HIT popup only (target Done by exact text §397/§584).

## Ops/rig notes
- EB Join noise: baseline grew 7→10 pre-press (encounter-joined + 2 initiative rolls); EB auto-added full PC party + Orc War Chief 2 + Bandit 2 (party list auto-populates; never pressed, zero non-target ledger impact — §436 stale-board caution: adjudicate via cs GET not board).
- Pre-rig stale restore: Bandit 1 respawned at 987/999 (MA-1266 remnant inside join snapshot) — normalized via full-store POST, GET-verified 999/999 (§106-class; no stray "change-data" key — correct `/combatSummary {value:}` route §1252).
- Attack `rolls:[7,10]`/`[7,8]` two-value arrays with total=nat — cosmetic second-die field; popup + total + bonus adjudicate single d20 (MA-1264 twin shape).
- §90 cosmetic navigate code-echo to off-site proxy URL observed once; page stayed localhost:5173 throughout (own location.href + own fetches adjudicated).
- Cleanup: Admin Clear Change Data + Clear Campaign Log last, test-campaign only; manifest NOT edited; board left cleared.
