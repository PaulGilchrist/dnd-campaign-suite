import { setChosenRuntimeValue, getChosenRuntimeValue } from '../../common/choiceStorage.js';
import { addEntry } from '../../../ui/logService.js';
import { handle as handleFiendishResilience, applyTypeChoice as applyFiendishResilience } from '../class-warlock/fiendishResilienceHandler.js';

const DAMAGE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'];

export async function handle(action, playerStats, campaignName, _mapName) {
    const name = action.name;
    const damageTypes = action.damageTypes || action.automation?.damageTypes || DAMAGE_TYPES;

    // Fiendish Resilience has its own handler with long rest tracking
    if (name === 'Fiendish Resilience') {
        return handleFiendishResilience(action, playerStats, campaignName, _mapName);
    }

    // Check if a damage type has already been chosen
    const chosenType = getChosenRuntimeValue(playerStats, name, 'chosenType', campaignName);

    if (chosenType) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: name,
            description: `${name} — damage type is ${chosenType}`,
        }).catch(() => {});

        return {
            type: 'modal',
            modalName: 'elementalAffinity',
            payload: {
                action,
                playerStats,
                campaignName,
                damageTypes,
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
            damageTypes,
        },
    };
}

export async function applyTypeChoice(action, playerStats, campaignName, chosenType) {
    const name = action.name;

    // Fiendish Resilience has its own handler with long rest tracking
    if (name === 'Fiendish Resilience') {
        return applyFiendishResilience(action, playerStats, campaignName, chosenType);
    }

    const validTypes = action.damageTypes || action.automation?.damageTypes || DAMAGE_TYPES;

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
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            automationType: action.type,
            description: `${name}: ${chosenType} selected. You gain resistance to ${chosenType} damage. When you cast a spell that deals ${chosenType} damage, add your Charisma modifier.`,
            automation: action,
        },
    };
}
