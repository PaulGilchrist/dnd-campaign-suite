import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

export async function getDuplicityAdvantageAgainst({ attackerName, mapData }) {
    const players = mapData?.players?.length ? mapData.players : [];
    const placedItems = mapData?.placedItems || [];
    const allCreatures = [...players];
    const existingNames = new Set(allCreatures.map(c => c.name));
    for (const item of placedItems) {
        if (!existingNames.has(item.name)) {
            allCreatures.push({ name: item.name, gridX: item.gridX, gridY: item.gridY });
        }
    }

    if (!allCreatures.length) return { advantage: false };

    const clericHasBuff = allCreatures.some(c => {
        const buffs = getRuntimeValue(c.name, 'activeBuffs') || [];
        const has = Array.isArray(buffs) && buffs.some(b => b.effect === 'create_illusion' && b.isImprovedDuplicity);
        return has;
    });

    if (!clericHasBuff) {
        return { advantage: false };
    }

    for (const creature of allCreatures) {
        if (creature.name === attackerName) continue;
        const buffs = getRuntimeValue(creature.name, 'activeBuffs') || [];
        const illusionBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'create_illusion' && b.isImprovedDuplicity) : null;
        if (!illusionBuff) continue;

        const inRange = await isWithinRange(creature.name, attackerName, 5);
        if (!inRange) continue;

        return { advantage: true, source: creature.name };
    }
    return { advantage: false };
}
