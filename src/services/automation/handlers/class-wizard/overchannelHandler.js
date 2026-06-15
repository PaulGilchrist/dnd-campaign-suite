import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/useRuntimeState.js';

const OVERCHANNEL_KEY = '_Overchannel_uses';
const OVERCHANNEL_REST_KEY = '_Overchannel_restTimestamp';
const MAX_USES = 1;

export async function handle(action, playerStats, campaignName, _mapName) {
    const usesKey = OVERCHANNEL_KEY;
    const restKey = OVERCHANNEL_REST_KEY;
    const now = Date.now();

    const lastRestTimestamp = getRuntimeValue(playerStats.name, restKey, campaignName);
    let currentMaxUses = MAX_USES;

    if (lastRestTimestamp && now - lastRestTimestamp < 86400000) {
        currentMaxUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? MAX_USES);
    } else if (!lastRestTimestamp) {
        currentMaxUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? MAX_USES);
    }

    const hasRemainingUses = currentMaxUses > 0;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${action.name}: You can deal maximum damage with a Wizard spell (slot levels 1-5) on the turn you cast it. First use: no adverse effect. Subsequent uses before Long Rest: take necrotic damage. Uses remaining: ${hasRemainingUses ? 'Yes' : 'No'}.`,
            automation: action.automation,
        },
    };
}

export function getOverchannelUses(playerStats, campaignName) {
    const usesKey = OVERCHANNEL_KEY;
    const restKey = OVERCHANNEL_REST_KEY;
    const now = Date.now();

    const lastRestTimestamp = getRuntimeValue(playerStats.name, restKey, campaignName);
    let currentMaxUses = MAX_USES;

    if (lastRestTimestamp && now - lastRestTimestamp < 86400000) {
        currentMaxUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? MAX_USES);
    } else if (!lastRestTimestamp) {
        currentMaxUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? MAX_USES);
    }

    return currentMaxUses;
}

export function hasOverchannelRemaining(playerStats, campaignName) {
    return getOverchannelUses(playerStats, campaignName) > 0;
}

export async function consumeOverchannelUse(playerStats, campaignName) {
    const usesKey = OVERCHANNEL_KEY;
    const restKey = OVERCHANNEL_REST_KEY;
    const now = Date.now();

    const lastRestTimestamp = getRuntimeValue(playerStats.name, restKey, campaignName);
    let currentUses;

    if (lastRestTimestamp && now - lastRestTimestamp < 86400000) {
        currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? MAX_USES);
    } else if (!lastRestTimestamp) {
        currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? MAX_USES);
    } else {
        currentUses = MAX_USES;
    }

    if (currentUses <= 0) {
        return false;
    }

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
    return true;
}

export async function restoreOverchannelOnLongRest(playerStats, campaignName) {
    await setRuntimeValue(playerStats.name, OVERCHANNEL_REST_KEY, Date.now(), campaignName);
    await setRuntimeValue(playerStats.name, OVERCHANNEL_KEY, MAX_USES, campaignName);
}

export function getOverchannelNecroticDamage(spellLevel, useCount) {
    const spellSlotLevel = spellLevel || 1;
    if (useCount <= 1) {
        return 0;
    }
    const additionalUses = useCount - 1;
    const dicePerLevel = 2 + additionalUses;
    return {
        formula: `${dicePerLevel}d12`,
        damageType: 'Necrotic',
        ignoresResistance: true,
        ignoresImmunity: true,
        perSpellLevel: true,
        expression: `${dicePerLevel * spellSlotLevel}d12`,
    };
}
