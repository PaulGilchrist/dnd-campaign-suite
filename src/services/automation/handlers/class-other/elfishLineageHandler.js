import { getRuntimeValue, setRuntimeObject, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const LINEAGE_KEY = '_elfishLineageSelection';
const LINEAGE_CANTRIP_KEY = '_elfishLineageCantrip';
const LINEAGE_LEVEL3_KEY = '_elfishLineageLevel3';
const LINEAGE_LEVEL5_KEY = '_elfishLineageLevel5';
const LINEAGE_ABILITY_KEY = '_elfishLineageAbility';
const LINEAGE_WIZARD_CANTRIP_KEY = '_elfishLineageWizardCantrip';

const ELVEN_LINEAGES = [
    { name: 'Drow', description: 'Darkvision 120 ft. + Dancing Lights cantrip. Level 3: Faerie Fire. Level 5: Darkness.', spellcastingAbility: 'Charisma', icon: 'fa-d', cantrip: 'Dancing Lights', level3Spell: 'Faerie Fire', level5Spell: 'Darkness' },
    { name: 'High Elf', description: 'Prestidigitation cantrip (swappable with Wizard cantrips on Long Rest). Level 3: Detect Magic. Level 5: Misty Step.', spellcastingAbility: 'Intelligence', icon: 'fa-star', cantrip: 'Prestidigitation', level3Spell: 'Detect Magic', level5Spell: 'Misty Step', wizardCantripSwap: true },
    { name: 'Wood Elf', description: 'Speed 35 ft. + Druidcraft cantrip. Level 3: Longstrider. Level 5: Pass Without Trace.', spellcastingAbility: 'Wisdom', icon: 'fa-tree', cantrip: 'Druidcraft', level3Spell: 'Longstrider', level5Spell: 'Pass Without Trace' },
];

// CLA-118: race.subrace is the wizard-persisted authoritative channel; the
// runtime _elfishLineageSelection keys go stale when the wizard edits the
// subrace, so they are only a fallback for legacy sheet-chooser selections.
export function resolveElfishLineage(playerStats, campaignName) {
    return playerStats.race?.lineage
        || playerStats.race?.subrace?.name
        || getRuntimeValue(playerStats.name, LINEAGE_KEY, campaignName);
}

// Wood Elf ladder grant (races.json speedBonus). 0 when the character lacks
// the elfish_lineage trait, the lineage isn't Wood Elf, or the 5e subrace
// JSON already carries the absolute speed.
export function elfishLineageSpeedBonus(playerStats, campaignName) {
    const autoRows = [
        ...(playerStats.automation?.specialActions || []),
        ...(playerStats.automation?.passives || []),
    ];
    if (!autoRows.some(f => f.type === 'elfish_lineage')) return 0;
    if (resolveElfishLineage(playerStats, campaignName) !== 'Wood Elf') return 0;
    if (playerStats.race?.subrace?.speed != null) return 0;
    const option = autoRows.flatMap(f => f.options || []).find(o => o.name === 'Wood Elf');
    if (!option || option.speedBonus == null) {
        console.error('[elfishLineageHandler] Wood Elf lineage selected but races.json option has no speedBonus:', playerStats.name);
        return 0;
    }
    return option.speedBonus;
}

// CLA-118: stamp the runtime lineage keys in ONE merged write when the wizard
// changes an Elf's subrace, so runtime consumers never serve stale grants.
export function stampElfishLineageRuntime(characterName, subraceName, campaignName) {
    const lineageData = ELVEN_LINEAGES.find(l => l.name === subraceName);
    if (!lineageData) {
        console.error('[elfishLineageHandler] cannot stamp runtime lineage — unknown elven subrace:', subraceName);
        return;
    }
    setRuntimeObject(characterName, {
        [LINEAGE_KEY]: lineageData.name,
        [LINEAGE_ABILITY_KEY]: lineageData.spellcastingAbility,
        [LINEAGE_CANTRIP_KEY]: lineageData.cantrip,
        [LINEAGE_LEVEL3_KEY]: lineageData.level3Spell,
        [LINEAGE_LEVEL5_KEY]: lineageData.level5Spell,
        ...(lineageData.wizardCantripSwap ? { [LINEAGE_WIZARD_CANTRIP_KEY]: 'Prestidigitation' } : {}),
    }, campaignName);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    // Check if lineage is already selected
    const storedLineage = getRuntimeValue(playerStats.name, LINEAGE_KEY, campaignName);
    if (storedLineage) {
        // CLA-118: report the subrace-authoritative lineage, never a stale runtime value.
        const resolvedLineage = resolveElfishLineage(playerStats, campaignName);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Elfish Lineage: ${resolvedLineage} (already selected).`,
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
