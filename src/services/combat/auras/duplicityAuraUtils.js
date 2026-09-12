import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

function collectMapCreatures(mapData) {
    const players = mapData.players?.length ? mapData.players : [];
    const allCreatures = [...players];
    const existingNames = new Set(allCreatures.map(c => c.name));
    for (const item of mapData.placedItems || []) {
        if (!existingNames.has(item.name)) {
            allCreatures.push({ name: item.name, gridX: item.gridX, gridY: item.gridY });
        }
    }
    return allCreatures;
}

async function gatherAuraCreatures(mapData, campaignName) {
    if (!mapData) {
        const combatSummary = await getCombatContext(campaignName);
        return (combatSummary?.creatures || []).filter(c => c.type === 'player');
    }
    return collectMapCreatures(mapData);
}

function hasGrantedAdvantage(creatureName, attackerName, campaignName) {
    const buffs = getRuntimeValue(creatureName, 'activeBuffs', campaignName) || [];
    if (!Array.isArray(buffs)) return false;
    const illusionBuff = buffs.find(b => b.effect === 'create_illusion' && b.isImprovedDuplicity);
    if (!illusionBuff) return false;

    const grantedTargets = getRuntimeValue(creatureName, 'invokeDuplicityAdvantageTargets', campaignName) || [];
    return Array.isArray(grantedTargets) && grantedTargets.includes(attackerName);
}

export async function getDuplicityAdvantageAgainst({ attackerName, campaignName, mapData, skipRangeCheck }) {
    const allCreatures = await gatherAuraCreatures(mapData, campaignName);

    for (const creature of allCreatures) {
        if (creature.name === attackerName) continue;
        if (!hasGrantedAdvantage(creature.name, attackerName, campaignName)) continue;

        if (skipRangeCheck) {
            return { advantage: true, source: creature.name };
        }

        const inRange = await isWithinRange(creature.name, attackerName, 5);
        if (!inRange) continue;

        return { advantage: true, source: creature.name };
    }
    return { advantage: false };
}
