import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const CHOICES = ['Colossus Slayer', 'Horde Breaker'];

export async function handle(action, playerStats, campaignName) {
    const optionKey = `_${action.name.replace(/\s+/g, '_')}_choice`;
    const chosen = getRuntimeValue(playerStats.name, optionKey, campaignName);

    // No choice yet — show the modal
    if (!chosen) {
        return {
            type: 'modal',
            modalName: 'hunterPrey',
            payload: {
                action,
                playerStats,
                campaignName,
            },
        };
    }

    // Choice already made — show info popup
    const description = chosen === 'Colossus Slayer'
        ? 'Colossus Slayer active: When you hit a creature with a weapon attack, it takes an extra 1d8 damage if it is below its hit point maximum. Once per turn.'
        : 'Horde Breaker active: Once per turn, when you make a weapon attack, you can make another attack with the same weapon against a different creature within 5 feet of the original target and within range.';

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Selected: <b>${chosen}</b><br/><br/>${description}`,
            automation: action.automation,
        },
    };
}

export async function applyChoice(playerStats, campaignName, choice) {
    if (!CHOICES.includes(choice)) return null;

    const optionKey = `_${'Hunter\'s Prey'.replace(/\s+/g, '_')}_choice`;
    await setRuntimeValue(playerStats.name, optionKey, choice, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: "Hunter's Prey",
        description: `Hunter's Prey choice: ${choice}`,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: "Hunter's Prey",
            description: `Selected: <b>${choice}</b>. This choice can be changed on a Short or Long Rest.`,
        },
    };
}
