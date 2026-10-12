# MA-1944 — Ladon "Vigilant Watch (Costs 2 Actions)": fix-target +5-to-hit rider has zero consumer (FAIL(b))

## Title
MA-1944 Ladon Vigilant Watch (Costs 2 Actions) — legendary press burns 2 uses with zero core effect: no target fix, no +5 Opportunity Attack rider, console.error "no resolvable mechanic".

## Overview
`MA-1944` / monster `ladon` / `legendary_actions[3]` / actionType `other`. The row renders a gated "Expend Legendary" chip whose economy half is LIVE (MA-1883 parses "Costs N Actions" from the row NAME and spends N=2 honestly), but the described core effect — fix one target, +5 to the next Opportunity Attack against that target until the start of Ladon's next turn — has NO producer and NO consumer anywhere in the app. The press falls through every branch of `resolveLegendaryRowMechanic` and dies at the MA-0510 console dead-end: uses are spent, nothing lands.

## Expected Behavior (row + disk data, verbatim)
Disk (`public/data/monsters.json`, legendary_actions[3], byte-confirmed 2026-10-11):

```json
{
  "name": "Vigilant Watch (Costs 2 Actions)",
  "delegates_to": null,
  "description": "Ladon fixes one target. Until the start of his next turn, his next Opportunity Attack against that target has +5 to hit."
}
```

Expected RAW behavior:
1. Chip press spends 2 legendary uses at a legal after-another-creature's-turn boundary.
2. The press FIXES a chosen target — persistent state (targetEffect / marked-target record) on the target or attacker.
3. Ladon's next Opportunity Attack against that fixed target rolls with +5 to hit (base +15 → +20).
4. The fix expires at the start of Ladon's next turn.

## Actual Behavior
Economy only; core effect inert:
- Press #1 (fresh boundary, active=AasimarTest): counter 3→**(1 left)**, `monsterLegendaryUses {max:3, used:2}`, ONE spend log `"Ladon 1 spends 2 legendary uses for Vigilant Watch (Costs 2 Actions) after AasimarTest's turn — 1 of 3 left"`. **NO popup, NO target selection prompt, NO targetEffect, NO lastAttack, NO change-data key matching /vigilant|fix|opportunity|toHit|marked/ across ANY store.** Console error: `[MonsterCardModal] legendary action "Vigilant Watch (Costs 2 Actions)" delegates_to "null" — no resolvable mechanic on "Ladon 1"` (MA-0510 silent-burn signature).
- Press #2 same boundary: honest refusal popup "Only one legendary action can be expended immediately after each creature's turn" + `legendary_use_refused (turn)` — zero spend (gate lane live, same as every other legendary row).
- Control probe next fresh boundary (after cs unstick, active=AberrantSorcerer): legendary Bite vs Bandit 1 (AC12) resolves `lastAttack {d20:9, bonus:15, total:24, hit:true}` — **+15, NOT +20**. Zero +5 rider was carried. Damage 22+15, hp_change -37. `targetEffects` TOP-level: ABSENT.
- Ladon `reactions: []` on disk; monster card renders no Reactions section — there is no monster-side Opportunity Attack surface at all to receive the rider even if it were granted.

## Steps to Reproduce
1. `npm run dev` (:5173), campaign `test-campaign`.
2. Encounter Builder: search "Ladon" → checkbox → Join Encounter; search "Bandit" → exact "Bandit" row → Join Encounter. (cs: Ladon 1 idx0 init 17, Bandit 1 idx1; rig victim HP via full-store cs POST currentHp+maxHp=999.)
3. Open Ladon 1 card → Legendary Actions section: "Vigilant Watch (Costs 2 Actions). [Expend Legendary]".
4. At a boundary after another creature's turn, press the chip: uses 3→1, spend log logs, NO popup; console shows `no resolvable mechanic`.
5. Arm Bandit 1 on Ladon's initiative-card target-select; at the next fresh boundary press the legendary Bite chip: attack rolls +15 (never +20); change-data holds no fixed-target state.
   (If the press refuses `(turn)` on a genuine fresh boundary, the cs.activeCreatureName mirror is frozen — unstick via full-store POST /combatSummary {value:{...cs, activeCreatureName:'<top-level truth>'}}, MA-1852.)

## Likely Location
- **Data layer (primary):** row authors `name` + `delegates_to:null` + prose only — no `automation {type, trigger, effect}`, no te key, no fix-target transport. Per §60/§70 class, prose-only riders are inert.
- `src/components/encounter/MonsterCardModal.jsx:751-777` `resolveLegendaryRowMechanic` — falls through attack/save/advisory/self-buff/damage branches to the `console.error` dead-end (:776).
- `src/services/encounters/monsterLegendaryUses.js:179-183` `legendaryActionCost` — the LIVE half: parses "Costs 2 Actions" (MA-1883), so the spend/refusal economy byte-correctly engages a row with no payload.
- No consumer targets exist: `grep -rn -i "vigilant" src/ server/` → ZERO hits; `targetEffectDefinitions.js` has no fixed-target / +N-to-hit te (only `no_opportunity_attacks`, opposite clause); monster Opportunity Attack machinery is PC-side only (`CharReactions.jsx`), Ladon `reactions:[]`.

## Notes
- The task premise "Costs 2 name-text only, unenforced" is SUPERSEDED by MA-1883: the cost IS parsed and enforced live (spends exactly 2, `insufficient-cost` refusal vocabulary exists at monsterLegendaryUses.js:199/247-248). The defect is now purely the inert core payload — which makes this row a *negative-economy* row: it takes the 2-use payment and delivers 0% of the described effect.
- Fix options (orchestrator call): (A) honest advisory one-field fix `advisory:"vigilant_watch"` + `advisory_message` carrying the RAW numerics GM-enforced — MA-1851 Spell Absorption precedent (data-only, zero engine change); (B) full build = fix-target te registration + monster-OA attack-bonus rider channel + turn-start expiry — new machinery (attackBonusBonus channel grep-zero app-wide), exceeds one-field fix.
- Popup title on the chip says "Expend 1 legendary use" while the press spends 2 — cosmetic title defect at MonsterAction.jsx:221 (`title={...Expend 1...}` hardcoded), note-only, log truth honest.
- Verdict: FAIL(b) — triggered chip, zero core affordance: no popup, no roll, no state change; uses silently burned. Not PASS-subset: no part of the implemented core (fix target / +5 rider) exists.
- Verified 2026-10-11, :5173, test-campaign, Ladon 1 (init 17) + Bandit 1 victim 999/999 AC12; cleanup admin-clear cd{} log[] quiet.
