import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const CHOICES = ['Escape the Horde', 'Multiattack Defense'];

export async function handle(action, playerStats, campaignName) {
    const optionKey = `_${action.name.replace(/\s+/g, '_')}_choice`;
    const chosen = getRuntimeValue(playerStats.name, optionKey, campaignName);

    // No choice yet — show the modal
    if (!chosen) {
        return {
            type: 'modal',
            modalName: 'defensiveTactics',
            payload: {
                action,
                playerStats,
                campaignName,
            },
        };
    }

    // Choice already made — show info popup
    const description = chosen === 'Escape the Horde'
        ? 'Escape the Horde active: Opportunity Attacks have Disadvantage against you.'
        : 'Multiattack Defense active: When a creature hits you with an attack roll, that creature has Disadvantage on all other attack rolls against you this turn.';

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

    const optionKey = `_${'Defensive Tactics'.replace(/\s+/g, '_')}_choice`;
    await setRuntimeValue(playerStats.name, optionKey, choice, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: "Defensive Tactics",
        description: `Defensive Tactics choice: ${choice}`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: "Defensive Tactics",
            description: `Selected: <b>${choice}</b>. This choice can be changed on a Short or Long Rest.`,
        },
    };
}
