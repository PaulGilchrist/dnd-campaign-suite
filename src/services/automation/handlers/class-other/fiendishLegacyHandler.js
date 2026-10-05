import { getRuntimeValue, setRuntimeObject, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const LEGACY_KEY = '_fiendishLegacySelection';
const LEGACY_CANTRIP_KEY = '_fiendishLegacyCantrip';
const LEGACY_LEVEL3_KEY = '_fiendishLegacyLevel3';
const LEGACY_LEVEL5_KEY = '_fiendishLegacyLevel5';
const LEGACY_ABILITY_KEY = '_fiendishLegacyAbility';

// Data mirrors races.json:880 Fiendish Legacy trait options (races are 2024).
const FIENDISH_LEGACIES = [
    { name: 'Abyssal', description: 'Resistance to Poison damage + Poison Spray cantrip. Level 3: Ray of Sickness. Level 5: Hold Person.', spellcastingAbility: 'Charisma', cantrip: 'Poison Spray', level3Spell: 'Ray of Sickness', level5Spell: 'Hold Person' },
    { name: 'Chthonic', description: 'Resistance to Necrotic damage + Chill Touch cantrip. Level 3: False Life. Level 5: Ray of Enfeeblement.', spellcastingAbility: 'Charisma', cantrip: 'Chill Touch', level3Spell: 'False Life', level5Spell: 'Ray of Enfeeblement' },
    { name: 'Infernal', description: 'Resistance to Fire damage + Fire Bolt cantrip. Level 3: Hellish Rebuke. Level 5: Darkness.', spellcastingAbility: 'Charisma', cantrip: 'Fire Bolt', level3Spell: 'Hellish Rebuke', level5Spell: 'Darkness' },
];

// CLA-139: race.subrace IS the legacy in 2024 Tiefling data ("Abyssal Tiefling"
// etc., races.json:9) — the wizard-persisted subrace is the authoritative channel.
// The runtime _fiendishLegacySelection keys refine/fallback for sheet-chooser
// selections made without a subrace (CLA-118 resolve shape).
export function resolveFiendishLegacy(playerStats, campaignName) {
    if (playerStats.race?.name !== 'Tiefling') return null;
    const subraceName = playerStats.race?.subrace?.name;
    if (subraceName) return subraceName.replace(' Tiefling', '');
    return getRuntimeValue(playerStats.name, LEGACY_KEY, campaignName);
}

// CLA-139: stamp the runtime legacy keys in ONE merged write when the wizard
// changes a Tiefling's subrace (legacy), so runtime consumers never serve stale grants.
export function stampFiendishLegacyRuntime(characterName, subraceName, campaignName) {
    const legacyName = (subraceName || '').replace(' Tiefling', '');
    const legacyData = FIENDISH_LEGACIES.find(l => l.name === legacyName);
    if (!legacyData) {
        console.error('[fiendishLegacyHandler] cannot stamp runtime legacy — unknown tiefling subrace:', subraceName);
        return;
    }
    setRuntimeObject(characterName, {
        [LEGACY_KEY]: legacyData.name,
        [LEGACY_ABILITY_KEY]: legacyData.spellcastingAbility,
        [LEGACY_CANTRIP_KEY]: legacyData.cantrip,
        [LEGACY_LEVEL3_KEY]: legacyData.level3Spell,
        [LEGACY_LEVEL5_KEY]: legacyData.level5Spell,
    }, campaignName);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    // CLA-139: report the subrace-authoritative legacy, never a stale runtime value.
    const storedLegacy = resolveFiendishLegacy(playerStats, campaignName);
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

    // CLA-139: single merged runtime write (CLA-118 shape) — the selection and
    // its derived grants land together so consumers never read half-applied state.
    await setRuntimeObject(playerStats.name, {
        [LEGACY_KEY]: legacyData.name,
        [LEGACY_ABILITY_KEY]: legacyData.spellcastingAbility,
        [LEGACY_CANTRIP_KEY]: legacyData.cantrip,
        [LEGACY_LEVEL3_KEY]: legacyData.level3Spell,
        [LEGACY_LEVEL5_KEY]: legacyData.level5Spell,
    }, campaignName);

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
