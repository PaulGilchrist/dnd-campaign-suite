import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

/**
 * Extract darkvision range in feet from a value string like "120 ft."
 */
export function extractDarkvisionFeet(value) {
    if (!value) return 0;
    const match = String(value).match(/(\d+)\s*ft/i);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Apply The Third Eye darkvision enhancement from active buffs.
 * Sets Darkvision to 120 ft if the Third Eye buff with darkvision_120 effect is active.
 */
export function applyThirdEyeDarkvision(playerStats, senses, campaignName) {
    const stored = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const thirdEyeBuff = activeBuffs.find(b => b.name === 'The Third Eye' && b.effect === 'darkvision_120');
    if (!thirdEyeBuff) return senses;

    const darkvisionIndex = senses.findIndex(s => s.name === 'Darkvision');
    if (darkvisionIndex !== -1) {
        const currentFeet = extractDarkvisionFeet(senses[darkvisionIndex].value);
        if (currentFeet >= 120) return senses;
        senses[darkvisionIndex] = { ...senses[darkvisionIndex], value: '120 ft.' };
    } else {
        senses.push({ name: 'Darkvision', value: '120 ft.' });
    }

    return senses;
}

/**
 * Apply Umbral Sight darkvision enhancement for Gloom Stalkers.
 * Adds 60 feet to existing Darkvision range, or sets Darkvision to 60ft if not present.
 */
export function applyUmbralSightDarkvision(playerStats, senses) {
    const isGloomStalker = playerStats.class?.major?.name === 'Stalker';
    if (!isGloomStalker) return senses;

    const darkvisionIndex = senses.findIndex(s => s.name === 'Darkvision');
    const extractDarkvisionFeet = (value) => {
        if (!value) return 0;
        const match = String(value).match(/(\d+)\s*ft/i);
        return match ? parseInt(match[1], 10) : 0;
    };

    if (darkvisionIndex !== -1) {
        const currentFeet = extractDarkvisionFeet(senses[darkvisionIndex].value);
        const newFeet = currentFeet + 60;
        senses[darkvisionIndex] = { ...senses[darkvisionIndex], value: `${newFeet} ft.` };
    } else {
        senses.push({ name: 'Darkvision', value: '60 ft.' });
    }

    return senses;
}

/**
 * Apply Blindsight from passive_buff automation (e.g., Skulker feat in 2024).
 * Adds Blindsight with the specified range to player senses.
 */
export function applyBlindsightSenses(playerStats, senses) {
    // Apex guard (#204-class): loud posture — the file's own next arms console.error+throw
    // for a missing passives array, and a missing apex playerStats is the same data-hole
    // class one level up. Consumer rules-senses.js is pre-gated inside getPlayerStats.
    if (!playerStats) {
        console.error('rules: missing playerStats for blindsight senses');
        throw new Error('Missing playerStats: applyBlindsightSenses');
    }
    const passives = playerStats.automation?.passives;
    if (!Array.isArray(passives)) {
        console.error('rules: expected passives to be an array for', playerStats.name);
        throw new Error('Missing array: passives for ' + playerStats.name);
    }
    const blindsightPassive = passives.find(p => p.type === 'passive_buff' && p.effect === 'blindsight');
    if (!blindsightPassive) return senses;

    const rangeMatch = String(blindsightPassive.range || '').match(/(\d+)\s*ft/i);
    const range = rangeMatch ? `${rangeMatch[1]} ft.` : '10 ft.';

    if (!senses.some(s => s.name === 'Blindsight')) {
        senses.push({ name: 'Blindsight', value: range });
    }

    return senses;
}

/**
 * Apply Truesight from passive_buff automation (e.g., Boon of Truesight feat).
 * Adds Truesense with the specified range to player senses.
 */
export function applyTruesightSenses(playerStats, senses) {
    // Apex guard (#204-class): loud posture, twin of applyBlindsightSenses — same file-owned
    // console.error+throw arms for missing passives immediately below.
    if (!playerStats) {
        console.error('rules: missing playerStats for truesight senses');
        throw new Error('Missing playerStats: applyTruesightSenses');
    }
    const passives = playerStats.automation?.passives;
    if (!Array.isArray(passives)) {
        console.error('rules: expected passives to be an array for', playerStats.name);
        throw new Error('Missing array: passives for ' + playerStats.name);
    }
    const truesightPassive = passives.find(p => p.type === 'passive_buff' && p.effect === 'truesight');
    if (!truesightPassive) return senses;

    const rangeMatch = String(truesightPassive.range || '').match(/(\d+)\s*ft/i);
    const range = rangeMatch ? `${rangeMatch[1]} ft.` : '60 ft.';

    if (!senses.some(s => s.name === 'Truesight')) {
        senses.push({ name: 'Truesight', value: range });
    }

    return senses;
}
