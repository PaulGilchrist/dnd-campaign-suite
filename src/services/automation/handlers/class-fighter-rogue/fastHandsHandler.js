import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const options = auto.options || [];

    if (options.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no options available.`,
                automation: auto,
            },
        };
    }

    // Check once-per-turn usage
    if (auto.oncePerTurn) {
        const currentRound = getCurrentCombatRound();
        const usedRound = getRuntimeValue(playerStats.name, '_FastHands_usedRound', campaignName);
        if (usedRound === currentRound) {
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

    return {
        type: 'modal',
        modalName: 'bonusActionChoice',
        payload: {
            action,
            options,
        },
    };
}

export function applyFastHands(action, playerStats, campaignName, chosenOption) {
    const auto = action.automation;
    const option = auto.options?.find(o => o.name === chosenOption);
    if (!option) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Unknown option: ${chosenOption}`,
                automation: auto,
            },
        };
    }

    // Track once-per-turn usage
    if (auto.oncePerTurn) {
        const currentRound = getCurrentCombatRound();
        setRuntimeValue(playerStats.name, '_FastHands_usedRound', currentRound, campaignName, true);
    }

    let description;
    switch (chosenOption) {
        case 'Sleight of Hand':
            description = `You use Fast Hands to make a Dexterity (Sleight of Hand) check — pick pocket, palming a small object, hiding a small item, etc.`;
            break;
        case 'Thieves\' Tools':
            description = `You use Fast Hands to use thieves' tools to pick a lock or disarm a trap.`;
            break;
        case 'Use an Object':
            description = `You use Fast Hands to use an object. Using a magic item that requires an action uses the Utilize action. Normal objects use the standard Action.`;
            break;
        default:
            description = `${action.name}: ${option.description}`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${chosenOption} selected: ${description}`,
            automation: auto,
        },
    };
}
