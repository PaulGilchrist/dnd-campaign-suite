import { setChosenRuntimeValue, getChosenRuntimeValue } from '../../common/choiceStorage.js';
import { addEntry } from '../../../ui/logService.js';

const ENERGY_TYPES = [
    'Acid', 'Cold', 'Fire', 'Lightning', 'Necrotic',
    'Poison', 'Psychic', 'Radiant', 'Thunder'
];

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const name = action.name;

    const chosenTypes = getChosenRuntimeValue(playerStats, name, 'chosenTypes', campaignName);

    const validTypes = auto.validTypes || ENERGY_TYPES;
    const maxSelections = auto.count || 2;

    if (chosenTypes && chosenTypes.length > 0) {
        return {
            type: 'modal',
            modalName: 'boonOfEnergyResistance',
            payload: {
                action,
                playerStats,
                campaignName,
                damageTypes: validTypes,
                existingTypes: chosenTypes,
                maxSelections,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'boonOfEnergyResistance',
        payload: {
            action,
            playerStats,
            campaignName,
            damageTypes: validTypes,
            maxSelections,
        },
    };
}

export async function applyTypeChoice(action, playerStats, campaignName, chosenTypes) {
    const auto = action.automation;
    const name = action.name;
    const validTypes = auto.validTypes || ENERGY_TYPES;

    const filtered = chosenTypes.filter(t => validTypes.includes(t));
    if (filtered.length === 0) {
        return null;
    }

    const existingTypes = getChosenRuntimeValue(playerStats, name, 'chosenTypes', campaignName);
    const isChange = existingTypes && existingTypes.length > 0 && JSON.stringify(existingTypes.sort()) !== JSON.stringify([...filtered].sort());

    await setChosenRuntimeValue(playerStats, name, filtered, 'chosenTypes', campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: name,
        description: `${name} — damage types ${isChange ? 'changed to' : 'set to'} ${filtered.join(', ')}`,
    }).catch(e => {
                        console.error(`[automation] Failed to log entry:`, e);
                        throw e;
    })

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            automationType: auto.type,
            description: `${name}: ${filtered.join(', ')} selected. You gain resistance to these damage types.`,
            automation: auto,
        },
    };
}
