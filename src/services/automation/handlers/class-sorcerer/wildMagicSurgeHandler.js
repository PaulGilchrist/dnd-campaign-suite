import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const surgeKey = `wildMagicSurgeUsed_${playerName}`;
    const oncePerTurn = auto.oncePerTurn !== false;

    if (oncePerTurn) {
        const lastUse = getRuntimeValue(playerName, surgeKey, campaignName);
        const now = Date.now();
        if (lastUse && now - lastUse < 60000) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} can only be used once per turn.`,
                    automation: auto,
                },
            };
        }
    }

    const roll1 = Math.floor(Math.random() * 20) + 1;
    const doubleRoll = getRuntimeValue(playerName, 'wildMagicDoubleRoll', campaignName) === true;
    const roll2 = doubleRoll ? Math.floor(Math.random() * 20) + 1 : null;

    if (doubleRoll) {
        await setRuntimeValue(playerName, 'wildMagicDoubleRoll', false, campaignName, true);
        if (oncePerTurn) {
            await setRuntimeValue(playerName, surgeKey, Date.now(), campaignName, true);
        }
        return {
            type: 'modal',
            modalName: 'wildMagicDoubleRoll',
            payload: {
                featureName: action.name,
                roll1,
                roll2,
                surgeTable: action.wildMagicSurgeTable || [],
                campaignName,
            },
        };
    }

    if (roll1 !== 20) {
        if (oncePerTurn) {
            await setRuntimeValue(playerName, surgeKey, Date.now(), campaignName, true);
        }
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

    await setRuntimeValue(playerName, surgeKey, Date.now(), campaignName, true);

    const surgeTable = action.wildMagicSurgeTable || [];
    if (!surgeTable || surgeTable.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: Rolled a 20! No Wild Magic Surge table data available.`,
                automation: auto,
            },
        };
    }

    const surgeEntry = surgeTable.find(e => roll1 >= e.min && roll1 <= e.max);
    if (!surgeEntry) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: Rolled a 20! No matching surge effect found.`,
                automation: auto,
            },
        };
    }

    const effectText = surgeEntry.effect;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} triggered Wild Magic Surge (rolled 20): ${effectText.substring(0, 120)}...`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[wildMagicSurge] Error:", e); throw e; });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `<b>${action.name}: SURGE! (Rolled ${roll1})</b><br/><br/>${effectText}`,
            automation: auto,
        },
    };
}

export async function handleTamedSurge(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const usesKey = 'tamedSurgeUses';
    const restKey = 'tamedSurgeLastRest';
    const storedUses = getRuntimeValue(playerName, usesKey, campaignName);
    const restTimestamp = getRuntimeValue(playerName, restKey, campaignName);
    const now = Date.now();

    let currentUses = 1;
    if (restTimestamp && now - restTimestamp < 86400000) {
        currentUses = Number(storedUses ?? 1);
    } else if (!restTimestamp) {
        currentUses = Number(storedUses ?? 1);
    }

    if (currentUses <= 0) {
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

    const surgeTable = action.wildMagicSurgeTable || [];
    if (!surgeTable || surgeTable.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No Wild Magic Surge table data available.`,
                automation: auto,
            },
        };
    }

    const availableEffects = surgeTable.filter(e => e.max < 20);

    return {
        type: 'modal',
        modalName: 'wildMagicTamed',
        payload: {
            featureName: action.name,
            availableSurges: availableEffects,
            playerStats,
            campaignName,
        },
    };
}

export async function onTamedSurgeSelected(action, playerStats, campaignName, selectedSurge) {
    const playerName = playerStats.name;
    const auto = action.automation;

    const usesKey = 'tamedSurgeUses';
    const restKey = 'tamedSurgeLastRest';
    const storedUses = getRuntimeValue(playerName, usesKey, campaignName);
    const restTimestamp = getRuntimeValue(playerName, restKey, campaignName);
    const now = Date.now();

    let currentUses = 1;
    if (restTimestamp && now - restTimestamp < 86400000) {
        currentUses = Number(storedUses ?? 1);
    } else if (!restTimestamp) {
        currentUses = Number(storedUses ?? 1);
    }

    if (currentUses <= 0) return null;

    const newUses = currentUses - 1;
    await setRuntimeValue(playerName, usesKey, newUses, campaignName, true);

    if (newUses <= 0) {
        await setRuntimeValue(playerName, restKey, now, campaignName, true);
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used Tamed Surge to select: ${selectedSurge.effect.substring(0, 120)}...`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[wildMagicSurge] Error:", e); throw e; });

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
    const restKey = 'featsOfChaosLastRest';
    const storedUses = getRuntimeValue(playerName, usesKey, campaignName);
    const restTimestamp = getRuntimeValue(playerName, restKey, campaignName);
    const now = Date.now();

    let currentUses = 1;
    if (restTimestamp && now - restTimestamp < 86400000) {
        currentUses = Number(storedUses ?? 1);
    } else if (!restTimestamp) {
        currentUses = Number(storedUses ?? 1);
    }

    if (currentUses <= 0) {
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

export async function onDoubleRollSelected(action, playerStats, campaignName, selectedRoll) {
    const playerName = playerStats.name;
    const auto = action.automation;

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

    const surgeKey = `wildMagicSurgeUsed_${playerName}`;
    await setRuntimeValue(playerName, surgeKey, Date.now(), campaignName, true);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.featureName,
        description: `${playerName} triggered Wild Magic Surge (rolled ${selectedRoll}): ${effectText.substring(0, 120)}...`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[wildMagicSurge] Error:", e); throw e; });

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

export async function onFeatsOfChaosActivate(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    await setRuntimeValue(playerName, 'featsOfChaosActive', true, campaignName, true);
    return { featsOfChaosActive: true };
}

export async function onFeatsOfChaosConsume(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const usesKey = 'featsOfChaosUses';
    const restKey = 'featsOfChaosLastRest';
    const storedUses = getRuntimeValue(playerName, usesKey, campaignName);
    const restTimestamp = getRuntimeValue(playerName, restKey, campaignName);
    const now = Date.now();

    let currentUses = 1;
    if (restTimestamp && now - restTimestamp < 86400000) {
        currentUses = Number(storedUses ?? 1);
    } else if (!restTimestamp) {
        currentUses = Number(storedUses ?? 1);
    }

    if (currentUses > 0) {
        const newUses = currentUses - 1;
        await setRuntimeValue(playerName, usesKey, newUses, campaignName, true);
        if (newUses <= 0) {
            await setRuntimeValue(playerName, restKey, now, campaignName, true);
        }
    }

    await setRuntimeValue(playerName, 'featsOfChaosActive', false, campaignName, true);

    return { featsOfChaosConsumed: true };
}
