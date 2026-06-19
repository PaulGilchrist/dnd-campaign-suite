import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const OVERCHANNEL_KEY = 'Overchannel_useCount';

export async function handle(action, playerStats, _campaignName, _mapName) {
    const usesKey = OVERCHANNEL_KEY;

    const currentUseCount = Number(getRuntimeValue(playerStats.name, usesKey) ?? 0);

    const nextUseCount = currentUseCount + 1;
    const useLabel = nextUseCount === 1 ? 'First use' : `Use #${nextUseCount}`;
    const damageNote = nextUseCount === 1 ? 'no adverse effect' : `take ${nextUseCount * 2}d12 necrotic damage`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${action.name}: You can deal maximum damage with a Wizard spell (slot levels 1-5) on the turn you cast it. ${useLabel}: ${damageNote}.`,
            automation: action.automation,
        },
    };
}

export function getOverchannelUses(playerStats, campaignName) {
    const usesKey = OVERCHANNEL_KEY;
    const value = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? 0);
    return value;
}

export function hasOverchannelRemaining(_playerStats, _campaignName) {
    return true;
}

export async function consumeOverchannelUse(playerStats, campaignName) {
    const usesKey = OVERCHANNEL_KEY;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey) ?? 0);
    await setRuntimeValue(playerStats.name, usesKey, currentUses + 1, campaignName);
    return true;
}

export async function restoreOverchannelOnLongRest(playerStats, campaignName) {
    await setRuntimeValue(playerStats.name, OVERCHANNEL_KEY, 0, campaignName);
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
