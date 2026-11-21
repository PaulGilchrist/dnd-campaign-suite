import {
    addMonstersToInitiative,
    hasMonsterVariant,
    normalizeMonsterSeries,
    getNextUniqueMonsterName,
} from './encounterToInitiative.js';
import { addEntry } from '../ui/logService.js';
import { loadCombatSummary } from './combatData.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import * as mapsService from '../maps/mapsService.js';
import { buildSpawnTokenRows, renumberSeriesToken } from '../maps/spawnTokenPlacement.js';

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
//
// Opt-in map-token stamp (2026-11-20 CCC backlog): tokenless quick-spawns
// degrade the monster's range/cover lane to leniency, so the picker may ask
// for a `placedItems` token per spawn (`options.placeToken`). OFF keeps the
// exact historical flow: ONE board read (the join's own strict read) and zero
// map requests. ON adds a pre-read to derive the EXACT board names the join
// lane is about to mint (predictSpawnedNames mirrors its numbering helpers),
// then stamps them party-relative onto the ACTIVE indoor map through the GM
// map-document PUT lane (open map tabs live-update on the existing SSE). A
// stamp failure never falsifies the committed board join — it logs loudly.

export const QUICK_SPAWN_ENCOUNTER_NAME = 'Quick spawn';

/**
 * Mirror of addMonstersToInitiative's naming law over a board carrying exactly
 * `boardCreatures` (name/type rows): needsNumbering gate, the series-renumber
 * of a plain row, then one getNextUniqueMonsterName draw per instance. Reusing
 * the join lane's OWN helpers is what guarantees the token names equal the
 * board names the spawn will mint.
 */
export function predictSpawnedNames(baseName, count, boardCreatures) {
    const creatures = (boardCreatures || []).map(c => ({ name: c.name, type: c.type }));
    const needsNumbering = count > 1 || hasMonsterVariant(baseName, creatures);
    normalizeMonsterSeries(baseName, creatures);
    const names = [];
    for (let i = 0; i < count; i++) {
        const name = needsNumbering ? getNextUniqueMonsterName(baseName, creatures) : baseName;
        creatures.push({ name, type: 'npc' });
        names.push(name);
    }
    return names;
}

async function stampSpawnTokens({ campaignName, baseName, spawnedNames, combatSummary }) {
    const activeMapName = getRuntimeValue('__map__', 'activeMapName');
    if (!activeMapName || spawnedNames.length === 0) return;
    const mapDoc = await mapsService.loadMapData(campaignName, activeMapName);
    if (!mapDoc) {
        throw new Error(`quick-spawn token stamp: active map "${activeMapName}" could not be loaded`);
    }
    if (mapDoc.type !== 'indoor') {
        console.error(`[quickMonsterSpawn] token stamp skipped — map "${activeMapName}" is ${mapDoc.type || 'untyped'}; `
            + 'placedItems tokens only exist on indoor grid maps.');
        return;
    }
    const placedItems = (mapDoc.placedItems || []).map(item => ({ ...item }));
    const boardNames = combatSummary.creatures.map(c => c.name);
    const renamed = renumberSeriesToken(placedItems, boardNames, baseName);
    const rows = buildSpawnTokenRows({ ...mapDoc, placedItems }, spawnedNames);
    if (rows.length === 0 && !renamed) return;
    if (rows.length < spawnedNames.length) {
        console.error(`[quickMonsterSpawn] no free cell within scan range of the party — `
            + `${spawnedNames.length - rows.length} of ${spawnedNames.length} token(s) not placed.`);
    }
    await mapsService.saveMapData(campaignName, activeMapName, { ...mapDoc, placedItems: [...placedItems, ...rows] });
}

export async function quickSpawnMonster(monster, qty, characters, campaignName, options = {}) {
    const count = Math.max(1, parseInt(qty, 10) || 1);
    const placeToken = Boolean(options.placeToken);
    // Opt-in lane only: the pre-read boards the names the join is about to
    // mint. Option OFF performs byte-identical historical traffic.
    const boardBefore = placeToken ? await loadCombatSummary(campaignName) : null;
    const combatSummary = await addMonstersToInitiative(
        [{ ...monster, qty: count }], characters, campaignName);
    await addEntry(campaignName, {
        type: 'encounter',
        action: 'joined',
        encounterName: QUICK_SPAWN_ENCOUNTER_NAME,
        monsters: [`${count}x ${monster.name}`],
    }).catch((e) => { console.error('[quickMonsterSpawn] joined log failed:', e); });
    if (placeToken) {
        const expected = predictSpawnedNames(monster.name, count, boardBefore?.creatures || []);
        const landed = expected.filter(name => combatSummary.creatures.some(c => c.name === name));
        if (landed.length !== expected.length) {
            console.error('[quickMonsterSpawn] token stamp skipped — another tab reshaped the '
                + `${monster.name} series between the pre-read and the join (expected ${expected.join(', ')}).`);
        }
        await stampSpawnTokens({ campaignName, baseName: monster.name, spawnedNames: landed, combatSummary })
            .catch((e) => { console.error('[quickMonsterSpawn] map token stamp failed:', e); });
    }
    return combatSummary;
}
