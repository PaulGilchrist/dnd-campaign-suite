# MA-1145 — Medusa Poison Ray — VERDICT: PASS (2026-09-24)

## Row
- MA-1145 | medusa | actions[3] | attack+save | attackBonus +5 | saveDc 0 / saveType "" | range "150 ft." | "2d8 + 2" Poison | recharge "".

## Static disk (byte-exact)
- public/data/monsters.json medusa actions[3]: name "Poison Ray", attack_bonus:5, damage_dice_primary "2d8 + 2", damage_type_primary "Poison", range "150 ft.", reach "", recharge "", save_dc:0, save_type "", description "Ranged Attack Roll: +5, range 150 ft. Hit: 11 (2d8 + 2) Poison damage." — ALL byte-exact vs manifest row.
- DERIVATION ADVISORY (record-only): +5/+2 undisrivable from disk mods — proficiency_bonus:3, DEX 17(+3)→+6 ranged, INT 12/WIS 13→+1 mods, no +2 ability anywhere; attack_bonus:5 and "+2" are the authored row text itself → disk-text-consistent, NOT manifest-vs-disk drift. Same advisory family as MA-1142 branch B.

## Scenario
- Header verified test-campaign before all actions. No Medusa/Bandit standing init (14 PCs round 1) → EB Join: exact-match rows Bandit + Medusa, qty 1 each, pre-Join checked-enumeration clean [Bandit, Medusa] only (§440 retain guard).
- Joined cs disk-exact: Bandit 1 AC12 HP 11/11 (monsterIndex bandit), Medusa 1 AC15 HP 127/127 (monsterIndex medusa), round 1.
- Rig order §447: Bandit 1 currentHp 999 via init-card input fill()+Enter → cs 999/11 (§450 max stays authored, cosmetic; no clamp). Arm AFTER rig via Medusa init-card Target select, ancestor depth-walk depth=3, native value setter + change (§451) → cs.creatures[Medusa 1].targetName="Bandit 1"; cs root targetName absent (§452).

## Chip audit
- Poison Ray row (strong.startsWith anchor §180): exactly ONE chip "+5" (span.mc-dice-link); ZERO .mc-dice-link-save DC chips row-scoped AND card-wide.
- §440 junk recorded unpressed: Multiattack header "+6 (16)" chip + ability/skill mc-ability-mod chips — excluded from component ledger.

## Fires (5 fresh adjudicated, round 1, standalone, vs AC12; popup chrome total-first §452)
| # | nat | popup | hit | damage | hp |
|---|-----|-------|-----|--------|-----|
| F1 | 19 | "24 \| d20 19 +5 (+5 to hit) \| ✓ HIT (24 vs AC 12)" | ✓ | ONE damage entry formula "2d8 + 2" rolls[3,7] total 12 finalDamage 12 Poison | 999→987, \|Δ\|12==fd |
| F2 | 5 | ✗ MISS (10 vs AC 12), done-less (§451) | ✗ honest | attack-roll-only log, zero damage, no hp_change | 987 unchanged |
| F3 | 5 | ✗ MISS (10 vs AC 12) (t-stamped new entry [5,20], rolls[1] cosmetic §451) | ✗ honest | zero damage | 987 unchanged |
| F4 | 2 | ✗ MISS (7 vs AC 12) — boundary nat2 | ✗ honest | zero damage | 987 unchanged |
| F5 | 10 | ✓ HIT (15 vs AC 12) | ✓ | ONE damage entry "2d8 + 2" rolls[5,6] total 13 finalDamage 13 Poison | 987→974, \|Δ\|13==fd |

- Log ledger §442: every press judged by log-delta; 3 silent chip presses caught (delta 0) and re-fired; DONE = button.dice-roll-reroll-btn real pointer on both hits; hit triples = attack+damage+hp_change exactly 3 lines each; miss = 1 attack line.
- Single-primary §185: no secondaryFormula/secondary keys on any damage entry.
- rangeReason:null every press — gridless advisory §146.
- No nat20 → §32 crit axis N/A.
- Popup total=nat+5 vs AC12 on every adjudicated press ✓.

## Cleanup
- Admin panel: Clear Change Data + Clear Campaign Log (dialogs auto-accepted, §444). API-verified: logLen=0, change-data keys=[].

## VERDICT: PASS
All cores exact: byte-exact disk row, one +5 chip / zero DC chips, popup totals nat+5 vs AC12, per-hit ONE byte-exact "2d8 + 2" Poison entry, |hpΔ|==finalDamage (12, 13), honest misses zero-damage, Done via reroll-btn + log-delta discipline. Derivation advisory (+5/+2 vs prof3 + no matching ability mod) recorded as disk-text-consistent data note, not a defect.
