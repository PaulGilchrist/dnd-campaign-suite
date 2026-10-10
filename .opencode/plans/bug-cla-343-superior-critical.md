# CLA-343 Superior Critical — E2E Verification

**VERDICT: PASS**

Date: 2026-10-09 · Campaign: `test-campaign` · Host: `EvasiveFighter` lv18 2024 Fighter

## 1. Feature as authored (ground truth)

`public/data/2024/classes.json` → Fighter → majors → **Champion**:

- lv3 **Improved Critical** — "Critical Hit on 19-20." — `automation: {type:"passive_rule", effect:"critical_range", criticalRange:"19-20", casting_time:"passive"}`
- lv15 **Superior Critical** — **"Critical Hit on 18-20."** — `automation: {type:"passive_rule", effect:"critical_range", criticalRange:"18-20", casting_time:"passive"}`

Champion-major feature (not in Fighter `class_levels` levels list — majors only).

Consumers (`src/`):
- `src/services/automation/contextBuilder-sync.js:507-513` `computeCriticalRange` — scans `passives` for `type==='passive_rule' && effect==='critical_range'` → `criticalRange` (placed on context at :749/:776)
- `src/hooks/combat/hitResolution.js:221-223` `rollsWithinCriticalRange` — regex `^(\d+)-(\d+)$`; :340 marks `isCrit` when `effectiveD20Roll` in range
- `src/services/combat/automation/automationInfoBuilder/conditional.js:98` — passes `auto.criticalRange` through

## 2. Setup

- Header verified `test-campaign` after every select (nav ref read each time).
- Champion state A: wizard step 6 re-pick Fighter → step 7 Champion → Save. Disk GET: `"subclass": {"name": "Champion"}`; sheet header "Fighter (champion), Level 18"; sheet shows "Superior Critical: Critical Hit on 18-20."
- Feats FT-069 recipe: PUT-stripped `Charger` + `Shield Master` (GET-verified absent); no Charge/ShieldBash modals fired during ~45 attacks.
- Victim: EB Join Bandit → `Bandit 1` in combatSummary; full-store POST `{value:{combatSummary}}` with Bandit 1 `ac:5, maxHp:999, currentHp:999` (GET-verified).
- Target armed on EvasiveFighter's own initiative card (HP-input-anchored `.creature-card` select → "Bandit 1").

## 3. Ledger (per-entry filtered, EvasiveFighter attacks vs Bandit 1)

Crits (widened window):
| nat | popup | isCrit | damage formula | total |
|-----|-------|--------|----------------|-------|
| 19 | "d20 19 +9 ... Critical Hit! — damage dice doubled ✓ HIT (28 vs AC 5)" | true | `1d10*2+9` | 23 |
| 20 | CRITICAL | true | `1d10*2+9 (4)` | 17 |
| 18 | CRITICAL | true | `1d10*2+9 (10)` | 29 |
| 19 | CRITICAL (re-fire) | true | `1d10*2+9 (7)` | 23 |

Boundary (threshold−1 = nat 17):
| nat | popup | isCrit | damage formula | total |
|-----|-------|--------|----------------|-------|
| 17 | HIT vs AC 5, no crit text | false | `1d10+3 [slashing] + 6 [Heavy Weapon Mastery]` | 11 |

All nats <18 (1,2,3,4,6,7,9,10,11,12,13,14,15,16 sampled) → `isCrit:false`, single-dice formula. Nat crit = popupTotal − 9 (e.g. 28−9=19) ✓. Flat +9 (ability +3 + Heavy Weapon Mastery +6) **undoubled** on crits (§32/§189) ✓; dice `1d10*2` doubled ✓.

## 4. Passive

No spend, no press: crits applied automatically within the pipeline; runtime resources untouched (secondWindUses 4, actionSurgeUses 2, superiorityDice 6 — unchanged across all attacks). `casting_time:"passive"` ✓.

## 5. Cleanup proof

- Character restored byte-exact: disk SHA `4db9309d2ab0577362e4f9c03142cc25962774d5` == backup SHA; GET: subclass **Battle Master**, Charger+Shield Master present, 16 feats.
- Admin `POST clear-change-data` → "Change data cleared"; GET change-data → `keys: []`.
- Admin `POST clear-log` → "Campaign log cleared"; GET log → `[]`.
- Campaign deselected (UI at "Select a Campaign").

## Notes / anomalies (non-blocking)

- First post-arm attack auto-fired with `targetName:null` (still `isCrit:true` nat 19, no damage ledger) — resolved once target select armed on own card; all subsequent entries targeted.
- Damage popup "Done" sometimes only exposed after attack-popup dismissal (expected two-stage popups).
