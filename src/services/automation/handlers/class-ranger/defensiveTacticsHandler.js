import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const CHOICES = ['Escape the Horde', 'Multiattack Defense'];

export async function handle(action, playerStats, campaignName) {
    const optionKey = `_${action.name.replace(/\s+/g, '_')}_choice`;
    const chosen = getRuntimeValue(playerStats.name, optionKey, campaignName);

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

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `<b>${chosen}</b> has been selected. This choice can be changed on a Short Rest or Long Rest.`,
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
            description: `Selected: <b>${choice}</b>. This choice can be changed on a Short Rest or Long Rest.`,
        },
    };
}
