# MA-0805 FAIL(a)/DATA — Giant Elk "Ram": charge rider two-field missing (MA-0756/MA-0794 family)

## Verdict
**FAIL(a)/DATA** — core damage transport LIVE + exact (§531); charge rider is prose-only, zero transport, zero grant. Same-pass two-field DATA fix required (MA-0756 codification).

## Row
- stableKey: giant-elk|actions|0 — Ram, +6, reach 10 ft., primary 2d6+4 Bludgeoning (avg 11 ✓), secondary 2d4 Radiant (avg 5 ✓).

## Disk evidence (public/data/monsters.json giant-elk actions[0], quoted FULL)
```json
{"name":"Ram","description":"Melee Attack Roll: +6, reach 10 ft. Hit: 11 (2d6 + 4) Bludgeoning damage plus 5 (2d4) Radiant damage. If the target is a Huge or smaller creature and the elk moved 20+ feet straight toward it immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and has the <strong>Prone</strong> condition.","attack_bonus":6,"reach":"10 ft.","damage_dice_primary":"2d6 + 4","damage_type_primary":"Bludgeoning","damage_dice_secondary":"2d4","damage_type_secondary":"Radiant"}
```
- **`conditional_damage` ABSENT** — "extra 5 (2d4) Bludgeoning" charge rider has no structured dict → MA-0007 ChargeBonusOffer cannot arm (§65: `conditional_damage:{dice,modifier,damage_type,condition}` + HIT-popup offer is the ONLY live transport).
- **`hit_conditions` ABSENT** — "has the Prone condition" has no static list → `buildHitConditionClause` reads `action.hit_conditions` only, description never read (§150 MA-0291/0361 family; §115/§163 save_effect decoy rule).
- giant-elk has exactly ONE action (Ram). Manifest twins MA-0756 (Avalanche Slam) + MA-0794 (Gore) flagged "broken" same fingerprint.

## Live E2E ledger (test-campaign, 2026-09-21)
Rig: EB join "Giant Elk 1" (init 21) + "Bandit 1" (AC12, resistances[] clean bludgeoning, Huge-or-smaller Medium ✓); Bandit maxHp/currentHp 999 via full-store cs POST (200, verified 999/999); target armed on Elk initiative-card `[data-testid="target-select"]` via selectOption; chip "+6" (single chip §116).

| Roll | d20+6 | Result | Stage-1 popup buttons | Damage entry | hp_change |
|---|---|---|---|---|---|
| 1 | 1+6=7 | ✗ MISS | [] (done-less ✓) | none | none |
| 2 | 19+6=25 | ✓ HIT | ["Done"] — ZERO offer | "2d6 + 4" fd14 + sec "2d4" Radiant sfd2 | Δ−16 (Blud14+Rad2) exact |
| 3 | 14+6=20 | ✓ HIT | ["Done"] — ZERO offer | "2d6 + 4" fd14 + sec "2d4" Radiant sfd5 | Δ−19 (Blud14+Rad5) exact |
| 4 | 4+6=10 | ✗ MISS | [] (done-less ✓) | none | none |

- **Axis 1 (core §531): PASS** — combined_damage_roll note on both hits; secondary rides same entry with own dice/type (MA-0531/MA-0426); |Δ| == fd+secFD exact both hits; misses zero.
- **Axis 2 (charge rider): FAIL(a)/DATA** — both HIT stage-1 popups print Done ONLY (no ChargeBonusOffer button = zero-offer proof per MA-0007); log: `proneInLog:0`, `chargeLog:0`; change-data: `Bandit 1.activeConditions:null`, `activeConditionMeta:null`, top-level `targetEffects:null`. Prose-only, no-fields, zero-grant ⇒ FAIL(a)/DATA two-field same-pass fix per MA-0756 codification (NOT §70 advisory).
- Cosmetic fingerprint (non-defect): lastAttack.weaponType:"ranged" on reach-melee row; lastAttack.secondaryDamageType cosmetic (damage entry + breakdown carry Radiant truth).

## Fix (DATA, one pass, two fields)
Add to giant-elk actions[0]:
```json
"conditional_damage": {"dice":"2d4","modifier":0,"damage_type":"Bludgeoning","condition":"moved 20+ feet straight toward the target"},
"hit_conditions": ["prone"]
```
Placement: MA-0007 conditional_damage template + MA-0621/MA-0763 hit_conditions byte-shape. Consumer audit: `buildHitConditionClause` (handlePlainDamage) live for prone incl size gate (Huge-or-smaller — Bandit Medium ✓); ChargeBonusOffer live for offers. Note Huge threshold (vs Large twins) — verify condition/threshold token parse if the parser keys thresholds.

## Ops notes
- EB exact td-text match required ("Bandit" vs Bandit Captain/Crime Lord rows).
- Miss backdrop-dismiss kept card open this session (§145 honest flaky-OK branch); card re-opened via avatar each roll, re-armed select each cycle (§118).
