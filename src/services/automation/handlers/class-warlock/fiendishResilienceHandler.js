import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const DAMAGE_TYPES = [
    'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning',
    'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant',
    'Slashing', 'Thunder'
];

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const name = action.name;

    const typeKey = `_${name.replace(/\s+/g, '_')}_chosenType`;
    const chosenType = getRuntimeValue(playerStats.name, typeKey, campaignName);

    if (chosenType) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: name,
            description: `${name} — damage type is ${chosenType}`,
        }).catch(() => { });

        return {
            type: 'modal',
            modalName: 'fiendishResilience',
            payload: {
                action,
                playerStats,
                campaignName,
                damageTypes: auto.damageTypes || DAMAGE_TYPES,
                existingType: chosenType,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'fiendishResilience',
        payload: {
            action,
            playerStats,
            campaignName,
            damageTypes: auto.damageTypes || DAMAGE_TYPES,
        },
    };
}

export async function applyTypeChoice(action, playerStats, campaignName, chosenType) {
    const auto = action.automation;
    const name = action.name;
    const validTypes = auto.damageTypes || DAMAGE_TYPES;

    if (!validTypes.includes(chosenType)) {
        return null;
    }

    const typeKey = `_${name.replace(/\s+/g, '_')}_chosenType`;
    const existingType = getRuntimeValue(playerStats.name, typeKey, campaignName);
    const isChange = existingType && existingType !== chosenType;

    setRuntimeValue(playerStats.name, typeKey, chosenType, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: name,
        description: `${name} — damage type ${isChange ? 'changed to' : 'set to'} ${chosenType}`,
    }).catch(() => { });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            automationType: auto.type,
            description: `${name}: ${chosenType} selected. You gain resistance to ${chosenType} damage.`,
            automation: auto,
        },
    };
}
