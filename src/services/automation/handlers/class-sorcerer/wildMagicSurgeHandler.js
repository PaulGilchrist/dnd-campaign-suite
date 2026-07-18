import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { checkOncePerTurn, markOncePerTurn } from '../../common/oncePerTurn.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const skip = await checkOncePerTurn(action.name, 'surgeUsedRound', campaignName);
    if (skip) return skip;

    const roll1 = Math.floor(Math.random() * 20) + 1;
    const doubleRoll = getRuntimeValue(playerName, 'wildMagicDoubleRoll', campaignName) === true;

    if (doubleRoll) {
        await setRuntimeValue(playerName, 'wildMagicDoubleRoll', false, campaignName, true);
        await markOncePerTurn(action.name, 'surgeUsedRound', playerStats, campaignName);
        return {
            type: 'modal',
            modalName: 'wildMagicSurge',
            payload: {
                featureName: action.name,
            surgeTable: playerStats.wildMagicSurgeTable || [],
                campaignName,
                playerStats,
                mode: 'controlledChaos',
                roll1,
                roll2: Math.floor(Math.random() * 100) + 1,
            },
        };
    }

    if (roll1 !== 20) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: Rolled ${roll1} (not a 20). No surge occurs.`,
                automation: auto,
            },
        };
    }

    await markOncePerTurn(action.name, 'surgeUsedRound', playerStats, campaignName);

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

    const lastSurge = { roll: selectedRoll, effect: surgeEntry.effect, timestamp: Date.now() };
    await setRuntimeValue(playerName, 'lastWildMagicSurge', lastSurge, campaignName, true);

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
    const lastSurge = { roll: 'tamed', effect: selectedSurge.effect, timestamp: Date.now() };
    await setRuntimeValue(playerName, 'lastWildMagicSurge', lastSurge, campaignName, true);

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

export async function handleFeatsOfChaos(action, playerStats, _campaignName, _mapName) {
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
                description: `${action.name} has no uses remaining. Recharges after a Long Rest.`,
                automation: auto,
            },
        };
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `<b>${action.name}: Advantage on next D20 test.</b><br/>Next Sorcerer spell cast will trigger a Wild Magic Surge.`,
            automation: auto,
        },
    };
}

export async function onFeatsOfChaosActivate(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    await setRuntimeValue(playerName, 'featsOfChaosActive', true, campaignName, true);
    return { featsOfChaosActive: true };
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
