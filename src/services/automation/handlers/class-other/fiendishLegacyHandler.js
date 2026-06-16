import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const LEGACY_KEY = '_fiendishLegacySelection';
const LEGACY_CANTRIP_KEY = '_fiendishLegacyCantrip';
const LEGACY_LEVEL3_KEY = '_fiendishLegacyLevel3';
const LEGACY_LEVEL5_KEY = '_fiendishLegacyLevel5';
const LEGACY_ABILITY_KEY = '_fiendishLegacyAbility';

const FIENDISH_LEGACIES = [
    { name: 'Abyssal', description: 'Resistance to Poison damage + Poison Spray cantrip. Level 3: Ray of Sickness. Level 5: Hold Person.', spellcastingAbility: 'Charisma' },
    { name: 'Chthonic', description: 'Resistance to Necrotic damage + Chill Touch cantrip. Level 3: False Life. Level 5: Ray of Enfeeblement.', spellcastingAbility: 'Charisma' },
    { name: 'Infernal', description: 'Resistance to Fire damage + Fire Bolt cantrip. Level 3: Hellish Rebuke. Level 5: Darkness.', spellcastingAbility: 'Charisma' },
];

export async function handle(action, playerStats, campaignName, _mapName) {
    const storedLegacy = getRuntimeValue(playerStats.name, LEGACY_KEY, campaignName);
    if (storedLegacy) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Fiendish Legacy: ${storedLegacy} (already selected).`,
                automation: action.automation,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'fiendishLegacy',
        payload: {
            action,
            playerStats,
            campaignName,
        },
    };
}

export async function confirmFiendishLegacy(playerStats, chosenLegacy, campaignName) {
    const auto = {
        type: 'fiendish_legacy',
        options: FIENDISH_LEGACIES,
    };

    const legacyData = FIENDISH_LEGACIES.find(l => l.name === chosenLegacy);
    if (!legacyData) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Fiendish Legacy',
                description: 'No legacy selected.',
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerStats.name, LEGACY_KEY, chosenLegacy, campaignName);
    await setRuntimeValue(playerStats.name, LEGACY_ABILITY_KEY, legacyData.spellcastingAbility, campaignName);

    const cantripMap = {
        'Abyssal': 'Poison Spray',
        'Chthonic': 'Chill Touch',
        'Infernal': 'Fire Bolt',
    };
    const level3Map = {
        'Abyssal': 'Ray of Sickness',
        'Chthonic': 'False Life',
        'Infernal': 'Hellish Rebuke',
    };
    const level5Map = {
        'Abyssal': 'Hold Person',
        'Chthonic': 'Ray of Enfeeblement',
        'Infernal': 'Darkness',
    };

    await setRuntimeValue(playerStats.name, LEGACY_CANTRIP_KEY, cantripMap[chosenLegacy], campaignName);
    await setRuntimeValue(playerStats.name, LEGACY_LEVEL3_KEY, level3Map[chosenLegacy], campaignName);
    await setRuntimeValue(playerStats.name, LEGACY_LEVEL5_KEY, level5Map[chosenLegacy], campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Fiendish Legacy',
            description: `Selected ${chosenLegacy} legacy. Spellcasting ability: ${legacyData.spellcastingAbility}.`,
            automation: auto,
        },
    };
}

export function getFiendishLegacySelection(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LEGACY_KEY, campaignName);
}

export function getFiendishLegacyAbility(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LEGACY_ABILITY_KEY, campaignName);
}

export function getFiendishLegacyCantrip(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LEGACY_CANTRIP_KEY, campaignName);
}

export function getFiendishLegacyLevel3Spell(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LEGACY_LEVEL3_KEY, campaignName);
}

export function getFiendishLegacyLevel5Spell(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LEGACY_LEVEL5_KEY, campaignName);
}

export function restoreUses(playerName, campaignName) {
    setRuntimeValue(playerName, LEGACY_KEY, null, campaignName);
    setRuntimeValue(playerName, LEGACY_ABILITY_KEY, null, campaignName);
    setRuntimeValue(playerName, LEGACY_CANTRIP_KEY, null, campaignName);
    setRuntimeValue(playerName, LEGACY_LEVEL3_KEY, null, campaignName);
    setRuntimeValue(playerName, LEGACY_LEVEL5_KEY, null, campaignName);
}
