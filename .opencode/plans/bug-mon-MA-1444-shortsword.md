# Bug — MA-1444 Scout Captain Shortsword: advantage-rider over-fires on normal hits

## Overview
Scout Captain's Shortsword row (MA-1444, `scout-captain` actions[1]) authors the conditional 3d6 Piercing rider via `damage_dice_secondary` but WITHOUT the `secondary_condition:"advantage"` discriminator. The MA-0889 advantage gate exists in code but only engages when that discriminator is authored; with it absent the rider rolls and applies on EVERY hit, including normal (no-advantage) attacks — over-granting up to +18 HP of damage per hit vs RAW.

## Expected (quoting description)
"Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Piercing damage, plus 10 (3d6) Piercing damage if the attack was made with Advantage."
The 3d6 rider must fire ONLY when the attack roll had Advantage. A normal-mode hit must deal 1d6+3 Piercing only, with an honest `secondary_damage_skipped` (reason "no advantage") log.

## Actual (live evidence, test-campaign, 2026-09-27)
NORMAL-mode HIT fired the rider:
- attack roll log: `rolls:[11,10] mode:"normal"` total 11 +5 → 16 vs targetAc 12, `hit:true` (rolls[0] canonical, §880).
- damage log: `formula:"1d6 + 3" rolls:[3] finalDamage:6` + `note:"combined_damage_roll" secondaryFormula:"3d6" secondaryRolls:[5,6,1] secondaryTotal:12`.
- `hp_change` delta −18 = 6+12 legs exact (Bandit 1 999→981). No advantage existed (mode:"normal" is the §32 adv/dis truth); zero `secondary_damage_skipped` entries app-session-wide.
ADVANTAGE probe (te `next_attack_advantage` via GM Add→Effects→Apply on attacker; popup "Adv (conditions)"):
- attack log `rolls:[9,20] mode:"advantage"` nat20 crit hit; rider fired with crit doubling `secondaryTotal:22` (=2×(5+4+2), §32) — rider rides identically either direction = zero-delta gate proof (MA-0889 twin shape).

## Steps
1. test-campaign, EB join Scout Captain + Bandit (exact td anchors); Bandit HP→999 via card input.
2. Arm Bandit 1 on Scout Captain own-card target-select; open card; press Shortsword +5 chip (`span.mc-dice-link`) until a normal-mode hit occurs (first press nat2 miss, second nat11+5=16 hit).
3. Observe damage popup + log: secondary 3d6 rolls despite mode:"normal".
4. (Optional) GM Add→Effects→"Next Attack Advantage"→Apply on Scout Captain; re-press chip: popup "Adv (conditions)", rider fires again — no gate in either direction.

## Likely Location
- `public/data/monsters.json` scout-captain actions[1] (Shortsword): missing `secondary_condition:"advantage"` next to the secondary fields.
- Consumer gate (already live, untouched): `src/hooks/combat/handlers/handlePlainDamage.js:130` `secondaryRiderBlockedByAdvantageGate` — blocks only if `context.secondaryCondition === 'advantage'`; produced by `MonsterCardModal.jsx:916` `action?.secondary_condition ?? null` → null here → always-roll path (:135+).
- One-field DATA fix per MA-0889/MA-0897 precedent (`secondary_condition:"advantage"` adjacent to damage_dice_secondary).

## Notes
- §219 precedent (playbook §MA-1443, MA-0888 goblin-boss twins): prior session logged scout-captain riders firing unconditionally as "component-row advisory". Per this ticket's adjudication rules that precedent is NOT an auto-pass — an unenforced gate is FAIL(a) (playbook §1 verdict policy: "unenforced trigger/gates … = FAIL").
- Twin row: Longbow actions[2] carries the identical rider prose and also lacks `secondary_condition` — same one-field fix, out of MA-1444 scope (adjudicate on its own row).
- To-hit (+5) and primary dice ("1d6 + 3" Piercing, reach 5 ft.) are exact; defect is rider gating only.
- Injection defense: no off-site navigation occurred; all evidence gathered via own localhost curl/snapshots. Cosmetic popup text-concatenation only (multi-node textContent), log entries canonical.
