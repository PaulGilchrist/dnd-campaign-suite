import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { getCurrentCombatRound } from '../../../services/encounters/combatData.js';

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
        const usedRound = getRuntimeValue(playerStats.name, '_CunningAction_usedRound', campaignName);
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

    // Present choice modal
    return {
        type: 'modal',
        modalName: 'bonusActionChoice',
        payload: {
            action,
            options,
        },
    };
}

export function applyBonusActionChoice(action, playerStats, campaignName, chosenOption) {
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
        setRuntimeValue(playerStats.name, '_CunningAction_usedRound', currentRound, campaignName, true);
    }

    // Apply the chosen effect
    let description = '';
    switch (chosenOption) {
        case 'Dash':
            description = `You take the Dash bonus action. Your movement speed is doubled until the end of the turn.`;
            break;
        case 'Disengage':
            description = `You take the Disengage bonus action. Your movement doesn't provoke opportunity attacks until the end of the turn.`;
            break;
        case 'Hide':
            description = `You attempt to Hide. Make a Dexterity (Stealth) check to try to become hidden from creatures until the end of the turn.`;
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
