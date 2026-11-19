import { addMonstersToInitiative } from './encounterToInitiative.js';
import { addEntry } from '../ui/logService.js';

// Quick mob spawn (roadmap Item 4, 2026-11-19): the tracker's "+ Monster"
// picker spawns N initiative-ready cards of ONE published monster through the
// SAME encounter-expansion lane the Encounter Builder's Join rides —
// addMonstersToInitiative owns quantity expansion, numbering continuation
// (Goblin 3/4 after Goblin 1/2), initiative rolls + sorting, the strict
// read → ack-gated board write, cache publish, pending-OA drop and the
// `initiative-rolled` dispatch. This service adds only the roster disclosure
// row, in the exact EB `joined` log shape (`type:'encounter'` +
// `action:'joined'` + encounterName + `N× Name` labels) so the Log renderer
// (LogEncounterEntry.jsx) needs no new type.
//
// npcs.json invariant (AGENTS.md): a spawn NEVER writes an NPC row — the
// monster arrives with its real bestiary stat block via the join lane, the
// same way an Encounter Builder join delivers it.
//
// Post-ack logging law (bug-eb-join-swallowed-network-fail-phantom-row): the
// joined row lands only AFTER the board accepted; a rejected write throws
// here with zero log rows, so the caller's failure toast can never diverge
// from the durable log.

export const QUICK_SPAWN_ENCOUNTER_NAME = 'Quick spawn';

export async function quickSpawnMonster(monster, qty, characters, campaignName) {
    const count = Math.max(1, parseInt(qty, 10) || 1);
    const combatSummary = await addMonstersToInitiative(
        [{ ...monster, qty: count }], characters, campaignName);
    await addEntry(campaignName, {
        type: 'encounter',
        action: 'joined',
        encounterName: QUICK_SPAWN_ENCOUNTER_NAME,
        monsters: [`${count}x ${monster.name}`],
    }).catch((e) => { console.error('[quickMonsterSpawn] joined log failed:', e); });
    return combatSummary;
}
