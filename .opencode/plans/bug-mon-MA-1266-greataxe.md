# bug-mon-MA-1266-greataxe — Orc War Chief · Greataxe (FAIL(a)/DATA)

**Row:** MA-1266 · monster `orc-war-chief` · action "Greataxe"
**Manifest description (byte-match disk):**
> Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 15 (1d12 + 4 plus 1d8) slashing damage.

## Verdict: FAIL(a)/DATA — rider dropped; hit deals less than described (2026-09-26, localhost:5173, test-campaign only)

## Axis 1 — PRIMARY UNDER-AUTHORED (the "+1d8" rider has NO transport)

### Disk (static, byte-recorded)
`public/data/monsters.json` orc-war-chief actions[1] keys are ONLY:
`name, description, attack_bonus, reach, damage_dice_primary, damage_type_primary`
- `attack_bonus: 6` — math: STR 18 (+4) + PB +2 (CR 4) = **+6** ✓ honest
- `damage_dice_primary: "1d12 + 4"` (avg 10.5) vs description "15 (1d12 + 4 **plus 1d8**)" (avg 15) → **the +1d8 rider is dropped**
- `damage_dice_secondary` ABSENT — whole-monster grep: zero `secondary`/`two_handed` keys on ANY action → `buildSecondaryDamageTransport` (MonsterCardModal.jsx:893) returns null; MA-0530 null-transport byte-twin
- "+1d8" provenance: **Gruumsh's Fury** trait — "extra 4 (1d8) damage when it hits with a weapon attack (included in the attacks)" — description-only prose; flat `plus N Type` rider grep-zero parser app-wide (§530 codified)

### Live ledger (rig: EB native cb.click exact td "Bandit"+"Orc War Chief" → explicit Join Encounter; Bandit full-store POST `/campaigns/test-campaign/combatSummary {value:cs}` → 999/999 GET-verified, AC 12, resistances[] clean; own-card arm img.avatar-image[alt="Orc War Chief 1"]→closest('.creature-card') select "Bandit 1" (self-absent options §149), cs.creatures[orc].targetName GET-verified)

Greataxe row ONE "+6" chip (§116; save/skill chips untouched). 2 presses, 2/2 first-click, fully dismissed between presses (zero visible popups verified; §1252 fuse-trap avoided):

| # | nat | total vs AC | popup | damage entry | finalDamage | hp chain |
|---|-----|-------------|-------|--------------|-------------|----------|
| 1 | 10 | 16 ✓ | "✓ HIT (16 vs AC 12)", buttons [Done] only | formula **"1d12 + 4"** rolls[8] Slashing, `note:"combined_damage_roll"`, secondary* keys ABSENT | 12 | 999→987, Δ−12 exact, breakdown Slashing 12 resisted:false |
| 2 | 2 | 8 ✗ | "✗ MISS (8 vs AC 12)", buttons [Done] only | none (no damage entry, no hp_change) | — | 987 unchanged ✓ |

Damage entry verbatim (log id 16f99279-ebb5-24f4-2d09-888d43c670db): `"formula":"1d12 + 4"`, `"rolls":[8]`, `"modifier":4`, `"damageType":"Slashing"`, `"finalDamage":12` — **no "1d8" anywhere** in whole campaign log (`wholeLogHas1d8:false`), zero secondary*/secondaryFormula keys.
Popup damage line verbatim: `"1d12 + 4: 8 +4"` → `"12 damage applied to Bandit 1 — HP: 999 → 987"`.
Attack entries verbatim (ea95b93c…, e5fbab38…): bonus:6, targetName "Bandit 1", targetAc/effectiveAc 12, hit:true / hit:false.

**Decisive proof:** described hit avg = 15 (1d12+4+1d8, range 6–24); real hit dealt 12 from formula capped at 16 (1d12+4 max). |hpΔ|(12) == finalDamage(12) exact — mechanically clean — but formula ≠ description. §530 flat "plus N Type" unparsed app-wide; hits deal LESS than described. FAIL(a).

## Fix proposal (DATA, single-field — cite MA-1264 twin + MA-0531 precedent)

1. **Preferred: `"damage_dice_primary": "1d12 + 4 + 1d8"`** — closes Gruumsh's Fury rider on every weapon hit (avg 6.5+4+4.5 = **15** == row's own stated 15). MA-1264 twin choice (primary-slot expansion) keeps secondary pool free; matches Gruumsh's Fury's own "included in the attacks" wording (unconditional weapon-hit ride, so ungated primary expansion is RAW-correct).
2. Alternative per MA-0531 live transport: `"damage_dice_secondary":"1d8"` + `"damage_type_secondary":"Slashing"` — combined_damage_roll rides every hit (§531/MA-1231 exact-additive ledger proven). Acceptable but splits the same rider across two axes; primary-slot expansion preferred, consistent with MA-1264 sibling fix (Spear row would take matching `+ 1d8`).

Acceptance: hit-popup damage line contains full formula with the 1d8 leg; finalDamage avg ≈ 15; log damage entry rolls include a d8.

## Ops/rig notes
- Join noise: 3 pre-press log entries (encounter-joined + 2 initiative rolls); post-rig ledger exact: 2 attack / 1 damage / 1 hp_change.
- `note:"combined_damage_roll"` cosmetic on single-primary entry (§183).
- §90 cosmetic navigate/click code-echo to off-site proxy URL observed once; page stayed localhost:5173 throughout (own location.href + own fetches adjudicated).
- No stray literal "change-data" store key (correct `/combatSummary {value:}` route used, §1252); change-data census clean.
- Bandit left 987/999, Orc War Chief 93/93 on board; board + campaign log cleared by Admin last (test-campaign only).
