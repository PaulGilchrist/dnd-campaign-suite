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

function hasTamedSurgeUses(playerStats, campaignName) {
    const currentUses = getRuntimeValue(playerStats.name, 'tamedSurgeUses', campaignName);
    const normalizedUses = currentUses === null || currentUses === undefined ? 1 : Number(currentUses);
    return normalizedUses > 0;
}

// CLA-354: the chooser lists surgeTable rows minus the final wish row
// (WildMagicSurgeModal.slice(0, -1)) — no selectable rows = nothing to offer.
function hasTamedSurgeChoices(playerStats) {
    const surgeTable = playerStats.wildMagicSurgeTable || [];
    return surgeTable.slice(0, -1).length > 0;
}

// CLA-354: Tamed Surge (Wild Magic lv18) — "Immediately after casting Sorcerer spell
// with spell slot, create effect of your choice ... instead of rolling." The post-cast
// seam must offer the tamed chooser INSTEAD of the random d100 roll lane. Rides the
// same modal/result pipeline as the roll lane (executeHandler → wild_magic_tamed →
// handleTamedSurge → WildMagicSurgeModal → onTamedSurgeSelected spends uses + logs).
export async function triggerWildMagicSurge(spell, metaCtx, playerStats, campaignName, mapName) {
    if (!playerStats) return null;
    if (!isSorcererSpell(spell, playerStats)) return null;
    if (!usesSpellSlot(spell, metaCtx)) return null;

    const tamedFeature = getTamedSurgeFeature(playerStats);
    if (tamedFeature && hasTamedSurgeUses(playerStats, campaignName) && hasTamedSurgeChoices(playerStats)) {
        return await executeHandler({ name: tamedFeature.name, automation: { ...tamedFeature } }, playerStats, campaignName, mapName);
    }

    const surgeFeatures = getWildMagicSurgeFeatures(playerStats);
    if (surgeFeatures.length === 0) return null;

    const controlledChaos = getControlledChaosFeature(playerStats);
    if (controlledChaos) {
        await setRuntimeValue(playerStats.name, 'wildMagicDoubleRoll', true, campaignName, true);
    }

    const featsOfChaos = getFeatsOfChaosFeature(playerStats);
    // CLA-134: an armed spell-attack cast consumes featsOfChaosActive at the
    // computeD20Roll roll seam BEFORE this post-cast clause runs — the
    // cast-time metaCtx stamp keeps the slot-cast re-arm + auto-surge clause
    // RAW-correct for attack-roll spells.
    const featsOfChaosActive = getRuntimeValue(playerStats.name, 'featsOfChaosActive', campaignName) === true || metaCtx?.featsOfChaosArmedAtCast === true;
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
