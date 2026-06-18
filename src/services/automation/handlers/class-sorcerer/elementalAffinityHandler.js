import { setChosenRuntimeValue, getChosenRuntimeValue } from '../../common/choiceStorage.js';
import { addEntry } from '../../../ui/logService.js';

const DAMAGE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'];

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const name = action.name;

    // Check if a damage type has already been chosen
    const chosenType = getChosenRuntimeValue(playerStats, name, 'chosenType', campaignName);

    if (chosenType) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: name,
            description: `${name} — damage type is ${chosenType}`,
        }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

        return {
            type: 'modal',
            modalName: 'elementalAffinity',
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
        modalName: 'elementalAffinity',
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

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: name,
        description: `${name} — damage type ${isChange ? 'changed to' : 'set to'} ${chosenType}`,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            automationType: auto.type,
            description: `${name}: ${chosenType} selected. You gain resistance to ${chosenType} damage. When you cast a spell that deals ${chosenType} damage, add your Charisma modifier to one damage roll.`,
            automation: auto,
        },
    };
}
