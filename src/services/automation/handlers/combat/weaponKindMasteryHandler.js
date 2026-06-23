import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const WEAPON_KIND_KEY = '_Weapon_Kind_Mastery_chosenWeapons';

export { WEAPON_KIND_KEY };

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const meleeOnly = auto.meleeOnly || false;

    const existing = getRuntimeValue(playerStats.name, WEAPON_KIND_KEY, campaignName);

    if (existing && Array.isArray(existing) && existing.length > 0) {
        return handleExistingSelection(action, playerStats, campaignName, existing, meleeOnly);
    }

    return {
        type: 'modal',
        modalName: 'weaponKindMastery',
        payload: {
            action,
            playerStats,
            campaignName,
            meleeOnly,
        },
    };
}

export async function applySelections(weaponNames, playerStats, campaignName) {
    if (!weaponNames || !Array.isArray(weaponNames) || weaponNames.length === 0) {
        return null;
    }

    await setRuntimeValue(playerStats.name, WEAPON_KIND_KEY, weaponNames, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Weapon Mastery - Weapon Kinds',
        description: `Selected weapon kinds: ${weaponNames.join(', ')}`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Weapon Mastery',
            description: `Weapon kinds set to: ${weaponNames.join(', ')}. Mastery properties will be available when attacking with these weapons.`,
        },
    };
}

async function handleExistingSelection(action, playerStats, campaignName, existingWeapons, meleeOnly) {
    await setRuntimeValue(playerStats.name, WEAPON_KIND_KEY, existingWeapons, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Weapon Mastery - Weapon Kinds',
        description: `Weapon kinds: ${existingWeapons.join(', ')} (previously selected)`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Weapon Mastery',
            description: `Weapon kinds: ${existingWeapons.join(', ')}. Click to change selection.`,
        },
    };
}
