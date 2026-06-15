import { evaluateAutoExpression } from '../../../combat/automationService.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const reduction = evaluateAutoExpression(auto.reductionExpression, playerStats);
    const reductionDisplay = typeof reduction === 'number' ? String(reduction) : (reduction || auto.reductionExpression);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to reduce damage by ${reductionDisplay}.`,
    });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: Reduce damage by <strong>${reductionDisplay}</strong>.${auto.trigger ? ` Trigger: ${auto.trigger}.` : ''}`,
            automation: auto,
        },
    };
}
