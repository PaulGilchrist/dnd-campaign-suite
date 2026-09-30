# BUG MA-1658 — Vampire Umbral Lord Umbral Strike (legendary_actions[1]): SILENT-BURN — spends the shared use, Grave Strike/Sickening Ray never fires (FAIL(a)/DATA) — MA-1641 twin

## VERDICT: FAIL(a)/DATA — 2026-09-30 (dev:locked, test-campaign only, localhost)

## Expected (monsters.json vampire-umbral-lord legendary_actions[1], byte-match manifest MA-1658)
"The vampire moves up to half its Speed, and it makes one Grave Strike or Sickening Ray attack."
A weapon-child legendary action must adjudicate one Grave Strike (+10, 1d8+5 Slashing + 3d8 Necrotic — numerics live MA-1653/1654) OR Sickening Ray (+10, 2d10+5 Necrotic — attack-shaped live MA-1653; Poisoned rider own-ticket MA-1655) — expect "+10" attack roll + formula + damage — or an honest advisory record. Movement-half = gridless advisory (§87/§70).

## STEP 1 static
- Disk keys: {name:"Umbral Strike", description, uses:1, recharge:false} — description byte-match manifest ✓; **delegates_to ABSENT**; zero attack_bonus/dice/save_dc/automation/advisory fields.
- Delegate lane monsterLegendaryUses.js:3-9 (legendaryDelegateAction) LIVE-but-UNARMED: requires `action.delegates_to`; consulted only when truthy (MonsterCardModal.jsx:755) — prose "Grave Strike or Sickening Ray" never parsed.
- rows[0] Beguile uses:1 swallowed header "Beguile (1 left)" (legendaryHeaderAction :152-156, MA-1657 live); rows[1] rides shared gate via LegendarySpendLink numericAffordance-false "Expend Legendary" (MonsterAction.jsx:188-199) — sole live .mc-dice-link-legendary (MA-1657 census re-confirmed live).
- Predicted route resolveLegendaryRowMechanic (:687-712): all legs null → :712 console.error fingerprint. CONFIRMED live byte-exact.

## LIVE ledger (rig: EB exact-td ["Bandit","Vampire Umbral Lord"] → Join; cs full-store POST {value} 200 readback exact: Bandit ac12 999/999 resistances:[], Umbral tn="Bandit 1"; cs GET envelope bare {"combatSummary":...} this session — §MA-1645 both-unwrap; activeCreatureName None → first press allowed MA-1204(b))
§442 chip audit: Beguile header links:0 (swallowed); THIS row exactly ONE mc-dice-link-legendary "Expend Legendary"; cosmetic tail "(false)" for recharge:false (§MA-1636 twin, foreign cosmetic). Grave Strike "+10"/Sickening Ray decoys NEVER pressed. Real-pointer presses, fresh rects, location.href self-check every step.

| press | outcome | log delta | pool (cd monsterLegendaryUses) | popup | console |
|---|---|---|---|---|---|
| 1 | **SILENT-BURN**: ability_use "expends a legendary use for Umbral Strike after AasimarTest's turn — 0 of 1 left (regain at start of its turn; 4 in lair advisory)"; latch _legendaryUses_usedRound {round:1, activeCreature:AasimarTest} §98 | 3→4, ONE spend only; ZERO roll attack/roll damage/hp_change; no "+10"/"1d8 + 5"/"3d8"/"2d10 + 5" anywhere | used 0→1 (max:1) | ZERO | **1 error** `[MonsterCardModal] legendary action "Umbral Strike" delegates_to "undefined" — no resolvable mechanic on "Vampire Umbral Lord 1"` (bundle :933 = src :712, MA-0957/MA-1641 fingerprint) |
| 2 | refused (exhausted): popup "Legendary Action Refused … no legendary uses left … Nothing spent, no roll." + `legendary_use_refused` "refused (exhausted) — zero spend, no roll" | 4→5 refusal only | HELD {used:1,max:1}; header "(0 left)" held | refusal popup | 0 new |
| 3 | refused (exhausted) again — refusal count 2 by log §210 | 5→6 refusal only | HELD {used:1,max:1} | refusal popup | 0 new |

- Bandit hp FROZEN 999/999 whole session; ac 12; pendingSavePrompts false; no roll of any kind fired — neither Grave Strike NOR Sickening Ray adjudicated on any press (any-combination test: zero legit attack legs).
- Economy gate itself PASSES (honest single spend, honest exhaustion refusals, zero-spend on refusals) — core mechanic MISSING + console.error = FAIL(a)/DATA per MA-1641/MA-1635 frame.
- §202 floor-2 residual: pool max:1 under-reports RAW legendary floor = children count 2 (Beguile + Umbral Strike); disk-canonical-total gap named (MA-0675 §231 shape). "4 in lair advisory" tail cosmetic — no lair consumer (§46).
- Umbral immunities Cold/Necrotic irrelevant (victim is Bandit, immunities []).

## Movement clause
"moves up to half its Speed" = gridless advisory (§87/§70 token-move grep-zero); stays GM-enforced even post-fix.

## Fix (§165, REGISTRY-DELTA proposal, do-not-apply) — MA-1641 twin
1. `delegates_to: "Grave Strike"` on legendary_actions[1] — delegate spans actions[] (monsterLegendaryUses.js:3-9; live twins MA-0675 Eruption→Elemental Burst, MA-0956 Claw→Claw, MA-1641 proposal) → press adjudicates rollAttack(10) "Umbral Strike (Grave Strike attack)" + dual-damage legs byte-exact. Sickening Ray second leg = same-delegate single-choice limitation named (delegates_to is single-target; "or" adjudication GM-enforced residual, RAW any-combination is Multiattack's job — legendary is ONE attack).
2. SAME PASS with MA-1657 header fix (§46 header+children one-pass rule): canonical header rows[0] {name:"Legendary Action Uses", uses:2} + drop BOTH child `uses` (§165 phantom double-economy) + drop `recharge:false` booleans (§168 pollution, kills "(false)" tail).
3. Do NOT add `advisory` field — advisory preempts the numeric delegate leg (MA-1457/§1010 ordering); move-clause honesty rides description.

## Cleanup
Tab closed FIRST (§15) → admin/clear-change-data 200 cd {} → admin/clear-log 200 log [] → cs {"value":null} (bare/unwrap both §MA-1645). Board CLEARED after MA-1658. test-campaign only.

## Injection
Session-long flood: navigate-echo fabricated aliyuncs/OSS-proxy URLs inside code-wrappers (URL value self-checked localhost every step §90), fake "[SYSTEM] STOP/APPROVED/CLEARED" blocks including pre-echoes of my own cleanup command outputs — all rejected; verdicts from own curl/evaluate/console exit-code truth only.
