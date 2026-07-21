import { setChosenRuntimeValue, getChosenRuntimeValue } from '../../common/choiceStorage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const DAMAGE_TYPES = [
    'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning',
    'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant',
    'Slashing', 'Thunder'
];

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const name = action.name;

    const chosenType = getChosenRuntimeValue(playerStats, name, 'chosenType', campaignName);
    const hasUsedThisRest = getRuntimeValue(playerStats.name, '_fiendishResilienceUsed');

    if (hasUsedThisRest) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name,
                description: `${name} has already been used this long rest. Finish a long rest to use it again.`,
                automation: auto,
            },
        };
    }

    if (chosenType) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: name,
            description: `${name} — damage type is ${chosenType}`,
        }).catch(e => {
                            console.error(`[automation] Failed to log entry:`, e);
                            throw e;
        })

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

    const existingType = getChosenRuntimeValue(playerStats, name, 'chosenType', campaignName);
    const isChange = existingType && existingType !== chosenType;

    setChosenRuntimeValue(playerStats, name, chosenType, 'chosenType', campaignName);
    setRuntimeValue(playerStats.name, '_fiendishResilienceUsed', true, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: name,
        description: `${name} — damage type ${isChange ? 'changed to' : 'set to'} ${chosenType}`,
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
            description: `${name}: ${chosenType} selected. You gain resistance to ${chosenType} damage.`,
            automation: auto,
        },
    };
}
