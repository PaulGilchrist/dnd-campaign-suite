import { getCombatSummary } from '../../../encounters/combatData.js';
import { automationInfoPopup } from '../../../shared/popupResponse.js';

export async function handle(action, playerStats, _campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const concentrationSpell = auto.concentrationSpell || 'Telekinesis';

    // Check if concentration is maintained on the required spell
    const combatSummary = getCombatSummary();
    const creature = combatSummary?.creatures?.find(c => c.name === playerName);
    const hasConcentration = creature?.concentration &&
        creature.concentration.spell === concentrationSpell;

    if (!hasConcentration) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} requires Concentration on ${concentrationSpell} to use.`,
                automation: auto,
            },
        };
    }

    return automationInfoPopup(action);
}
