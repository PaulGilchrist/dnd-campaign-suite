import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getClassFeatures } from '../../../character/classFeatures.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const wasActive = activeBuffs.some(b => b.name === action.name);

    if (wasActive) {
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

        // Remove invisible condition
        const condStored = getRuntimeValue(playerName, 'activeConditions', campaignName) || [];
        const condArray = Array.isArray(condStored) ? condStored : [];
        const filteredConds = condArray.filter(c => String(c).toLowerCase() !== 'invisible');
        if (filteredConds.length !== condArray.length) {
            await setRuntimeValue(playerName, 'activeConditions', filteredConds, campaignName);
        }

        // Clear invisibility tracking key
        await setRuntimeValue(campaignName, `_activeInvisibility_${playerName}`, null, campaignName);

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} ended ${action.name}.`,
        }).catch(() => {});

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} ended`,
                automation: auto,
            },
        };
    }

    const maxFocus = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.focus_points
        || getClassFeatures(playerStats)?.maxFocusPoints || 0;
    const currentFocus = Number(getRuntimeValue(playerName, 'focusPoints', campaignName) ?? maxFocus);

    if (currentFocus < 3) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `Not enough Focus Points. Need 3, have ${currentFocus}.`,
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, 'focusPoints', currentFocus - 3, campaignName);

    // Set invisible condition
    const storedConditions = getRuntimeValue(playerName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    if (!conditions.some(c => String(c).toLowerCase() === 'invisible')) {
        await setRuntimeValue(playerName, 'activeConditions', [...conditions, 'invisible'], campaignName);
    }

    // Set invisibility tracking key (for endInvisibilityOnHostileAction)
    await setRuntimeValue(campaignName, `_activeInvisibility_${playerName}`, playerStats.name, campaignName);

    // Register initiative expiration (expires at start of player's next turn)
    addExpiration(playerName, playerName, [
        { type: 'condition', condition: 'invisible' }
    ], campaignName, undefined, playerName);

    // Log to campaign log
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated ${action.name}. You gain Invisibility, can move through occupied spaces, and Flurry of Blows costs no Focus Points.`,
    }).catch(() => {});

    const buff = {
        name: action.name,
        effect: 'cloak_of_shadows',
        duration: auto.duration || '1_minute',
        hasAutomation: true,
    };

    const newBuffs = [...activeBuffs, buff];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated. You gain Invisibility, can move through occupied spaces, and Flurry of Blows costs no Focus Points.`,
            automation: auto,
        },
    };
}
