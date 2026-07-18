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

    if (featsOfChaos && featsOfChaosActive) {
        const usesKey = 'featsOfChaosUses';
        await setRuntimeValue(playerStats.name, 'featsOfChaosActive', false, campaignName, true);
        await setRuntimeValue(playerStats.name, usesKey, 1, campaignName, true);

        const surgeFeature = surgeFeatures[0];
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
                autoSurge: true,
            },
            wildMagicSurgeTable: surgeTable,
        };

        try {
            const result = await executeHandler(action, playerStats, campaignName, mapName);
            if (result) {
                return result;
            }
        } catch (e) {
            console.error(`[wildMagicSurge] Failed to execute surge for ${surgeFeature.name}:`, e);
            throw e;
        }

        return null;
    }

    const surgeFeature = surgeFeatures[0];
    const skip = await checkOncePerTurn('Wild Magic Surge', 'surgeUsedRound', campaignName);
    if (skip) return null;

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
        },
        wildMagicSurgeTable: surgeTable,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        if (result) {
            await markOncePerTurn('Wild Magic Surge', 'surgeUsedRound', playerStats, campaignName);
            return result;
        }
    } catch (e) {
        console.error(`[wildMagicSurge] Failed to execute surge for ${surgeFeature.name}:`, e);
        throw e;
    }

    return null;
}
