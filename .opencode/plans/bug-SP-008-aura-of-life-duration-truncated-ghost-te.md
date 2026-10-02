# Bug — SP-008 Aura of Life: aura truncated to ~1 round at caster round-2 anchor; ghost te badges after purge

## Title
Aura of Life buffs/HP-max protection expire at caster's round-2 turn-start (~1 round) instead of Concentration ≤10 minutes; te badges survive the purge

## Overview
Verified 2026-10-01 E2E (test-campaign, Divine_Cleric lv17 Life host). Cast economy, concentration, necrotic-resistance fold, and 0-HP turn-start heal are live-exact, but the aura's own duration is anchored to the caster's next turn-start and stripped after ~1 round (RAW: concentration, up to 10 minutes), while te markers/badges persist after the buffs are purged. PASS-subset legs stand; the duration leg is a triggered-path defect (same adjudication rule as SP-127 upcast miscalc).

## Expected Behavior (canonical app data)
`public/data/2024/spells.json` Aura of Life: "Duration: Concentration, up to 10 minutes … 30-foot Emanation … Resistance to Necrotic damage … Hit Point maximums can't be reduced … ally with 0 HP starts its turn in the aura regains 1 Hit Point."

## Actual Behavior
- PASS legs (kept): lv4 slot paid 3→2 (no zero-slot island); cs.concentration {Aura of Life, dc 17}; 4 targets activeBuffs(+Necrotic)+turnStartEffects[aura_of_life_turn_start_heal]+auraOfLifeHpMaxProtected; necrotic differential in-aura raw 38→19 resisted:true vs control 19→19 resisted:false; 0-HP heal LIVE turnStartEffects.js:162→:455 ("Aura of Life (1 HP at start of turn)", LightfootHalfling 0→1).
- FAIL legs: buffs/flag stripped at caster round-2 turn-start (rounds:undefined + expireOnCreatureName:caster anchor; §SP-125 twin); te `aura_of_life` markers + badges persist after purge ("badge lies"); buff duration label hardcoded "up to 1 minute" (auraOfLifeHandler.js:56); popup description/maxTargets:5 are Aura-of-Protection copy.
- Gap (advisory, not chased): `auraOfLifeHpMaxProtected` has zero consumers in hpMaxReduceService/saveProcessing/handlePlainDamage — "can't be reduced" is inert vs MA-1718 drain lanes.

## Steps to Reproduce
1. test-campaign Divine_Cleric: seed Deafened (EffectAdder), cast Aura of Life lv4 on ≤5 allies.
2. Walk initiative past caster's next turn-start: target activeBuffs + auraOfLifeHpMaxProtected gone (~1 round); te badges still render; concentration row still shows aura.
3. Necrotic then lands unresisted on former in-aura ally.

## Likely Location
- `src/services/automation/handlers/auraOfLifeHandler.js:56` (hardcoded "1 minute" label) + expiration anchor (rounds:undefined → caster round-2 purge path shared with SP-125 family).
- "Can't be reduced" block: needs consumer in `hpMaxReduceService`/`saveProcessing` consulting `auraOfLifeHpMaxProtected`.

## Notes
- Fix options: anchor duration to explicit rounds (10min = concentration clock shared with concentration state) or make expireOnCreature anchor honor declared minute-durations; sync te purge with buff purge so badges don't lie.
- Checkpoint: `.opencode/plans/checkpoint-SP-008.md`; screenshot `.opencode/plans/screenshots/SP-008-aura-badges.png`.
