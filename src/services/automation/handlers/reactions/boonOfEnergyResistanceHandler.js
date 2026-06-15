import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const ENERGY_TYPES = [
    'Acid', 'Cold', 'Fire', 'Lightning', 'Necrotic',
    'Poison', 'Psychic', 'Radiant', 'Thunder'
];

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const name = action.name;

    const typesKey = `_${name.replace(/\s+/g, '_')}_chosenTypes`;
    const chosenTypes = getRuntimeValue(playerStats.name, typesKey, campaignName);

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

    const typesKey = `_${name.replace(/\s+/g, '_')}_chosenTypes`;
    const existingTypes = getRuntimeValue(playerStats.name, typesKey, campaignName);
    const isChange = existingTypes && existingTypes.length > 0 && JSON.stringify(existingTypes.sort()) !== JSON.stringify([...filtered].sort());

    await setRuntimeValue(playerStats.name, typesKey, filtered, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: name,
        description: `${name} — damage types ${isChange ? 'changed to' : 'set to'} ${filtered.join(', ')}`,
    }).catch(() => { });

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
