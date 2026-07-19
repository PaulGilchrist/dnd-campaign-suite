import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const isHeightened = action.name === 'Heightened Step of the Wind';

    const cost = auto.cost?.amount || 1;
    const maxFocus = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.focus_points || 0;
    const currentFocus = Number(getRuntimeValue(playerName, 'focusPoints', campaignName) ?? maxFocus);

    if (currentFocus >= cost) {
        await setRuntimeValue(playerName, 'focusPoints', currentFocus - cost, campaignName);

        let description = `${playerName} used ${action.name}: Dash or Disengage as a bonus action. Your jump distance is doubled.`;
        if (isHeightened) {
            description += ' Moving a willing creature within 5 feet (Large or smaller) with you.';
        }
        description += ` (${currentFocus - cost} Focus Points remaining).`;

        let logDesc = `${playerName} used ${action.name} to Dash or Disengage as a bonus action`;
        if (isHeightened) {
            logDesc += `, moving a willing creature within 5 feet (Large or smaller) with you`;
        }
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: logDesc,
        }).catch(() => {});

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: description,
                automation: auto,
            },
        };
    }
}
