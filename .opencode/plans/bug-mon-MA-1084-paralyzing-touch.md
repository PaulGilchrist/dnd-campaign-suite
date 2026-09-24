# BUG MA-1084 — Lich "Paralyzing Touch": Paralyzed-on-hit NEVER applies (FAIL(a)/DATA)

Date: 2026-09-24 ~06:30 · Campaign: test-campaign (header-verified) · localhost :5173 (reused, 200)

## Row
`public/data/monsters.json` → Lich `actions[2]` "Paralyzing Touch":
attack_bonus 12, reach 5 ft., damage_dice_primary "3d6 + 5" Cold.
**Disk has NO `hit_conditions` key.** Ticket claim "authors STRUCTURED conditions:[\"paralyzed\"]" is FALSE on disk — the row carries only prose `"Hit: 15 (3d6 + 5) Cold damage, and the target has the <strong>Paralyzed</strong> condition until the start of the lich's next turn."` plus noise fields save_dc:0/save_type:""/save_effect:"" (renders "DC 0" decoy chip — MA-1021 quirk; not pressed per §417, avoided the DC0 save trap).

## Live evidence (rig: Lich cs idx2, Bandit 1 AC12 cond-clean, own-card select armed → Bandit 1)
Chips verbatim on row: `"+12"` (mc-dice-link), `" 3d6 + 5"` (mc-dice-link), `"DC 0 "` (mc-dice-link-save-clickable). Pressed ONLY "+12" (press #1 landed, no absorb).

- HIT popup: "✓ HIT (29 vs AC 12)" — nat17+12=29. Done via real pointer.
- Stage-2: "14 damage applied to Bandit 1 — HP: 431 → 417", dice [5,1,3]+5.
- Log attack: `roll/attack` Lich 1, total 17, bonus 12, hit:true, targetAc 12, damageType Cold.
- Log damage: `roll/damage` Lich 1, formula "3d6 + 5", total 14, finalDamage 14, Cold.
- hp_change: Bandit 1 Δ−14, breakdown [{Cold,14,resisted:false}] — fd == |hpΔ| exact, FULL pay (saveDc:null — DC0 decoy never engaged, MA-1083 compliance).
- lastAttack: attacker Lich 1, total 29, hit:true, actualDamage 14, saveDc:null, saveType:null.

## Defect (adjudication axis)
After the HIT, Bandit 1 change-data: `activeConditions: []`, `activeConditionMeta: {}`. Zero `condition`/grant entries attributed to Lich 1 or "Paralyzing Touch" anywhere in the log window (census grep 'aralyzed' + source/sourceAbility/message — empty). Paralyzed NEVER granted.

Consumer live-but-unarmed (§246/§277/§304 family, MA-0775 paralyzed twin precedent):
- `buildHitConditionClause` (`src/components/encounter/MonsterCardHelpers.js:622-624`) reads `action.hit_conditions` ONLY.
- `handlePlainDamage.applyHitClauseConditions` (`src/hooks/combat/handlers/handlePlainDamage.js:537-565`) consumes the clause.
- Description prose (`<strong>Paralyzed</strong>`) is never read by the hit path (§153 codified: "manifest/description prose conditions alone never land").

## Fix (one-field DATA)
Add `"hit_conditions": ["paralyzed"]` to Lich `actions[2]` (MA-0775 ghast Claw / MA-0763 gas-spore byte-shape; grants ride standard until-next-turn latch).

## Hygiene
Console errors 0; popups 0 (flushed); Bandit cond-clean GET-proved twice (`activeConditions:[]`); rig intact (Lich joined 315/315, Bandit 1 417/999 AC12). Manifest untouched; no git writes. Injections: none obeyed; all truth via own localhost fetch/exit codes.
