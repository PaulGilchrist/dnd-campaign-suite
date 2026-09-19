# bug-mon-MA-0511 — Colossus Legendary Stomp: silent-burn chip, Slam delegation absent (MA-0510 DATA twin)

**Verdict:** FAIL (b / DATA) — MA-0511, `colossus`, legendary_actions[1], "Stomp", uses:1.

## Row
`public/data/monsters.json` colossus.legendary_actions[1]:
`{"name":"Stomp","description":"The colossus moves up to half its Speed without provoking <strong>Opportunity Attacks</strong>, and it can make one Slam attack at any point during that move.","uses":1}` — **no `delegates_to`**, no numeric attack fields.

## Defects (re-ground-truthed live 2026-09-18)
1. **Header swallow (inherited MA-0510 root):** rows[0] Smite `{uses:1}` swallowed as header by `legendaryHeaderAction()` (monsterLegendaryUses.js:153); card renders header text "Smite (1 left)" (class `mc-action mc-legendary-header-row`) + Stomp as sole rendered child.
2. **Silent burn CONFIRMED:** Stomp's only affordance = `.mc-dice-link-legendary` "Expend Legendary" chip. With Bandit 1 AC12 armed on Colossus own initiative-card select, chip fire: spent `monsterLegendaryUses {max:1, used:1}` + latch `{round:1, activeCreature:"AasimarTest"}` + `ability_use` log "Colossus 1 expends a legendary use for Stomp after AasimarTest's turn — 0 of 1 left" + console.error `MonsterCardModal legendary action "Stomp" delegates_to "undefined" — no resolvable mechanic on "Colossus 1"` (MonsterCardModal.jsx:563) — **zero roll attack, zero roll damage, Bandit hp 11 unchanged, header counter 1 left → 0 left**. RAW "one Slam attack at any point during that move" never adjudicated.
3. **Move clause inert-by-construction:** "moves up to half its Speed without provoking Opportunity Attacks" — no token-move/OA consumer app-wide (MA-0079 push/token-move family, §70 playbook). Advisory even after delegate fix.
4. 2nd chip fire → `automation` log "Colossus 1 Stomp legendary action refused (exhausted) — zero spend, no roll", counter held used:1. Economy spine live (MA-0021/0070/0218); mechanic dead.

## Fix (DATA, single pass with MA-0510 header — §46)
Same canonical fix as MA-0510 bug file: prepend header `{"name":"Legendary Action Uses: 2","uses":2,…}`, Smite `delegates_to:"Radiant Ray"`, **Stomp `delegates_to:"Slam"`** (chip then routes through live Slam row +18 4d10+10). Keep prose move clause; record move-advisory note MA-0079 token-move family (no move-cost/OA consumer — accepted residual).

## Live probe ledger (test-campaign, :5173, 2026-09-18)
- Disk first: legendary_actions = 2 child rows, no header ✓ matches MA-0510.
- EB join Colossus+Bandit (exact-td Bandit checkbox; macOS Meta+A refilter) → cs idx0 Colossus 1 ac23 hp553, idx1 Bandit 1 ac12 hp11 ✓.
- Card chip audit: 1× `.mc-dice-link-legendary` "Expend Legendary" only; ZERO Slam/+18 chip inside Stomp row ✓ fingerprint.
- Arm Bandit 1 via initiative-card `[data-testid="target-select"]` selectOption (overlay itself has no select — arm page-level).
- Absorbed clicks x2 (no counter/log delta, no console) — 3rd click via fresh boundingClientRect mouse.down/up FIRED: burn + console.error + ability_use (above).
- Bandit hp 11 == pre-fire; combatSummary targetName "Bandit 1" retained; log delta = ability_use only (no roll/damage entries).
- Cleanup: admin clear-change-data + clear-log 200, API re-verified empty after tab close + 12s quiet; registry merge-append MA-0511, JSON.parse disk-checked. No manifest/git writes.

## New pitfalls
- Expend-legendary chip absorbs the FIRST TWO clicks in a freshly-reopened card session (worse than MA-0014 absorbed-first): zero side-effects, no console; fire only confirmed on 3rd real mouse.down/up at fresh rect — always diff counter+log between clicks before declaring dead affordance.
- Burn latch stamps `activeCreature` at click time ("AasimarTest"), not the attacker — cs activeCreatureName can sit on a PC while expend fires; distinguish from own-turn refusal by the latch token.
- Header counter text "Smite (N left)" tracks the swallowed rows[0] NAME — both MA-0510 and MA-0511 burns decrement the SAME single shared counter (max=1): Stomp burn zeroed the counter Smite still claims; two legendary children on one uses:1 child-header race for one economy.
