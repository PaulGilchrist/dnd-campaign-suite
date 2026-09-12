import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { executeHandler } from '../../automation/index.js';
import { usesSpellSlot } from './spellUtils.js';
import { checkOncePerTurn, markOncePerTurn } from '../../automation/common/oncePerTurn.js';

function isSorcererSpell(spell, playerStats) {
    const casterClass = playerStats?.class?.name;
    if (casterClass === 'Sorcerer') return true;
    if (spell.classes && spell.classes.includes('Sorcerer')) return true;
    return false;
}

export function getWildMagicSurgeFeatures(playerStats) {
    const passives = playerStats?.automation?.passives;
    if (passives == null) {
        console.error('[wildMagicSurgeService] Missing array:', passives);
        throw new Error('Expected array, got ' + passives);
    }
    return passives.filter(p => p.type === 'wild_magic_surge');
}

export function getControlledChaosFeature(playerStats) {
    const passives = playerStats?.automation?.passives;
    if (passives == null) {
        console.error('[wildMagicSurgeService] Missing array:', passives);
        throw new Error('Expected array, got ' + passives);
    }
    return passives.find(p => p.type === 'auto_effect' && p.effect === 'wild_magic_double_roll');
}

export function getTamedSurgeFeature(playerStats) {
    const passives = playerStats?.automation?.passives;
    if (passives == null) {
        console.error('[wildMagicSurgeService] Missing array:', passives);
        throw new Error('Expected array, got ' + passives);
    }
    return passives.find(p => p.type === 'wild_magic_tamed');
}

export function getFeatsOfChaosFeature(playerStats) {
    const passives = playerStats?.automation?.passives;
    if (passives == null) {
        console.error('[wildMagicSurgeService] Missing array:', passives);
        throw new Error('Expected array, got ' + passives);
    }
    return passives.find(p => p.type === 'feats_of_chaos' && p.condition === 'feats_of_chaos_active');
}

async function executeWildMagicSurgeAction(surgeFeature, playerStats, campaignName, mapName, { autoSurge, markOnce }) {
    const surgeTable = playerStats.wildMagicSurgeTable;
    if (surgeTable == null) {
        console.error('[wildMagicSurgeService] Missing array:', surgeTable);
        throw new Error('Expected array, got ' + surgeTable);
    }

    const action = {
        name: surgeFeature.name,
        automation: {
            type: 'wild_magic_surge',
            trigger: 'after_sorcerer_spell_slot',
            oncePerTurn: surgeFeature.oncePerTurn || false,
            ...(autoSurge ? { autoSurge: true } : {}),
        },
        wildMagicSurgeTable: surgeTable,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        if (result && markOnce) {
            await markOncePerTurn('Wild Magic Surge', 'surgeUsedRound', playerStats, campaignName);
        }
        return result || null;
    } catch (e) {
        console.error(`[wildMagicSurge] Failed to execute surge for ${surgeFeature.name}:`, e);
        throw e;
    }
}

export async function triggerWildMagicSurge(spell, metaCtx, playerStats, campaignName, mapName) {
    if (!playerStats) return null;
    if (!isSorcererSpell(spell, playerStats)) return null;
    if (!usesSpellSlot(spell, metaCtx)) return null;

    const surgeFeatures = getWildMagicSurgeFeatures(playerStats);
    if (surgeFeatures.length === 0) return null;

    const controlledChaos = getControlledChaosFeature(playerStats);
    if (controlledChaos) {
        await setRuntimeValue(playerStats.name, 'wildMagicDoubleRoll', true, campaignName, true);
    }

    const featsOfChaos = getFeatsOfChaosFeature(playerStats);
    const featsOfChaosActive = getRuntimeValue(playerStats.name, 'featsOfChaosActive', campaignName) === true;
    const surgeFeature = surgeFeatures[0];

    if (featsOfChaos && featsOfChaosActive) {
        await setRuntimeValue(playerStats.name, 'featsOfChaosActive', false, campaignName, true);
        await setRuntimeValue(playerStats.name, 'featsOfChaosUses', 1, campaignName, true);
        return await executeWildMagicSurgeAction(surgeFeature, playerStats, campaignName, mapName, { autoSurge: true, markOnce: false });
    }

    const skip = await checkOncePerTurn('Wild Magic Surge', 'surgeUsedRound', playerStats.name, campaignName);
    if (skip) return null;

    return await executeWildMagicSurgeAction(surgeFeature, playerStats, campaignName, mapName, { autoSurge: false, markOnce: true });
}
