# MA-2045 — Typhon "Earthquake (Costs 2 Actions)": Prone rider inert — save_effect absent (hit_conditions bait, §567) — FAIL(a)/DATA (prone-scoped)

## Title
MA-2045 Typhon Earthquake (Costs 2 Actions) — failed Dex save applies 6d8 Bludgeoning EXACTLY but grants ZERO Prone: save lane word-scans `save_effect` only, row authors `hit_conditions:["prone"]` (attack-lane key) and no `save_effect` → knocked-Prone rider structurally inert. One-field DATA fix. Costs-2 economy, DC/type/dice all honest; delegates_to master hijack does NOT fire (own numeric fields win).

## Overview
Legendary costs-2 save child authored with **its own numeric fields** (save_dc 25, Dexterity, 6d8 Bludgeoning) *plus* a vestigial `delegates_to:"Storm Breach (Recharge 5-6)"` (master DC27 STR 26d6). HIJACK question answered: delegation is gated by `legendaryRowHasNumericMechanic(action)` (MonsterCardModal.jsx:895) — numeric child NEVER delegates; master payload appears nowhere in census, popup, or ledger (MA-2022 Storm Call twin does NOT reproduce). Core save numerics verified byte-exact live. The single defect: description promises "the target is knocked Prone" on a fail, but save rows extract conditions ONLY from `save_effect` (§346; Modal:754 `extractConditionsFromSaveEffect(action.save_effect)` → `saveConditions` threaded to saveProcessing, empty = zero grants, MA-2013 Locking Word twin). `hit_conditions` is read by `buildHitConditionClause` — attack-lane only — so the disk key is §567 bait.

## Expected (row + monsters.json)
Row MA-2045 (legendary_actions[3], category legendary_actions, actionType save):
> "Dexterity Saving Throw: DC 25, each creature within 60 ft. Failure: 27 (6d8) Bludgeoning damage **and the target is knocked Prone**. Success: half damage and not Prone."

- DC 25 Dexterity, 6d8 Bludgeoning, half-on-success, **Prone on failure**, costs 2 of 3 legendary uses.
- monsters.json disk row: save_dc 25, save_type Dexterity, damage_dice_primary "6d8", damage_type_primary Bludgeoning, hit_conditions ["prone"], **NO `save_effect` key**; also carries `delegates_to:"Storm Breach (Recharge 5-6)"` (inert for numeric children).

## Actual (live, 2026-10-12, test-campaign r3 boundary `3:AasimarTest`)
- Census (pre-press): row renders own chips "DC 25 Dexterity" + "6d8" — NOT master's 27/STR/26d6; no Expend chip (§507 numeric-save self-suppression; DC chip IS the gated surface).
- Refusals honest BEFORE the press: same-boundary double-press reads `turn`; fresh-boundary pool-1 press refuses `insufficient-cost: costs 2, 1 left` — popup + log, zero spend, no roll (MA-2001/MA-1920 faces live).
- Own-turn regain honest: at `3:Typhon 1` turn-start monsterLegendaryUses used 2→0 (pool 3).
- Legal-boundary press: `ability_use` "Typhon 1 spends 2 legendary uses for Earthquake (Costs 2 Actions) after AasimarTest's turn — 1 of 3 left" (used 0→2). Face pinned: **inline auto-roll, NOT picker** (`sp-overlay` absent; shapeless "within 60 ft" prose with no Cone/Line/Sphere noun = MA-2041 picker-inert pin). Ledger triple byte-exact: `roll save` (Bandit 1, saveDc 25, saveType Dexterity, saveResult failure, total 6; d20 6 +0 < 25 deterministic fail face) + `roll save-damage` (formula "6d8", rolls [8,5,3,8,1,6], Σ=31 == finalDamage 31, Bludgeoning) + `hp_change` (Δ −31 == |Σ|; Bandit 332→301). No master bytes anywhere ("Storm Breach", 26d6, DC 27, Strength = zero ledger hits).
- **THE DEFECT — PRONE:** after the verified save FAILURE, Bandit 1 cd carries no `activeConditions` key at all, zero log entries match /prone/i (no condition-applied record), zero Prone badges on initiative card or overlay. Rider never fires, any number of fails.
- Half-on-success face not live-testable on this lane (inline ignores stamped full-word saveBonuses per MA-2041/§211 — adjudicated separately, NOT this row's defect); engine default `dc_success ?? 'half'` (Modal:286) matches the row prose, verified by code read.

## Steps to Reproduce
1. :5173 → test-campaign → Initiative (board: Typhon 1 + Bandit 1).
2. Walk to a legal legendary boundary NOT Typhon (unstick frozen cs mirror via full-store POST /combatSummary {value:{...cs, activeCreatureName:<truth>}} — MA-2011).
3. Arm Bandit 1 on Typhon's initiative-card `[data-testid="target-select"]`; open Typhon `.mc-overlay`.
4. Press "DC 25 Dexterity" chip on ^Earthquake row (needs pool ≥2 — regain at Typhon own-turn first).
5. Observe popup + ledger: DC 25 Dex fail, 6d8 Bludgeoning full damage — but Bandit gains NO Prone condition (cd activeConditions absent, no prone log line, no badge).

## Likely Location
**monsters.json data drift** (`public/data/monsters.json`, Typhon legendary_actions[3]): consumer chain fully wired and correct — Modal:754 `extractConditionsFromSaveEffect(action.save_effect)` feeds `saveConditions` through executeBlockSaveRoll → saveProcessing grants exactly what it receives; `hit_conditions` is consumed only by the attack-lane `buildHitConditionClause`. Data authors the condition on the wrong key (bait) and omits the read key. No engine change needed.

## Fix (one field; MA-2013/MA-1928 byte-shape)
Add to Typhon legendary_actions[3]: `"save_effect": "The target has the Prone condition."` — keep `dc_success` UNSET (engine default 'half' already matches "Success: half damage and not Prone"; save_effect grants fire on failure only). Do NOT add `dc_success:"none"` (that would zero the legitimate half-on-success). Cleanup hygiene: `delegates_to:"Storm Breach (Recharge 5-6)"` is provably inert on numeric children but is misleading drift — dropping it alongside MA-2041's `recharge:"5-6"` master fix is recommended. Coupling: master Storm Breach's recharge gate remains its own filed inertness (MA-2041).
After edit: admin-clear cd+log → reload → re-select → EB re-join → reopen card.

## Notes
- Tricotomy: FAIL(a) — triggered and resolved, promised condition not applied on fail (DATA, prone-scoped). Every other axis PASS-exact: costs-2 spend/refusals/regain honest, DC/type/dice/type-of-damage byte-exact, inline-lane pin correct, hijack DENIED (own fields win; resolver:895 gate).
- NEW PITFALLS: (1) post-reload campaign-select bounce — `Campaigns` nav lands on Select-a-Campaign; re-click test-campaign, never a production name; (2) full-store `/combatSummary` POST body unwraps via extractPropertyValue — GET shape varies ({value:{...}} vs direct dict): read `d.combatSummary?.value ?? d.combatSummary` or you will self-wipe cs with a truncated rebuild (hit + rebuilt byte-identical this run); (3) `/change-data/<key>` subpath POSTs 404 — key route is `/api/campaigns/:c/:key` bare.
- Zero-spend proven on all refusal faces (used stayed 2/3 through refusals; 0→2 only on the legal press; no stray hp_change).
- Board: LAST Typhon row — admin-cleared cd ({}) + log ([]) post-run, GET-verified quiet; app left RUNNING.
