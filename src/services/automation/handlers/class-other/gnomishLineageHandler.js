import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const LINEAGE_KEY = '_gnomishLineageSelection';
const LINEAGE_CANTRIP_KEY = '_gnomishLineageCantrip';
const LINEAGE_LEVEL3_KEY = '_gnomishLineageLevel3';
const LINEAGE_LEVEL5_KEY = '_gnomishLineageLevel5';
const LINEAGE_ABILITY_KEY = '_gnomishLineageAbility';

const GNOME_LINEAGES = [
    { name: 'Deep Gnome', description: 'Darkvision 120 ft. + Magic Stone cantrip. Level 3: Nondetection. Level 5: Passwall.', spellcastingAbility: 'Intelligence', icon: 'fa-eye', cantrip: 'Magic Stone', level3Spell: 'Nondetection', level5Spell: 'Passwall' },
    { name: 'Forest Gnome', description: 'Hide behind larger creatures + Minor Illusion cantrip. Level 3: Speak with Animals. Level 5: Call Lightning.', spellcastingAbility: 'Intelligence', icon: 'fa-tree', cantrip: 'Minor Illusion', level3Spell: 'Speak with Animals', level5Spell: 'Call Lightning' },
    { name: 'Rock Gnome', description: 'Move through larger creatures\' space + Mending cantrip. Level 3: Prestidigitation. Level 5: Protection from Energy.', spellcastingAbility: 'Intelligence', icon: 'fa-hammer', cantrip: 'Mending', level3Spell: 'Prestidigitation', level5Spell: 'Protection from Energy' },
];

export async function handle(action, playerStats, campaignName, _mapName) {
    const storedLineage = getRuntimeValue(playerStats.name, LINEAGE_KEY, campaignName);
    if (storedLineage) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Gnomish Lineage: ${storedLineage} (already selected).`,
                automation: action.automation,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'gnomishLineage',
        payload: {
            action,
            playerStats,
            campaignName,
        },
    };
}

export async function confirmGnomishLineage(playerStats, chosenLineage, campaignName) {
    const auto = {
        type: 'gnomish_lineage',
        options: GNOME_LINEAGES,
    };

    const lineageData = GNOME_LINEAGES.find(l => l.name === chosenLineage);
    if (!lineageData) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Gnomish Lineage',
                description: 'No lineage selected.',
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerStats.name, LINEAGE_KEY, chosenLineage, campaignName);
    await setRuntimeValue(playerStats.name, LINEAGE_ABILITY_KEY, lineageData.spellcastingAbility, campaignName);
    await setRuntimeValue(playerStats.name, LINEAGE_CANTRIP_KEY, lineageData.cantrip, campaignName);
    await setRuntimeValue(playerStats.name, LINEAGE_LEVEL3_KEY, lineageData.level3Spell, campaignName);
    await setRuntimeValue(playerStats.name, LINEAGE_LEVEL5_KEY, lineageData.level5Spell, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Gnomish Lineage',
            description: `Selected ${chosenLineage} lineage. Spellcasting ability: ${lineageData.spellcastingAbility}.`,
            automation: auto,
        },
    };
}

export function getGnomishLineageSelection(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LINEAGE_KEY, campaignName);
}

export function getGnomishLineageAbility(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LINEAGE_ABILITY_KEY, campaignName);
}

export function getGnomishLineageCantrip(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LINEAGE_CANTRIP_KEY, campaignName);
}

export function getGnomishLineageLevel3Spell(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LINEAGE_LEVEL3_KEY, campaignName);
}

export function getGnomishLineageLevel5Spell(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LINEAGE_LEVEL5_KEY, campaignName);
}

export function restoreUses(playerName, campaignName) {
    setRuntimeValue(playerName, LINEAGE_KEY, null, campaignName);
    setRuntimeValue(playerName, LINEAGE_ABILITY_KEY, null, campaignName);
    setRuntimeValue(playerName, LINEAGE_CANTRIP_KEY, null, campaignName);
    setRuntimeValue(playerName, LINEAGE_LEVEL3_KEY, null, campaignName);
    setRuntimeValue(playerName, LINEAGE_LEVEL5_KEY, null, campaignName);
}
