import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

export function checkPsychicVeil(attackerName, campaignName) {
    const attackerBuffs = getRuntimeValue(attackerName, 'activeBuffs', campaignName);
    const attackerBuffArray = Array.isArray(attackerBuffs) ? attackerBuffs : [];
    if (attackerBuffArray.some(b => b.name === 'Psychic Veil')) {
        const rawAttackerConditions = getRuntimeValue(attackerName, 'activeConditions');
        const attackerConditions = rawAttackerConditions || [];
        const attackerCondArray = attackerConditions;
        const filteredConditions = attackerCondArray.filter(c => String(c).toLowerCase() !== 'invisible');
        if (filteredConditions.length !== attackerCondArray.length) {
            setRuntimeValue(attackerName, 'activeConditions', filteredConditions, campaignName);
        }
        const filteredBuffs = attackerBuffArray.filter(b => b.name !== 'Psychic Veil');
        if (filteredBuffs.length !== attackerBuffArray.length) {
            setRuntimeValue(attackerName, 'activeBuffs', filteredBuffs, campaignName);
        }
    }
}
