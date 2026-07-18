import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { checkOncePerTurn, markOncePerTurn } from '../../common/oncePerTurn.js';

const SURGE_EFFECTS_KEY = 'wildMagicSurgeEffects';

async function getSurgeEffects(playerName, campaignName) {
    const effects = getRuntimeValue(playerName, SURGE_EFFECTS_KEY, campaignName);
    return Array.isArray(effects) ? effects : [];
}

async function setSurgeEffects(playerName, campaignName, effects) {
    await setRuntimeValue(playerName, SURGE_EFFECTS_KEY, effects, campaignName, true);
}

async function addSurgeEffect(playerName, campaignName, surgeEntry) {
    const effects = await getSurgeEffects(playerName, campaignName);
    const newEffects = [...effects, surgeEntry];
    await setSurgeEffects(playerName, campaignName, newEffects);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    if (!auto?.autoSurge) {
        const skip = await checkOncePerTurn(action.name, 'surgeUsedRound', campaignName);
        if (skip) return skip;
    }

    const activeEffects = await getSurgeEffects(playerName, campaignName);
    const hasRollOnTableEffect = activeEffects.some(e => e && e.effect && e.effect.includes('Roll on the surge table at the start of each turn'));

    const d20Roll = Math.floor(Math.random() * 20) + 1;
    const doubleRoll = getRuntimeValue(playerName, 'wildMagicDoubleRoll', campaignName) === true ||
        (playerStats.automation?.passives ?? []).some(p => p.type === 'auto_effect' && p.effect === 'wild_magic_double_roll');

    if (doubleRoll) {
        await setRuntimeValue(playerName, 'wildMagicDoubleRoll', false, campaignName, true);
        if (!auto?.autoSurge) {
            await markOncePerTurn(action.name, 'surgeUsedRound', playerStats, campaignName);
        }
        return {
            type: 'modal',
            modalName: 'wildMagicSurge',
            payload: {
                featureName: action.name,
            surgeTable: playerStats.wildMagicSurgeTable || [],
                campaignName,
                playerStats,
                mode: 'controlledChaos',
                roll1: Math.floor(Math.random() * 100) + 1,
                roll2: Math.floor(Math.random() * 100) + 1,
            },
        };
    }

    if (!auto?.autoSurge && !hasRollOnTableEffect && d20Roll !== 20) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: Rolled ${d20Roll} (not a 20). No surge occurs.`,
                automation: auto,
            },
        };
    }

    if (!auto?.autoSurge) {
        await markOncePerTurn(action.name, 'surgeUsedRound', playerStats, campaignName);
    }

    return {
        type: 'modal',
        modalName: 'wildMagicSurge',
        payload: {
            featureName: action.name,
            surgeTable: playerStats.wildMagicSurgeTable || [],
            campaignName,
            playerStats,
            mode: 'roll',
            roll: Math.floor(Math.random() * 100) + 1,
        },
    };
}

export async function handleTamedSurge(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const usesKey = 'tamedSurgeUses';
    const currentUses = getRuntimeValue(playerName, usesKey);
    const normalizedUses = currentUses === null || currentUses === undefined ? 1 : Number(currentUses);

    if (normalizedUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no uses remaining. Recharges after a Long Rest.`,
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'wildMagicSurge',
        payload: {
            featureName: action.name,
            surgeTable: playerStats.wildMagicSurgeTable || [],
            campaignName,
            playerStats,
            mode: 'tamedSurge',
        },
    };
}

export async function onSurgeSelected(featureName, playerStats, campaignName, selectedRoll, surgeEntry) {
    const playerName = playerStats.name;
    const auto = featureName ? { type: 'wild_magic_surge' } : { type: 'wild_magic_surge' };

    const existingEffects = await getSurgeEffects(playerName, campaignName);
    const alreadyApplied = existingEffects.some(e => e.roll === selectedRoll && e.effect === surgeEntry.effect);
    if (alreadyApplied) {
        return null;
    }

    const surgeEffect = {
        roll: selectedRoll,
        effect: surgeEntry.effect,
        duration: surgeEntry.duration || null,
        timestamp: Date.now(),
    };
    await addSurgeEffect(playerName, campaignName, surgeEffect);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} triggered Wild Magic Surge (${selectedRoll}): ${surgeEntry.effect}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[wildMagicSurge] Error logging surge:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `<b>${featureName}: SURGE! (Rolled ${selectedRoll})</b><br/><br/>${surgeEntry.effect}`,
            automation: auto,
        },
    };
}

export async function onDoubleRollSelected(action, playerStats, campaignName, selectedRoll) {
    const playerName = playerStats.name;
    const auto = action.automation || { type: 'wild_magic_surge' };

    await setRuntimeValue(playerName, 'wildMagicDoubleRoll', false, campaignName, true);

    const surgeTable = action.surgeTable || [];
    if (!surgeTable || surgeTable.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.featureName,
                description: `${action.featureName}: No Wild Magic Surge table data available.`,
                automation: auto,
            },
        };
    }

    const surgeEntry = surgeTable.find(e => selectedRoll >= e.min && selectedRoll <= e.max);
    if (!surgeEntry) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.featureName,
                description: `${action.featureName}: Selected roll ${selectedRoll} has no matching surge effect.`,
                automation: auto,
            },
        };
    }

    const effectText = surgeEntry.effect;

    await markOncePerTurn(action.name, 'surgeUsedRound', playerStats, campaignName);

    const surgeEffect = {
        roll: selectedRoll,
        effect: effectText,
        duration: surgeEntry.duration || null,
        timestamp: Date.now(),
    };
    await addSurgeEffect(playerName, campaignName, surgeEffect);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.featureName,
        description: `${playerName} triggered Wild Magic Surge (rolled ${selectedRoll}): ${effectText.substring(0, 120)}...`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[wildMagicSurge] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.featureName,
            description: `<b>${action.featureName}: SURGE! (Rolled ${selectedRoll})</b><br/><br/>${effectText}`,
            automation: auto,
        },
    };
}

export async function onTamedSurgeSelected(action, playerStats, campaignName, selectedSurge) {
    const playerName = playerStats.name;
    const auto = action.automation || { type: 'wild_magic_tamed' };

    const usesKey = 'tamedSurgeUses';
    const currentUses = getRuntimeValue(playerName, usesKey);
    const normalizedUses = currentUses === null || currentUses === undefined ? 1 : Number(currentUses);

    if (normalizedUses <= 0) return null;

    const newUses = normalizedUses - 1;

    const surgeEffect = {
        roll: 'tamed',
        effect: selectedSurge.effect,
        duration: selectedSurge.duration || null,
        timestamp: Date.now(),
    };
    await addSurgeEffect(playerName, campaignName, surgeEffect);

    await setRuntimeValue(playerName, usesKey, newUses, campaignName, true);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used Tamed Surge to select: ${selectedSurge.effect.substring(0, 120)}...`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[wildMagicSurge] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `<b>${action.name}: Tamed Surge!</b><br/><br/>${selectedSurge.effect}`,
            automation: auto,
        },
    };
}

export async function handleFeatsOfChaos(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const usesKey = 'featsOfChaosUses';
    const currentUses = getRuntimeValue(playerName, usesKey);
    const normalizedUses = currentUses === null || currentUses === undefined ? 1 : Number(currentUses);

    if (normalizedUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no uses remaining. Must cast Sorcerer spell with spell slot or finish Long Rest to recharge.`,
                automation: auto,
            },
        };
    }

    const newUses = normalizedUses - 1;
    await setRuntimeValue(playerName, usesKey, newUses, campaignName, true);
    await setRuntimeValue(playerName, 'featsOfChaosActive', true, campaignName, true);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated Feats of Chaos: Advantage on next D20 test.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[FeatsOfChaos] Error logging:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `<b>Advantage on next D20 test.</b><br/>Next Sorcerer spell cast with spell slot will trigger a Wild Magic Surge and recharge this feature.`,
            automation: auto,
        },
    };
}

export async function onFeatsOfChaosConsume(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const usesKey = 'featsOfChaosUses';
    const currentUses = Number(getRuntimeValue(playerName, usesKey) ?? 0);

    if (currentUses > 0) {
        const newUses = currentUses - 1;
        await setRuntimeValue(playerName, usesKey, newUses, campaignName, true);
    }

    await setRuntimeValue(playerName, 'featsOfChaosActive', false, campaignName, true);

    return { featsOfChaosConsumed: true };
}
