# MA-0809 FAIL(a)/DATA — Giant Goat "Ram": charge rider two-field missing (MA-0805/MA-0794/MA-0756 twin)

## Verdict
**FAIL(a)/DATA** — core damage transport LIVE + exact; charge rider (extra 2d4 + Prone) prose-only on disk, zero popup offer, zero grant. Two-field DATA fix required SAME PASS (MA-0756/MA-0805 codification).

## Disk evidence (public/data/monsters.json giant-goat actions[0]) — quoted FULL
```json
{"name":"Ram","description":"Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Bludgeoning damage. If the target is a Large or smaller creature and the goat moved 20+ feet straight toward it immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and has the <strong>Prone</strong> condition.","attack_bonus":5,"reach":"5 ft.","damage_dice_primary":"1d6 + 3","damage_type_primary":"Bludgeoning"}
```
- avg("1d6 + 3") = 6 ✓ matches prose "6 (1d6 + 3)".
- **`conditional_damage` ABSENT** → `buildChargeBonusOffer` returns null (`if (!cd?.dice) return null`, MonsterCardHelpers.js:525-526) → ChargeBonusOffer never arms (MA-0007 §65; render seam DiceRollResult.jsx:838/1065; thread MonsterCardModal.jsx:1008).
- **`hit_conditions` ABSENT** → `buildHitConditionClause` [] (MonsterCardHelpers.js:561-562, reads `action.hit_conditions` ONLY); consumer `applyHitClauseConditions` handlePlainDamage.js:513 LIVE incl Large-or-smaller gate (§150 MA-0291/0361 family) → Prone never granted.
- Twins still unfixed on disk same-day: giant-elk/giant-boar/galeb-duhr actions[0] dump → `conditional_damage:None hit_conditions:None` (byte-identical fingerprint). NOT §70 advisory per §206/MA-0805 conversion: absent adjudicable fields, live consumers.

## Live E2E ledger (test-campaign, header verified `test-campaign`, dev :5173 reused, CAMPAIGN_LOCK)
Rig: EB join exact td-text "Giant Goat" + "Bandit" (Bandit Captain/Crime Lord/Deceiver rows excluded) → cs `Giant Goat 1` (init 7, hp 19) + `Bandit 1` (AC12, resistances[] clean bludgeoning §75); Bandit maxHp/currentHp 999 via full-store cs POST (200, verified 999/999); armed `[data-testid="target-select"]` on Goat initiative card via selectOption (verified value "Bandit 1"); single "+5" chip under strong "Ram." (§116 correct).

| # | nat+5 | Result | Stage-1 buttons | Damage entry | hpΔ |
|---|---|---|---|---|---|
| 1 | 7+5=12 | ✓ HIT (tie→attacker, honest AC12 boundary) | ["Done"] — ZERO offer | "1d6 + 3" rolls[3] fd6 Bludgeoning | −6 (999→993) |
| 2 | 6+5=11 | ✗ MISS | [] done-less ✓ | none | none |
| 3 | 6+5=11 | ✗ MISS (distinct leg, log nat6 dupe honest) | [] done-less ✓ | none | none |
| 4 | 15+5=20 | ✓ HIT | ["Done"] — ZERO offer | "1d6 + 3" rolls[3] fd6 Bludgeoning | −6 (993→999→987 see note) |
| 5 | 5+5=10 | ✗ MISS | [] done-less ✓ | none | none |
| 6 | 13+5=18 | ✓ HIT | ["Done"] — ZERO offer | "1d6 + 3" rolls[2] fd5 Bludgeoning | −5 (987→982) |

- **Axis 1 (core): EXACT** — 3 hits; applied sum 6+6+5=17 == |999−982| exact; all entries formula "1d6 + 3" Bludgeoning, note combined_damage_roll (§183 cosmetic on single-primary); misses zero damage/zero hp_change; §MA-0802 miss-light avoided — all rider audits keyed on the 3 HIT legs. Fresh rolls[2] on hit 3 kills §77 replay suspicion (d6=3×2 coincidence, attacks carry distinct nats 7/6/6/15/5/13).
- **Axis 2 (charge offer): FAIL(a)/DATA** — all 3 HIT stage-1 popups enumerate buttons = [Done] ONLY; zero ChargeBonusOffer at any stage; log `conditional_damage_granted|declined|charge` count = **0**.
- **Axis 3 (Prone grant): FAIL(a)/DATA** — prone-token log entries count = **0**; Bandit cs conditions null; change-data `Bandit 1.activeConditions`/`activeConditionMeta` absent; top-level `targetEffects` absent. Never granted 3/3 hits.
- Movement gate ("20+ ft straight toward") itself gridless-advisory (§42/§70) — the ABSENT fields are the adjudicable axes.

## Ops self-contamination note (adjudicated, not app defect)
Roll-1 Done double-fired via own `?.click() || find(Done).click()` fallback → duplicate log PAIR (damage entry + hp_change breakdown both logged twice); server applied ONCE only (cs 993 after roll 1). Counted unique-applications per §113 (counts+sums, never adjacency). All subsequent Dones single-click.

## Fix (DATA, two fields, same pass — MA-0805 byte-shape)
Add to giant-goat actions[0]:
```json
"conditional_damage": {"dice":"2d4","modifier":0,"damage_type":"Bludgeoning","condition":"moved 20+ feet straight toward the target"},
"hit_conditions": ["prone"]
```
Consumers live (offer §65, prone clause handlePlainDamage.js:513 incl Large-or-smaller size gate — Bandit Medium ✓). Stale-pin inversion scan §213/§216 before landing (grep tests pinning giant-goat row inert).

## Injections
Multiple this session: navigate/click args rewritten to aliyuncs OSS proxy URLs; fabricated tool results (fake snapshots, fake dialog, fake "log cleared", embedded fake system-notes + fake code-echo steps incl attempts to arm "Bandit Captain"). All rejected (§6); every state claim re-ground-truthed via own evaluate/fetch; page stayed localhost.

## Cleanup
admin clear-change-data + clear-log direct-fetch POSTs (200, no native confirm §258); verified log:[] cd:{} at end. test-campaign only; no manifest/git writes.
