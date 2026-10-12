# bug-mon-MA-1928-capsize-delegates-attack-pool.md

**Row:** MA-1928 — Jormungandr `legendary_actions[3]` "Capsize (Costs 2 Actions)" (`jormungandr|legendary_actions|3`)
**Verdict:** FAIL(a)/DATA — MA-1847 Apep-Devour-the-Boat fingerprint confirmed live 2026-10-11.

## RAW
"Jormungandr thrashes the water beneath a vehicle or structure. Each creature within 30 ft. of it must succeed on a DC 25 Strength saving throw or fall Prone and take 18 (4d8) Bludgeoning damage." — DC 25 STR save; fail = Prone + 4d8 Bludgeoning; success = NOTHING; costs 2 legendary actions.

## Disk (forensics reproduced)
`legendary_actions[3] = {name:"Capsize (Costs 2 Actions)", delegates_to:"Tail", description:...}` — row authors NO `save_dc`/`save_type`/`damage_dice_*`/`save_effect`. `delegates_to:"Tail"` resolves `actions[2]` (+19 attack, "4d12 + 9" Bludgeoning, `hit_conditions:["prone"]`, reach 30 ft.). Save prose stranded in description (never parsed — §54 prose-DC; §346 word-scan is save_effect-only).

## Live evidence (:5173 test-campaign, Bandit 1 AC12 999-rig armed)
- Chip census: one prose-delegate `span.mc-dice-link-legendary` "Expend Legendary" on Capsize row, counter "(3 left)" — MA-1847/MA-1926 shape; ZERO DC/Save chip.
- Press at fresh boundary `1:AberrantSorcerer`: spends 2 honestly — ability_use "spends 2 legendary uses … 1 of 3 left (regain …; 4 in lair advisory)" (MA-1883 lane live); `monsterLegendaryUses {max:3, used:2}`.
- **Machine truth `GET /lastAttack`: `saveDc:null`, `saveType:null`, `rollType:"attack"`, bonus 19, nat14 total 33 vs AC12, hit:true, damageFormula "4d12 + 9" Bludgeoning** — delegated ATTACK pool; DC 25 Strength never enforced.
- Damage ledger: roll damage "4d12 + 9" rolls[9,2,8,4]=23+9 finalDamage 32 == |hp_change| (Bandit 999→967). Pool wrong (should be 4d8 avg 18 gated behind save).
- Prone provenance: `type:"condition"` reason **"Tail (escape DC —)"** + cd `activeConditions:["prone"]` — delegated hit_conditions lane, NOT save-lane grant. No `save_result` entry anywhere. Success face (RAW: nothing) unmodeled — prone+damage ride HIT, ungated by any save.
- Cost economy PASS (record honestly): at next fresh boundary `1:Disciplined_Monk` press-first with 1 left → popup+log `insufficient-cost: costs 2, 1 left — zero spend, no roll`, counter held used:2; regain at own turn-start `2:Jormungandr 1` → used:0, log "regains all expended legendary action uses at the start of its turn — 3 available" byte-exact.
- Console 0 errors. Cleanup admin-clear cd {} log [] quiet 15s.

## Defect axes
1. **FAIL(a):** RAW DC 25 STR save never adjudicated — `delegates_to` re-routes the save-prose legendary into the delegated Tail attack pool (+19 vs AC, 4d12+9) under correct-looking label (MA-1847 twin, `lastAttack.saveDc:null` smoking gun). Wrong pool AND wrong adjudication axis; success face pays full damage instead of nothing.
2. Costs-2 economy is NOT the defect — engine-enforced live (MA-1883/MA-1920 lane): spends 2, insufficient-cost floor, own-turn regain all verified PASS.

## Fix (MA-1847 byte-shape, DATA-only)
Drop `delegates_to`; self-resolve save row:
```json
{
  "name": "Capsize (Costs 2 Actions)",
  "save_dc": 25,
  "save_type": "Strength",
  "damage_dice_primary": "4d8",
  "damage_type_primary": "Bludgeoning",
  "dc_success": "none",
  "save_effect": "The target falls Prone and takes 18 (4d8) Bludgeoning damage.",
  "description": "<unchanged>"
}
```
- `dc_success:"none"` — RAW success = NOTHING (§335 half-default leak family).
- `save_effect` byte-carries canonical "Prone" (§346 word-scan; description never read — MA-1920/Modal:754).
- Row then renders own "DC 25 Strength" chip riding the section-wrapped legendary gate, spend-then-save (MA-1847/§204/§507). Numeric dice `canRollExpression("4d8")=true`.
- Range "within 30 ft. of it" shapeless → inline single-target save degradation, advisory residual (§211/MA-1843/MA-1924 shapeless-inline twin).
- "(Costs 2 Actions)" stays name-text — cost token consumed live by MA-1883 lane, do not touch.
- Legendary header rows[0] uses:3 intact (MA-1925 PASS) — same pass not required; child self-resolves without header change.
