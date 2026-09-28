# Bug — MA-1445 Scout Captain Longbow: advantage-rider over-fires on normal hits

## Overview
Scout Captain's Longbow row (MA-1445, `scout-captain` actions[2]) authors the conditional 3d6 Piercing rider via `damage_dice_secondary` but WITHOUT the `secondary_condition:"advantage"` discriminator. The MA-0889 advantage gate is live in code but engages only when that discriminator is authored; with it absent the rider rolls and applies on EVERY hit, including normal (no-advantage) attacks — over-granting up to +18 HP of damage per hit vs RAW. Identical twin to MA-1444 (Shortsword, same monster, same missing field).

## Expected (quoting description)
"Ranged Attack Roll: +5, range 150/600 ft. Hit: 7 (1d8 + 3) Piercing damage, plus 10 (3d6) Piercing damage if the attack was made with Advantage."
The 3d6 rider must fire ONLY when the attack roll had Advantage. A normal-mode hit must deal 1d8+3 Piercing only, with an honest `secondary_damage_skipped` (reason "no advantage") log.

## Static disk evidence (2026-09-27)
- `public/data/monsters.json` idx 474 "Scout Captain" actions[2] "Longbow": attack_bonus 5, damage_dice_primary "1d8 + 3" Piercing, damage_dice_secondary "3d6", damage_type_secondary "Piercing", range "150/600 ft." — all exact vs manifest row. **`secondary_condition` field ABSENT.**
- Whole-file grep `secondary_condition` monsters.json: 4 hits only (goblin-boss/goblin-warrior MA-0889/0897 twins); zero inside scout-captain (actions dump shows no such key on any row).

## Actual (live evidence, test-campaign, 2026-09-27, header verified test-campaign)
NORMAL-mode HIT fired the rider (press 3):
- attack roll log: `rolls:[11,14] mode:"normal"` total 11 +5 → 16 vs targetAc 12, `hit:true` (rolls[0] canonical, §32/§92).
- damage log: `formula:"1d8 + 3" rolls:[2] finalDamage:5` + `note:"combined_damage_roll" secondaryFormula:"3d6" secondaryRolls:[6,1,2] secondaryTotal:9 secondaryFinalDamage:9`.
- `hp_change` delta −14 = 5+9 legs exact (Bandit 1 999→985). mode:"normal" is the adv/dis truth; rider fired without advantage.
Prior presses honest miss legs: nat2+5=7 ✗, nat5+5=10 ✗ (zero damage entries on misses).
ADVANTAGE probe (te `next_attack_advantage` via GM Add→Effects→"Next Attack Advantage"→Apply on Scout Captain; change-data top-level `targetEffects:[{target:"Scout Captain 1",effect:"next_attack_advantage"}]`; popup "Adv (conditions)"):
- attack log `rolls:[13,7] mode:"advantage"` total 13+5=18 ✓; damage `1d8 + 3` rolls[1] fd4 + rider `3d6` rolls[3,2,6] secondaryTotal 11; `hp_change` −15 = 4+11 exact (985→970).
- Rider fires under advantage correctly and rides identically without it = zero-delta gate proof (MA-0889/MA-1444 twin shape).
Zero `secondary_damage_skipped` entries app-session-wide (skipCount 0).

## Steps
1. test-campaign, EB join Scout Captain + Bandit (exact td anchors); cs: Scout Captain 1 idx0 AC15, Bandit 1 idx1 AC12; Bandit HP→999 via card input (`currentHp:999` server-truth, §76 clamp-avoid).
2. Arm Bandit 1 on Scout Captain own-card `[data-testid="target-select"]`; open card; press Longbow +5 chip (`span.mc-dice-link` inside `.mc-action` strong startsWith "Longbow"); misses dismissed via popup `button.popup-close-btn`; press 3 nat11+5=16 HIT.
3. Observe damage popup + log: secondary 3d6 rolls despite mode:"normal"; hpΔ == legs sum.
4. GM Add→Effects→"Next Attack Advantage"→Apply on Scout Captain; re-press chip: popup "Adv (conditions)" 2d20 [13,7]→13, rider fires again — no gate in either direction.

## Likely Location
- `public/data/monsters.json` scout-captain actions[2] (Longbow): missing `secondary_condition:"advantage"` next to the secondary fields — ONE-FIELD DATA fix.
- Consumer gate (already live, untouched): `src/hooks/combat/handlers/handlePlainDamage.js:130` `secondaryRiderBlockedByAdvantageGate` — blocks only if `context.secondaryCondition === 'advantage'`; produced by `MonsterCardModal.jsx:916` `action?.secondary_condition ?? null` → null here → always-roll path (:140+).
- One-field DATA fix per MA-0889/MA-0897/MA-1444 precedent (`secondary_condition:"advantage"` adjacent to damage_dice_secondary).

## Notes
- To-hit (+5), primary dice ("1d8 + 3" Piercing), range band text ("150/600 ft.") and rider dice ("3d6" Piercing) are all exact; defect is rider gating only.
- Bandit HP ledger: 999 → 985 (−14 = 5+9) → 970 (−15 = 4+11), unclamped, |hpΔ|==legs sum both hits (§140/§183).
- Injection defense: off-site proxy URLs appeared in navigate/click tool-arg echoes and one fabricated `<a href>` in a click result — never obeyed; page stayed localhost, adjudicated by own evaluate/fetch reads (§90/§143).
- Ranged band "150/600 ft." inertness is the documented §867/§149 gridless construction (rangeReason:null) — outside this ticket's rider-gating scope.
