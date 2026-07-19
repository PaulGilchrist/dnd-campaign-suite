import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const RESISTANCE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];

export async function handle(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const attunementActive = getRuntimeValue(playerName, 'elementalAttunementActive', campaignName);

    if (!attunementActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: action.automation?.type,
                description: 'Elemental Attunement must be active to use Elemental Epitome.',
                automation: action.automation,
            },
        };
    }

    const currentResistance = getRuntimeValue(playerName, 'epitomeResistanceType', campaignName);

    await setRuntimeValue(playerName, 'elementalEpitomeActive', true, campaignName);

    return {
        type: 'modal',
        modalName: 'elementalEpitome',
        payload: { action, playerStats, campaignName, currentResistance },
    };
}

export async function applyResistanceChoice(action, playerStats, campaignName, chosenType) {
    const chosen = RESISTANCE_TYPES.find(t => t === chosenType);
    if (!chosen) return null;

    const existingBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(existingBuffs) ? [...existingBuffs] : [];
    const epitomeIndex = activeBuffs.findIndex(b => b.name === 'Elemental Epitome');

    if (epitomeIndex !== -1) {
        activeBuffs[epitomeIndex] = {
            name: 'Elemental Epitome',
            effect: 'epitome_resistance',
            damageType: chosen,
        };
    } else {
        activeBuffs.push({
            name: 'Elemental Epitome',
            effect: 'epitome_resistance',
            damageType: chosen,
        });
    }

    await setRuntimeValue(playerStats.name, 'activeBuffs', activeBuffs, campaignName);
    await setRuntimeValue(playerStats.name, 'epitomeResistanceType', chosen, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `Elemental Epitome — Damage Resistance set to ${chosen}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[ElementalEpitome] Error logging:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type,
            description: `Damage Resistance set to ${chosen}.`,
            automation: action.automation,
        },
    };
}
