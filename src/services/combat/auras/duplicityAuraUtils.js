import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';

function getPlayersList(mapData, campaignName) {
    if (mapData?.players?.length) {
        const all = [...mapData.players];
        if (mapData.placedItems?.length) {
            const existingNames = new Set(all.map(c => c.name));
            for (const item of mapData.placedItems) {
                if (!existingNames.has(item.name)) {
                    all.push({ name: item.name, gridX: item.gridX, gridY: item.gridY });
                }
            }
        }
        console.log('[Duplicity] getPlayersList from mapData:', all.map(c => c.name));
        return all;
    }
    const combatSummary = getCombatSummary(campaignName);
    const creatures = combatSummary?.creatures || [];
    console.log('[Duplicity] getPlayersList from combatSummary:', creatures.map(c => c.name));
    return creatures;
}

export function getDuplicityAdvantageAgainst({ targetPos, attackerName, campaignName, mapData, skipRangeCheck }) {
    console.log('[Duplicity] getDuplicityAdvantageAgainst:', { attackerName, skipRangeCheck, targetPos: !!targetPos, mapData: !!mapData });

    if (!skipRangeCheck && (!targetPos || !mapData)) return { advantage: false };

    const allCreatures = getPlayersList(mapData, campaignName);
    console.log('[Duplicity] allCreatures:', allCreatures.map(c => c.name));

    if (!allCreatures.length) return { advantage: false };

    const clericHasBuff = allCreatures.some(c => {
        const buffs = getRuntimeValue(c.name, 'activeBuffs', campaignName) || [];
        const has = Array.isArray(buffs) && buffs.some(b => b.effect === 'create_illusion' && b.isImprovedDuplicity);
        if (has) console.log('[Duplicity] Found cleric with buff:', c.name);
        return has;
    });

    if (!clericHasBuff) {
        console.log('[Duplicity] No cleric with buff found');
        return { advantage: false };
    }

    if (!skipRangeCheck) {
        for (const creature of allCreatures) {
            if (creature.name === attackerName) continue;
            const buffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName) || [];
            const illusionBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'create_illusion' && b.isImprovedDuplicity) : null;
            if (!illusionBuff) continue;

            const dist = getDistanceFeet(
                { gridX: creature.gridX, gridY: creature.gridY },
                { gridX: targetPos.gridX, gridY: targetPos.gridY }
            );
            console.log('[Duplicity] Checking creature', creature.name, 'distance:', dist);
            if (dist !== null && dist <= 5) {
                console.log('[Duplicity] Granting advantage to', creature.name, 'from', creature.name);
                return { advantage: true, source: creature.name };
            }
        }
    } else {
        for (const creature of allCreatures) {
            if (creature.name === attackerName) continue;
            const buffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName) || [];
            const illusionBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'create_illusion' && b.isImprovedDuplicity) : null;
            if (illusionBuff) {
                console.log('[Duplicity] Granting advantage to', creature.name, '(skipRangeCheck)');
                return { advantage: true, source: creature.name };
            }
        }
    }
    console.log('[Duplicity] No advantage granted');
    return { advantage: false };
}
