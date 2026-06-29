import { getCombatSummary } from '../../../encounters/combatData.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import storage from '../../../ui/storage.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const concentrationSpell = auto.concentrationSpell || 'Telekinesis';
    const dc = auto.dc || 10;

    const combatSummary = getCombatSummary(campaignName);
    const creature = combatSummary?.creatures?.find(c => c.name === playerName);
    const wasConcentrating = creature?.concentration &&
        creature.concentration.spell === concentrationSpell;

    if (!wasConcentrating) {
        if (combatSummary) {
            addConcentration(combatSummary, playerName, concentrationSpell, dc);
            storage.set('combatSummary', combatSummary, campaignName);
            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        }

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} activated ${action.name}, concentrating on ${concentrationSpell}. Each turn while concentrating, can make a weapon attack as a Bonus Action.`,
        }).catch(() => {});
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: Concentrating on <strong>${concentrationSpell}</strong>. Each turn while concentrating, can make a weapon attack as a Bonus Action.`,
            automation: auto,
        },
    };
}
