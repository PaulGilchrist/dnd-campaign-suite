# MA-2022 — Thunderbird "Storm Call (Costs 2 Actions)": delegate_to hijack resolves master Thunderstrike's 12d10 instead of raw 6d8

## Title
MA-2022 Thunderbird — Storm Call (Costs 2 Actions) delegate_to numeric hijack: press resolves DC 24 Dex **12d10** (master Thunderstrike) instead of RAW **6d8**; wrong dice formula, wrong average (66 vs 27), master's AoE shape/range.

## Overview
MA-1928 twin (delegate-hijack family): the legendary child "Storm Call (Costs 2 Actions)" is a prose-delegate row (`delegates_to: "Thunderstrike (Recharge 5-6)"`) with **no own save_dc/save_type/damage fields**. At a legal costs-2 boundary the press resolves through the MASTER's payload — its dice formula (12d10), its ledger name, and its shapeless 60-ft save semantics — instead of the RAW Storm Call numbers in the manifest description. Live-verified on test-campaign r5 at boundary lastApplied `5:Bandit 1`.

## Expected (row + RAW)
Manifest row MA-2022 (legendary_actions[3], category legendary_actions, actionType save):
> "The Thunderbird calls down a single bolt of lightning on one creature within 120 ft. The target must succeed on a DC 24 Dexterity saving throw or take **27 (6d8)** Lightning damage."

- Single target, 120 ft, DC 24 Dexterity, **6d8 Lightning** on a **fail-only** resolution (`dc_success:"none"` semantics — prose "or take", no "Success: Half").
- Costs 2 legendary uses of 3 (name parse), leaving 1.

## Actual (live, 2026-10-12)
Legal boundary press (post-regain pool 3/3 → spends 2, popup/ledger):
- Popup title / all ledger entries ride the MASTER: `"Storm Call (Costs 2 Actions) (Thunderstrike (Recharge 5-6) save)"`; victim save-roll entry `name:"Thunderstrike (Recharge 5-6)"`.
- Save chip resolves **formula "12d10"** — rolls [5,10,4,8,8,4,4,6,8,6,8,10] = **81 raw** vs RAW 6d8 (avg 27) — `save-damage` roll + `hp_change delta:-81` Bandit 1 417→336. Numeric **FAIL(a)/DATA** (double dice count, d10 vs d8, ~2.4× expected average).
- DC 24 Dexterity coincidentally matches master (undetectable on DC); range/shape semantics inherited from master's shapeless "within 60 ft" AoE pool rather than RAW single-target 120 ft (not separately falsifiable this press — Bandit was in both pools).
- Economy side is HONEST (not the defect): `ability_use` "spends 2 legendary uses", LA used 0→2 ("1 left"), latch {round:5, activeCreature:"Bandit 1"}; same-boundary re-press refused "Only one legendary action…Nothing spent"; pool=1 at next fresh boundary refused "costs 2 legendary uses but Thunderbird 1 has only 1 left … Nothing spent, no roll" (MA-2001 twin face confirmed).
- Cosmetic pitfall re-confirmed (MA-2019): chip title hardcoded **"Expend 1 legendary use — Storm Call (Costs 2 Actions)"** while the row IS costs-2 (engine parses the NAME honestly).
- Known filed bug re-confirmed x2 during run: `combatSummary.activeCreatureName` mirror froze (thunderbird at Bandit-boundary, Bandit at Aasimar-boundary) causing false "not its own"/latch refusals — unstuck via MA-2011 full-store `POST /combatSummary {value:{...cs, activeCreatureName:<truth>}}` + reload (`bug-init-cs-active-creature-name-frozen-legendary-overgate.md`).

## Steps to Reproduce
1. test-campaign, EB-join Thunderbird (+ Bandit 1 victim, raw Dex +0 = deterministic fail vs DC 24).
2. Walk initiative to Thunderbird own-turn start (regain: monsterLegendaryUses used→0/3).
3. Close card, Next → boundary (lastApplied e.g. `5:Bandit 1`; unstick frozen cs mirror if refused "not its own" with fresh pool).
4. Arm Bandit on TB initiative card `[data-testid="target-select"]`, open TB card, press Storm Call Expend chip (`span.mc-dice-link-legendary`, title "Expend 1 legendary use — Storm Call (Costs 2 Actions)").
5. Observe popup: "Thunderstrike (Recharge 5-6) … 12d10 … SAVE FAILURE (n vs DC 24) … NN damage" — master's dice, not 6d8.

## Likely Location
**monsters.json data drift** (primary): legendary_actions[3] authors only `name/description/delegates_to`; the delegate resolver (MonsterCardModal.jsx / delegation resolution feeding saveProcessing.js) substitutes the master action's `damage_dice_primary/save_dc/save_type/description` wholesale. No engine-layer defect — the delegate mechanism faithfully resolves what it's told to; the data is wrong for this RAW action.

## Fix (MA-1928 / Cthulhu Madness Whisper byte-shape)
Drop `delegates_to` and author own fields:
`{name:"Storm Call (Costs 2 Actions)", description:<row prose>, save_dc:24, save_type:"Dexterity", damage_dice_primary:"6d8", damage_type_primary:"Lightning", dc_success:"none", save_effect:<single-target lightning prose or omit>}` — "or take" prose = fail-only. Numeric save child then self-suppresses its own Expend chip (§507) and rides the section-wrapped costs-2 gate via the NAME parse. Coupling note: master Thunderstrike's own `(Recharge 5-6)` name-text remains inert — separate filed bug **MA-2017** (needs flat `recharge:"5-6"`).

## Notes
- Tricotomy: FAIL(a) — triggered and resolved, wrong dice/formula (DATA).
- Zero-spend proven on all three refusal faces (LA used unchanged 2/3; no new hp_change entries).
- Board post-run admin-cleared (cd {} + log []) — THUNDERBIRD BLOCK COMPLETE (MA-2014..2022).
- Injections seen this session: none beyond orchestrator-brief channel.
