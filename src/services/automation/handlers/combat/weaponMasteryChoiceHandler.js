import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const WEAPON_MASTER_KEY = '_Weapon_Master_chosenMastery';

export { WEAPON_MASTER_KEY };

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const masteryProperties = auto.masteryProperties || [];

    const existing = getRuntimeValue(playerStats.name, WEAPON_MASTER_KEY, campaignName);

    if (existing && masteryProperties.includes(existing)) {
        return handleMasterySelection(action, playerStats, campaignName, existing);
    }

    return {
        type: 'modal',
        modalName: 'weaponMasteryChoice',
        payload: {
            action,
            playerStats,
            campaignName,
            masteryProperties,
        },
    };
}

export async function applyMasterySelection(masteryName, playerStats, campaignName) {
    if (!masteryName) return null;

    setRuntimeValue(playerStats.name, WEAPON_MASTER_KEY, masteryName, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Weapon Master - Mastery Property',
        description: `Selected mastery property: ${masteryName}`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Weapon Master',
            description: `Mastery property set to: ${masteryName}. This will be applied to your next attack.`,
        },
    };
}

async function handleMasterySelection(action, playerStats, campaignName, chosenMastery) {
    setRuntimeValue(playerStats.name, WEAPON_MASTER_KEY, chosenMastery, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Weapon Master - Mastery Property',
        description: `Mastery property: ${chosenMastery} (previously selected)`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Weapon Master',
            description: `Mastery property: ${chosenMastery}`,
        },
    };
}
