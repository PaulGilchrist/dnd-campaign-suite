import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

const LINEAGE_KEY = '_elfishLineageSelection';
const LINEAGE_CANTRIP_KEY = '_elfishLineageCantrip';
const LINEAGE_LEVEL3_KEY = '_elfishLineageLevel3';
const LINEAGE_LEVEL5_KEY = '_elfishLineageLevel5';
const LINEAGE_ABILITY_KEY = '_elfishLineageAbility';
const LINEAGE_WIZARD_CANTRIP_KEY = '_elfishLineageWizardCantrip';

const ELVEN_LINEAGES = [
    { name: 'Drow', description: 'Darkvision 120 ft. + Dancing Lights cantrip. Level 3: Faerie Fire. Level 5: Darkness.', spellcastingAbility: 'Charisma', icon: 'fa-d' },
    { name: 'High Elf', description: 'Prestidigitation cantrip (swappable with Wizard cantrips on Long Rest). Level 3: Detect Magic. Level 5: Misty Step.', spellcastingAbility: 'Intelligence', icon: 'fa-star' },
    { name: 'Wood Elf', description: 'Speed 35 ft. + Druidcraft cantrip. Level 3: Longstrider. Level 5: Pass Without Trace.', spellcastingAbility: 'Wisdom', icon: 'fa-tree' },
];

export async function handle(action, playerStats, campaignName, _mapName) {
    // Check if lineage is already selected
    const storedLineage = getRuntimeValue(playerStats.name, LINEAGE_KEY, campaignName);
    if (storedLineage) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Elfish Lineage: ${storedLineage} (already selected).`,
                automation: action.automation,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'elfishLineage',
        payload: {
            action,
            playerStats,
            campaignName,
        },
    };
}

export async function confirmElfisLineage(playerStats, chosenLineage, campaignName) {
    const auto = {
        type: 'elfish_lineage',
        options: ELVEN_LINEAGES,
    };

    const lineageData = ELVEN_LINEAGES.find(l => l.name === chosenLineage);
    if (!lineageData) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Elfish Lineage',
                description: 'No lineage selected.',
                automation: auto,
            },
        };
    }

    // Store lineage selection in runtime state
    await setRuntimeValue(playerStats.name, LINEAGE_KEY, chosenLineage, campaignName);
    await setRuntimeValue(playerStats.name, LINEAGE_ABILITY_KEY, lineageData.spellcastingAbility, campaignName);
    await setRuntimeValue(playerStats.name, LINEAGE_CANTRIP_KEY, lineageData.cantrip, campaignName);
    await setRuntimeValue(playerStats.name, LINEAGE_LEVEL3_KEY, lineageData.level3Spell, campaignName);
    await setRuntimeValue(playerStats.name, LINEAGE_LEVEL5_KEY, lineageData.level5Spell, campaignName);

    // For High Elf: default wizard cantrip swap to Prestidigitation
    if (lineageData.wizardCantripSwap) {
        await setRuntimeValue(playerStats.name, LINEAGE_WIZARD_CANTRIP_KEY, 'Prestidigitation', campaignName);
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Elfish Lineage',
            description: `Selected ${chosenLineage} lineage. Spellcasting ability: ${lineageData.spellcastingAbility}.`,
            automation: auto,
        },
    };
}

export async function changeElfisLineageCantrip(playerStats, newCantrip, campaignName) {
    await setRuntimeValue(playerStats.name, LINEAGE_WIZARD_CANTRIP_KEY, newCantrip, campaignName);
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Elfish Lineage',
            description: `Wizard cantrip changed to ${newCantrip}.`,
        },
    };
}

export function getElfisLineageSelection(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LINEAGE_KEY, campaignName);
}

export function getElfisLineageAbility(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LINEAGE_ABILITY_KEY, campaignName);
}

export function getElfisLineageCantrip(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LINEAGE_CANTRIP_KEY, campaignName);
}

export function getElfisLineageLevel3Spell(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LINEAGE_LEVEL3_KEY, campaignName);
}

export function getElfisLineageLevel5Spell(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LINEAGE_LEVEL5_KEY, campaignName);
}

export function getElfisLineageWizardCantrip(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LINEAGE_WIZARD_CANTRIP_KEY, campaignName);
}

export function restoreUses(playerName, campaignName) {
    // No uses to restore — lineage spells are always known once selected
    setRuntimeValue(playerName, LINEAGE_KEY, null, campaignName);
    setRuntimeValue(playerName, LINEAGE_ABILITY_KEY, null, campaignName);
    setRuntimeValue(playerName, LINEAGE_CANTRIP_KEY, null, campaignName);
    setRuntimeValue(playerName, LINEAGE_LEVEL3_KEY, null, campaignName);
    setRuntimeValue(playerName, LINEAGE_LEVEL5_KEY, null, campaignName);
    setRuntimeValue(playerName, LINEAGE_WIZARD_CANTRIP_KEY, null, campaignName);
}
