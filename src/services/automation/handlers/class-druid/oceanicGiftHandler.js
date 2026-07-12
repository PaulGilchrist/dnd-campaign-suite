import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { loadCombatSummary } from '../../../encounters/combatData.js';

const OCEANIC_GIFT_ALLIES_KEY = 'oceanicGiftAllies';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const maxWS = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.wild_shape || 0;
    const currentWS = Number(getRuntimeValue(playerName, 'wildShapeUses', campaignName) ?? maxWS);
    const cost = auto?.doubleEmanation ? 2 : 1;

    if (currentWS < cost) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: Not enough Wild Shape uses remaining. ${cost} use${cost > 1 ? 's' : ''} required.`,
                automation: auto,
            },
        };
    }

    const wrathActive = getRuntimeValue(playerName, 'wrathOfTheSeaActive', campaignName);
    if (wrathActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: You already have Wrath of the Sea active.`,
                automation: auto,
            },
        };
    }

    const combatSummary = await loadCombatSummary(campaignName);
    const allyTargets = combatSummary?.creatures
        ? combatSummary.creatures.filter(c => c.name !== playerName && c.type === 'player')
        : [];

    const wisMod = playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus || 1;
    const prof = playerStats.proficiency || 0;
    const spellSaveDc = 8 + wisMod + prof;

    return {
        type: 'modal',
        modalName: 'oceanicGiftTarget',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets: allyTargets,
            spellSaveDc,
            wisMod,
            doubleEmanation: !!auto?.doubleEmanation,
            cost,
        },
    };
}

export async function confirmOceanicGift(action, playerStats, campaignName, selectedAllyName, spellSaveDc, wisMod, doubleEmanation) {
    const playerName = playerStats.name;
    const cost = doubleEmanation ? 2 : 1;

    await setRuntimeValue(playerName, 'wildShapeUses', Number(getRuntimeValue(playerName, 'wildShapeUses', campaignName) ?? 0) - cost, campaignName);

    if (selectedAllyName) {
        await setRuntimeValue(selectedAllyName, 'wrathOfTheSeaActive', true, campaignName);
        await setRuntimeValue(selectedAllyName, 'wrathOfTheSeaDc', spellSaveDc, campaignName);
        await setRuntimeValue(selectedAllyName, 'wrathOfTheSeaWisMod', wisMod, campaignName);
        await setRuntimeValue(selectedAllyName, 'wrathOfTheSeaSource', playerName, campaignName);

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} used ${action.name} to grant Wrath of the Sea to ${selectedAllyName}.`,
            timestamp: Date.now(),
        }).catch(() => {});
    }

    if (doubleEmanation) {
        await setRuntimeValue(playerName, 'wrathOfTheSeaActive', true, campaignName);

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} manifested Wrath of the Sea around both themselves and ${selectedAllyName}.`,
            timestamp: Date.now(),
        }).catch(() => {});
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type,
            description: selectedAllyName
                ? `${action.name} — Wrath of the Sea granted to ${selectedAllyName}. ${doubleEmanation ? 'You also gain the Emanation.' : ''}`
                : `${action.name} skipped.`,
            automation: action.automation,
        },
    };
}

export function clearOceanicGiftAllies(playerName, campaignName) {
    setRuntimeValue(playerName, OCEANIC_GIFT_ALLIES_KEY, null, campaignName);
}
