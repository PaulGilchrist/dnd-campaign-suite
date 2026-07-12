import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

const SANCTUARY_KEY = 'naturesSanctuaryActive';
const SANCTUARY_RANGE_KEY = 'naturesSanctuaryRange';
const SANCTUARY_RESISTANCE_KEY = 'naturesSanctuaryResistance';
const SANCTUARY_CREATURES_KEY = 'naturesSanctuaryCreatures';

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

    // Resolve the druid's land-based resistance for sanctuary
    const classData = playerStats.class || {};
    const landType = (classData.major?.type || classData.subclass?.type || '').toLowerCase().trim();
    const landMappings = { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' };
    const resistanceType = landMappings[landType] || null;
    if (resistanceType) {
        await setRuntimeValue(playerName, SANCTUARY_RESISTANCE_KEY, resistanceType, campaignName);
    }

    // Get all creatures from combat context
    const combatSummary = await getCombatContext(campaignName);
    const creatureTargets = combatSummary?.creatures
        ? combatSummary.creatures
            .map(c => ({ name: c.name, type: c.type, currentHp: c.currentHp, maxHp: c.maxHp, size: c.size }))
        : [];

    // Set up expiration for 1 minute (10 rounds)
    addExpiration(playerName, playerName, [
        { type: 'remove_natures_sanctuary' }
    ], campaignName);

    return {
        type: 'modal',
        modalName: 'naturesSanctuaryCreatures',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            isMove: false,
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

    // Get existing creature list
    const existingCreatures = getRuntimeValue(playerName, SANCTUARY_CREATURES_KEY, campaignName) || [];

    // Get all creatures from combat context
    const combatSummary = await getCombatContext(campaignName);
    const creatureTargets = combatSummary?.creatures
        ? combatSummary.creatures
            .map(c => ({ name: c.name, type: c.type, currentHp: c.currentHp, maxHp: c.maxHp, size: c.size }))
        : [];

    return {
        type: 'modal',
        modalName: 'naturesSanctuaryCreatures',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            defaultSelected: existingCreatures,
            isMove: true,
        },
    };
}

export async function activateNaturesSanctuary(action, playerStats, campaignName, mapName, targetNames) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Expend 1 Wild Shape use
    const maxWS = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.wild_shape || 0;
    const currentWS = Number(getRuntimeValue(playerName, 'wildShapeUses', campaignName) ?? maxWS);
    await setRuntimeValue(playerName, 'wildShapeUses', currentWS - 1, campaignName);

    // Activate the sanctuary and store creature list
    const finalTargets = targetNames || [];
    await setRuntimeValue(playerName, SANCTUARY_KEY, true, campaignName);
    await setRuntimeValue(playerName, SANCTUARY_CREATURES_KEY, finalTargets, campaignName);

    // Initialize cube position to player's current map position if on a map
    const rangeFt = rangeToFeet(auto.range || '120_ft') || 120;
    await setRuntimeValue(playerName, SANCTUARY_RANGE_KEY, rangeFt, campaignName);

    // Log the ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated Nature's Sanctuary, covering ${finalTargets.length} creature(s): ${finalTargets.join(', ') || 'none'}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[naturesSanctuary] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated! Spectral trees and vines appear in a 15-foot cube within 120 feet. ${finalTargets.length} creature(s) have Half Cover and resistance to ${getRuntimeValue(playerName, SANCTUARY_RESISTANCE_KEY, campaignName) || 'your land choice'}. Lasts 1 minute. As a Bonus Action, you can move the cube up to 60 feet.`,
            automation: auto,
        },
    };
}

export async function moveNaturesSanctuary(action, playerStats, campaignName, targetNames) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const finalTargets = targetNames || [];
    const existingCreatures = getRuntimeValue(playerName, SANCTUARY_CREATURES_KEY, campaignName) || [];

    // Compute delta
    const added = finalTargets.filter(name => !existingCreatures.includes(name));
    const removed = existingCreatures.filter(name => !finalTargets.includes(name));

    // Update creature list
    await setRuntimeValue(playerName, SANCTUARY_CREATURES_KEY, finalTargets, campaignName);

    // Log the move with delta detail
    const moveRange = auto.moveRange || 60;

    let logDescription = `${playerName} moved Nature's Sanctuary up to ${moveRange} feet.`;
    if (added.length > 0) logDescription += ` Added: ${added.join(', ')}.`;
    if (removed.length > 0) logDescription += ` Removed: ${removed.join(', ')}.`;
    if (added.length === 0 && removed.length === 0) logDescription += ' No creatures added or removed.';

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: logDescription,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[naturesSanctuaryMove] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} moved the sanctuary up to ${moveRange} feet. ${finalTargets.length} creature(s) covered.`,
            automation: auto,
        },
    };
}
