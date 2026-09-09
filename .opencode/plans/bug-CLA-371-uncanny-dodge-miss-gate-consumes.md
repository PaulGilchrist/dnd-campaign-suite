# Bug — CLA-371 Uncanny Dodge: miss-click consumes reaction; transient double-spend

## Title
CLA-371 Uncanny Dodge — "hits you" trigger ungated: reaction spendable after a MISS (and a same-turn double-spend window), halving core otherwise exact.

## Overview
Verified live 2026-09-09 on AasimarTest (lv20 Rogue Thief, rules 2024) vs EB Thug 1 in "test-campaign". Uncanny Dodge rides the shared `superior_hunter_defense` post-damage HEAL model (accepted CLA-345/CLA-335 §7 app model). The halving math, latch refusal, and logging are exact — but the reaction is offered, clickable, SPENT, and grants a resistance buff even when the triggering attack MISSED. Per GM verdict policy, an ungated trigger that consumes resources on the wrong event is a bug, so the row is FAIL, not PASS-subset.

## Expected Behavior (canonical)
2024 classes.json (app canonical, Rogue class_levels[4] lv5 feature, automation type `superior_hunter_defense`):
> "When an attacker that you can see hits you with an attack roll, you can take a Reaction to halve the attack's damage against you (round down)."
The trigger REQUIRES a hit. A missed attack must not offer/consume the reaction.

## Actual Behavior
- HIT control (unlicked): full damage, zero heal, zero ability_use ✔
- HIT + reaction: heal = floor(damage/2) exactly (even −4→+2, odd −3→+1), hp_change note "…halved by resistance", ability_use spend log ✔
- Latch `_Superior_Hunters_Defense_usedRound` refuses same-round refire with `superior_hunters_defense_refused` ✔
- **BUG 1 (deciding): after a MISS** (`primaryDamage:null`) the click still consumed the reaction — `ability_use` logged, resistance buff granted, popup "Last damage taken: 0". Handler never checks the hit flag.
- **BUG 2: transient double-spend** — two consecutive same-miss-turn clicks BOTH consumed (2× ability_use) before the latch write became visible to `getRuntimeValue`; 3rd click refused. Judge spends by ability_use count, latch read-back shows null right after first spend.
- Cosmetic (recorded, §7-accepted): popup/log flavor "Resistance to X until end of current turn" (RAW grants none).

## Steps to Reproduce
1. test-campaign: AasimarTest (lv20 Rogue Thief 2024) in combat with EB Thug 1 (adjacent, target-select armed to AasimarTest).
2. Force a MISS on the Rogue (many rolls until monster attack misses).
3. Click the "Uncanny Dodge" reaction row on the PC card immediately after the miss popup.
4. Observe ability_use log + resistance buff + "Last damage taken: 0" popup — reaction spent on a miss.
5. Click again same turn: SECOND ability_use logged (double-spend window) before refusal latch engages.

## Likely Location
- `src/services/automation/handlers/superiorHunterDefenseHandler.js` (shared SHD handler, aliased by Uncanny Dodge; automationRouter.js:444 reactions.push, automation/index.js:438, core-handlers.js:292, CharReactions.jsx:78/748). Missing `lastAttack.hit===true` / damage>0 gate before spend; latch write→read race (§6-#18 full-store snapshot family) allows same-turn double spend.

## Notes
- Halving-as-post-damage-HEAL is the accepted app reaction model (CLA-335/CLA-345) — do NOT rebuild pipeline.
- Fix options: (a) gate spend on `lastAttack.hit && primaryDamage>0` at handler top with `uncanny_dodge_refused`-style log; (b) serialize latch write (await + re-read from fresh cs before second spend, mirror CLA-345 fixed latch).
- Multiattack probe recipe: same-turn control+reaction in one turn works (R4 control vs R5/R6 reaction).
