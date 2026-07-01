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
        return all;
    }
    const combatSummary = getCombatSummary(campaignName);
    const creatures = combatSummary?.creatures || [];
    return creatures;
}

export function getDuplicityAdvantageAgainst({ targetPos, attackerName, campaignName, mapData, skipRangeCheck }) {
    if (!skipRangeCheck && (!targetPos || !mapData)) return { advantage: false };

    const allCreatures = getPlayersList(mapData, campaignName);

    if (!allCreatures.length) return { advantage: false };

    const clericHasBuff = allCreatures.some(c => {
        const buffs = getRuntimeValue(c.name, 'activeBuffs', campaignName) || [];
        const has = Array.isArray(buffs) && buffs.some(b => b.effect === 'create_illusion' && b.isImprovedDuplicity);
        return has;
    });

    if (!clericHasBuff) {
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
            if (dist !== null && dist <= 5) {
                return { advantage: true, source: creature.name };
            }
        }
    } else {
        for (const creature of allCreatures) {
            if (creature.name === attackerName) continue;
            const buffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName) || [];
            const illusionBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'create_illusion' && b.isImprovedDuplicity) : null;
            if (illusionBuff) {
                return { advantage: true, source: creature.name };
            }
        }
    }
    return { advantage: false };
}
