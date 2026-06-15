import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { addEntry } from '../../../ui/logService.js';
import * as mapsService from '../../../maps/mapsService.js';

const SANCTUARY_KEY = 'naturesSanctuaryActive';
const SANCTUARY_MOVES_KEY = 'naturesSanctuaryMoves';
const SANCTUARY_CUBE_X_KEY = 'naturesSanctuaryCubeX';
const SANCTUARY_CUBE_Y_KEY = 'naturesSanctuaryCubeY';
const SANCTUARY_RANGE_KEY = 'naturesSanctuaryRange';
const SANCTUARY_RESISTANCE_KEY = 'naturesSanctuaryResistance';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check Wild Shape uses remain
    const maxWS = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.wild_shape || 0;
    const currentWS = Number(getRuntimeValue(playerName, 'wildShapeUses', campaignName) ?? maxWS);
    if (currentWS <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No Wild Shape uses remaining.`,
                automation: auto,
            },
        };
    }

    // Check if sanctuary is already active
    const isActive = getRuntimeValue(playerName, SANCTUARY_KEY, campaignName);
    if (isActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} is already active. Use the Bonus Action version to move the cube.`,
                automation: auto,
            },
        };
    }

    // Expend 1 Wild Shape use
    await setRuntimeValue(playerName, 'wildShapeUses', currentWS - 1, campaignName);

    // Resolve the druid's land-based resistance for sanctuary
    const classData = playerStats.class || {};
    const landType = (classData.major?.type || classData.subclass?.type || '').toLowerCase().trim();
    const landMappings = { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' };
    const resistanceType = landMappings[landType] || null;
    if (resistanceType) {
        await setRuntimeValue(playerName, SANCTUARY_RESISTANCE_KEY, resistanceType, campaignName);
    }

    // Activate the sanctuary buff
    await setRuntimeValue(playerName, SANCTUARY_KEY, true, campaignName);

    // Initialize cube position to player's current map position if on a map
    const rangeFt = rangeToFeet(auto.range || '120_ft') || 120;
    if (_mapName) {
        try {
            const mapData = await mapsService.loadMapData(campaignName, _mapName);
            const playerOnMap = mapData?.players?.find(p => p.name === playerName);
            if (playerOnMap) {
                await setRuntimeValue(playerName, SANCTUARY_CUBE_X_KEY, playerOnMap.gridX, campaignName);
                await setRuntimeValue(playerName, SANCTUARY_CUBE_Y_KEY, playerOnMap.gridY, campaignName);
                await setRuntimeValue(playerName, SANCTUARY_RANGE_KEY, rangeFt, campaignName);
            }
        } catch { /* map unavailable, cube position uninitialized */ }
    }

    // Set up expiration for 1 minute (10 rounds)
    addExpiration(playerName, playerName, [
        { type: 'remove_natures_sanctuary' }
    ], campaignName, 10);

    // Log the ability use
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated Nature's Sanctuary.`,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated! Spectral trees and vines appear in a 15-foot cube within 120 feet. You and allies in the cube have Half Cover. Allies also gain your Nature's Ward resistance. Lasts 1 minute. As a Bonus Action, you can move the cube up to 60 feet.`,
            automation: auto,
        },
    };
}

export async function handleMove(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check sanctuary is active
    const isActive = getRuntimeValue(playerName, SANCTUARY_KEY, campaignName);
    if (!isActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} is not currently active.`,
                automation: auto,
            },
        };
    }

    // Check moves remaining
    const maxMoves = auto.movesPerDuration || 1;
    const currentMoves = Number(getRuntimeValue(playerName, SANCTUARY_MOVES_KEY, campaignName) ?? maxMoves);
    if (currentMoves <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no moves remaining. It will expire when its duration ends.`,
                automation: auto,
            },
        };
    }

    // Decrement moves and confirm
    await setRuntimeValue(playerName, SANCTUARY_MOVES_KEY, currentMoves - 1, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} moved the cube up to ${auto.moveRange || 60} feet. ${currentMoves - 1} move(s) remaining.`,
            automation: auto,
        },
    };
}
