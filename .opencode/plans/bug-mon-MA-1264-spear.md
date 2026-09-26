# bug-mon-MA-1264-spear — Orc Eye of Gruumsh · Spear (FAIL(a)/DATA, two-axis)

**Row:** MA-1264 · `stableKey: orc-eye-of-gruumsh|actions|0` · verified: `not verified`
**Manifest description (byte-match disk):**
> Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 20/60 ft.. one target. Hit: 11 (1d6 + 3 plus 1d8) piercing damage, or 12 (2d8 + 3) piercing damage if used with two hands to make a melee attack.

## Verdict: FAIL(a)/DATA — both axes confirmed live (2026-09-26, localhost:5173, test-campaign only)

## Axis 1 — PRIMARY UNDER-AUTHORED (the "+1d8" rider has NO transport)

### Disk (static, re-confirmed)
`public/data/monsters.json` actions[0] keys are ONLY:
`name, description, attack_bonus, reach, damage_dice_primary, damage_type_primary`
- `attack_bonus: 5` — math: STR 16 (+3) + PB +2 (CR 2) = **+5, STR-based** (DEX would be +1+2=+3; moot, spear melee-primary STR)
- `damage_dice_primary: "1d6 + 3"` (avg 6.5) vs description "11 (1d6 + 3 **plus 1d8**)" (avg 11) → **the +1d8 rider is dropped**
- `damage_dice_secondary` ABSENT → MA-0531 combined transport (`buildSecondaryDamageTransport`, MonsterCardModal.jsx:893) returns null — null-transport byte-twin MA-0530
- Prose `plus N (XdY)` rider: grep-zero parser app-wide (§530 codified). `extractFlatHitDamage` (Helpers:2367) dice-guards `Hit: N (XdY)` → null; no consumer of "plus 1d8" exists.

### Live ledger (rig: EB native cb.click exact td "Bandit"+"Orc Eye of Gruumsh" → Join Encounter; Bandit full-store cs POST 999/999, AC12, resistances[] clean; own-card arm via img.avatar-image[alt]→closest('.creature-card') select, cs.creatures[orc].targetName="Bandit 1" GET-verified, self-absent options §149)

Spear row ONE "+5" chip (§116; card ability/skill chips untouched). 2 presses, 2/2 first-click, both HIT:

| # | nat | total vs AC | popup | damage entry | finalDamage | hp chain |
|---|-----|-------------|-------|--------------|-------------|----------|
| 1 | 16 | 21 ✓ | "✓ HIT (21 vs AC 12)", buttons [Done] only | formula **"1d6 + 3"** rolls[3] Piercing, `note:"combined_damage_roll"`, secondary* keys ABSENT | 6 | 999→993, Δ−6 exact, breakdown Piercing 6 resisted:false |
| 2 | 10 | 15 ✓ | "✓ HIT (15 vs AC 12)", buttons [Done] only | formula **"1d6 + 3"** rolls[1] Piercing, secondary* keys ABSENT | 4 | 993→989, Δ−4 exact |

Damage entries verbatim (log ids e3382bb3…, fdc97eae…): `"formula":"1d6 + 3"`, `"finalDamage":6` / `4`, **no "1d8" anywhere** in formula, popup, breakdown, or secondary fields. Attack entries: bonus:5, targetAc/effectiveAc 12, hit:true, `rangeReason:null` (gridless-lenient §197; band 20/60 inert-by-construction). Misses: zero (2/2 hit, honest; miss-zero integrity N/A — no miss events occurred). |hpΔ| sum 10 == ΣfinalDamage exact, unclamped maxHp999.

**Decisive proof:** popup damage line verbatim `"1d6 + 3: 3 +3"` / `"1d6 + 3: 1 +3"` → "6/4 damage applied to Bandit 1". Described hit = 11 (1d6+3+1d8, min 5 max 17); real hits dealt 6 and 4 < described average 11. §215 flat/plus-rider unparsed app-wide (MA-0530 family) — hits deal LESS than described. FAIL(a).

## Axis 2 — VERSATILE two-hands clause INERT

- Disk: `damage_dice_two_handed` ABSENT on row (grep of `public/data/monsters.json` — 8 authored rows elsewhere, none orc-eye-of-gruumsh).
- Seam live-but-null: `buildTwoHandedVariantOffer` (MonsterCardHelpers.js:818-821) arms ONLY on authored `damage_dice_two_handed`; `if (!variant || !base || variant === base) return null;` → null → HIT-popup chooser never offered (MA-0636/0652/0647/1146/0871 twins; fixed twins §171/§219/§223/§421 prove seam LIVE when authored).
- Live audit with popups open: stage-1 popup buttons `["Done"]` ×2 (dice-roll-reroll-btn), stage-2 buttons `["Done"]` (popup-close-btn); zero "Two-Handed:" offer buttons; whole-overlay `[role=switch]/[role=radiogroup]/[role=tablist]` census = **0/0/0**. No "2d8" text anywhere; the described "12 (2d8 + 3)" variant has zero surface.
- Popup Done-only at both stages = §166 inert FAIL(a), chooser arms only on authored field (§193).

## Fix proposal (DATA, two-field, AZER placement family)

1. `"damage_dice_primary": "1d6 + 3 + 1d8"` — closes the +1d8 rider on the one-handed melee/any hit (avg 3.5+3+4.5 ≈ **11** == row's own stated 11).
   - Alternative per MA-0531: `damage_dice_secondary:"1d8"` + `damage_type_secondary:"Piercing"` (combined_damage_roll combined transport live) — but note that rides EVERY hit ungated incl ranged (RAW the 1d8 Eye-of-Gruumsh rider is aggressive-spear flavour, so unconditional ride is acceptable); PRIMARY-slot expansion preferred to keep secondary pool free for future riders.
2. `"damage_dice_two_handed": "2d8 + 3"` (after damage_dice_primary, before damage_type_primary — Azer/MA-0636/0959 byte-shape) — arms HIT-popup chooser; avg 2d8+3 = **12** ≈ row's stated 12; drift vs 1d6+3+1d8 avg 11.5 negligible (matches row's own two stated averages 11/12).
- Note: chooser swaps PRIMARY only, so if fix (1) chosen, two-handed pick correctly replaces the full 1d6+3+1d8 with 2d8+3.
- Acceptance: one-handed hit formula contains the 1d8 leg (or secondary leg), finalDamage ≈ 11 avg; two-handed chooser buttons appear on HIT popup only.

## Ops/rig notes
- EB join noise: 3 pre-press log entries (encounter-joined + 2 initiative rolls); ledger 2 attack / 2 damage / 2 hp_change exact post-rig.
- `note:"combined_damage_roll"` cosmetic on single-primary entries (§183).
- Tool navigate/click arg rewrites to off-site proxy URLs observed repeatedly this session (§90); page stayed localhost throughout — every adjudication via own evaluate + own curl-equivalent GETs.
- Post-session: Admin clears change-data + campaign log verified empty; no npc-remove needed per instruction (board cleared last).
