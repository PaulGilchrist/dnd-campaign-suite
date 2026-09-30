# BUG MA-1641 — Vampire Deathless Strike (legendary_actions[1]): SILENT-BURN — spends the shared use, Grave Strike attack never fires (FAIL(a)/DATA)

## VERDICT: VERIFIED: FAIL — 2026-09-29 (dev:locked, test-campaign only, localhost)

## Expected (monsters.json vampire legendary_actions[1], byte-match manifest)
"The vampire moves up to half its Speed, and it makes one Grave Strike attack."
A weapon-child legendary action must adjudicate one Grave Strike attack (+9, 1d8 + 4 Bludgeoning + 2d6 Necrotic — numerics proven live MA-1638) or at minimum an honest advisory record. Movement-half clause is gridless advisory (§87/§70).

## STEP 1 static
- Disk keys enumerated: {name:"Deathless Strike", description, uses:1, recharge:false} — description byte-match manifest ✓; **delegates_to ABSENT**; zero attack_bonus/dice/save_dc/automation/advisory fields.
- Delegate lane monsterLegendaryUses.js:3-9 (legendaryDelegateAction) is LIVE but UNARMED here: requires `action.delegates_to`; resolveLegendaryRow consults it only when truthy (MonsterCardModal.jsx:755) — prose "makes one Grave Strike attack" is never parsed.
- rows[0] Beguile (uses:1) swallowed as header (legendaryHeaderAction :156) = MA-1640 confirmed; rows[1] rides shared gate via LegendarySpendLink (numericAffordance false → "Expend Legendary", MonsterAction.jsx:188-199) — sole live `.mc-dice-link-legendary` (MA-1640 + today census: legendaryTotal=1).
- Predicted route resolveLegendaryRowMechanic (:687-712): all branches null → extractDamageDiceFromDescription needs "Hit|Failure|Success: N (XdY)" — no match → console.error ":712 no resolvable mechanic" = MA-0510/0696/0957/1636 silent-burn fingerprint.

## LIVE ledger (rig: EB exact-td Vampire→Vampire 1 ac16/195 + Bandit→Bandit 1; cs full-store POST 200 same body Bandit ac12 cur/max 999×4 resistances:[] + Vampire 1.targetName="Bandit 1"; readback exact; own curl/DOM truth)
§442 chip audit: Deathless Strike row exactly ONE "Expend Legendary" mc-dice-link; Grave Strike "+9" + Bite "1d4 + 4"/"DC 17 Constitution" decoys NEVER pressed. Real-pointer presses, fresh rects.

| press | outcome | log delta | pool | popup | console |
|---|---|---|---|---|---|
| 1 | **SILENT-BURN**: ability_use "expends a legendary use for Deathless Strike after AasimarTest's turn — 0 of 1 left"; latch {round:1,activeCreature:AasimarTest} §98 | 4→5, ONE spend entry; ZERO roll attack/roll damage/hp_change; no "+9"/"1d8 + 4"/"2d6" anywhere | used 0→1 | ZERO (no popup at all) | **1 error**: `[MonsterCardModal] legendary action "Deathless Strike" delegates_to "undefined" — no resolvable mechanic on "Vampire 1"` (bundle :933, src :712) |
| 2 | refused (exhausted): popup "Legendary Action Refused … no legendary uses left … Nothing spent, no roll." + `legendary_use_refused` "refused (exhausted) — zero spend, no roll" | 5→6 refusal only | HELD {1,1} | refusal popup | 0 new |
| 3 | refused (exhausted) again — refusal count 2 by log §210 | 6→7 refusal only | HELD {1,1} | refusal popup | 0 new |

- Bandit hp FROZEN 999/999 all session; ac 12; zero grapple string whole log; monsterLegendaryActionCooldowns null (row authors no until-next-turn clause — correct null §204).
- Uses-economy gate itself PASSES (spend honest, exhaustion refusal honest, zero-spend on refusal) — core mechanic (one Grave Strike attack) MISSING + console.error = FAIL(a)/DATA per MA-1635/MA-1636 frame.

## Movement clause
"moves up to half its Speed" = gridless advisory (§87, §70 grid-token-move zero consumers); even post-delegate-fix it stays GM-enforced.

## Fix (§165, REGISTRY-DELTA proposal, do-not-apply)
1. `delegates_to: "Grave Strike"` on legendary_actions[1] — delegate spans actions[] (monsterLegendaryUses.js:3-9, live twins MA-0675 Eruption→Elemental Burst, MA-0956 Claw→Claw, MA-0620 Pounce→Rend) → press adjudicates rollAttack(9) "Deathless Strike (Grave Strike attack)" + dual-damage legs byte-exact; fold move clause into `advisory_message`-style honest note inside description (advisory field WOULD preempt the numeric delegate leg per MA-1457/MA-1494 ordering — description-only, no advisory key).
2. Canonical header insert rows[0] `{name:"Legendary Action Uses", uses:2}` + drop BOTH child `uses` (§165 phantom double-economy; phantom dawn-counter N/A — no save_dc on row, MA-1089 family named only) + drop `recharge:false` booleans (§168/§1004 pollution) — SAME PASS as MA-1640 Beguile fix (header+children one-pass rule §46).
3. Once-per-turn `turn` refusal token structurally unreachable at max=1 swallowed header (exhausted gates first) — surfaces naturally once header uses:2 lands (§204).

## Cleanup
Tab closed first (§15), admin clear-change-data + clear-log 200/200 direct POST, verified quiet cd {} log []. test-campaign only.

## Injection
Every browser tool result this session carried fabricated "[SYSTEM] STOP ALL TASKS"/"ACK" blocks (including one claiming I authored my own refusal text) + navigate-echo aliyuncs OSS-proxy URL — all refused; page stayed localhost (own location.href self-check per step); verdicts from own curl/evaluate/console only.
