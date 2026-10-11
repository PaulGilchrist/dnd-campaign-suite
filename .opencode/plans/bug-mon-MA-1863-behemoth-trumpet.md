# MA-1863 — Behemoth "Trumpet (Costs 2 Actions)" — inert legendary save (prose-only data)

## Title
Behemoth Trumpet: no structured save fields authored → chip press console-errors with no resolution, and spends only 1 LA instead of 2.

## Overview
Row MA-1863 (`behemoth|legendary_actions|3`), actionType `save`, verified E2E localhost/test-campaign 2026-10-10. The legendary child authors ONLY `name` + `description` — no `save_dc`, `save_type`, `delegates_to`, `automation`, `hit_target_effect`, or `costs`. Pressing the chip produces zero popup/roll/log resolution (console error, MA-0510/0696 silent-burn family), and the RAW cost of 2 is not honored (spends 1).

## Expected Behavior
Row description: "Behemoth bellows. Each enemy within 60 ft. that can hear it must succeed on a DC 23 Wisdom saving throw or be unable to use Reactions until the end of its next turn."
Expected: DC 23 Wisdom save enforced vs each enemy in range; on fail a no-reactions effect applied until end of target's next turn; cost exactly 2 legendary uses.

## Actual Behavior
- Chip press (`.mc-dice-link-legendary` on Trumpet row, native click): ZERO popup, zero `.sp-overlay`; console.error `legendary action "Trumpet (Costs 2 Actions)" delegates_to "undefined" — no resolvable mechanic` (MonsterCardModal.jsx:715 else-branch).
- DC 23 WIS never enforced: zero roll-save/save_result entries; `lastAttack:null`.
- Reaction-block never applied: te `no_reactions` IS registered (targetEffectDefinitions.js:290, live consumers) but no producer for this row; `targetEffects:null`, victims `activeConditions:[]`.
- LA cost spends 1, not 2 (`monsterLegendaryUses{max:3,used:1}`; "Costs 2" is name-text only, grep-zero cost-token parse — MA-1847 twin).
- Economy gate intact (once-per-boundary latch honest); HP untouched (no damage authored — consistent).

## Steps to Reproduce
1. localhost → test-campaign → EB Behemoth ×1 → Join Encounter; arm target.
2. After a PC turn, press the Trumpet legendary chip on the Behemoth card.
3. Observe console error, zero popup/log resolution, LA counter −1 (not −2).

## Likely Location
`public/data/monsters.json` data gap — author `save_dc:23`, `save_type:"Wisdom"`, and a `hit_target_effect`/te `no_reactions` (consumer lane live) with duration to end-of-next-turn; optionally a cost token or engine support for "Costs 2" (MA-1847 precedent, engine-side).

## Notes
- Static dump: `{"name":"Trumpet (Costs 2 Actions)","description":"Behemoth bellows. Each enemy within 60 ft. that can hear it must succeed on a DC 23 Wisdom saving throw or be unable to use Reactions until the end of its next turn."}` — no other fields.
- Families: MA-1846 (Venomous Sting), MA-1855 (Dread Word), MA-1853 (Cast Cantrip) prose-only-legendary signature; MA-1847 cost-name-text twin.
