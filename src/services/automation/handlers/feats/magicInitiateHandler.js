import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';

const MAGIC_INITIATE_CLASS_KEY = '_magicInitiateClass';
const MAGIC_INITIATE_CANTRIPS_KEY = '_magicInitiateCantrips';
const MAGIC_INITIATE_LEVEL1_KEY = '_magicInitiateLevel1Spell';
const MAGIC_INITIATE_ABILITY_KEY = '_magicInitiateAbility';

const CLASS_SPELL_LISTS = {
    Cleric: {
        spellcastingAbility: 'Wisdom',
        icon: 'fa-cross',
        description: 'Cleric spell list',
    },
    Druid: {
        spellcastingAbility: 'Wisdom',
        icon: 'fa-leaf',
        description: 'Druid spell list',
    },
    Wizard: {
        spellcastingAbility: 'Intelligence',
        icon: 'fa-hat-wizard',
        description: 'Wizard spell list',
    },
};

export async function handle(action, playerStats, campaignName, _mapName) {
    const storedClass = getRuntimeValue(playerStats.name, MAGIC_INITIATE_CLASS_KEY, campaignName);
    if (storedClass) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Magic Initiate: ${storedClass} (already selected).`,
                automation: action.automation,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'magicInitiate',
        payload: {
            action,
            playerStats,
            campaignName,
        },
    };
}

export async function confirmMagicInitiate(playerStats, chosenClass, campaignName) {
    const auto = {
        type: 'magic_initiate',
        options: Object.keys(CLASS_SPELL_LISTS),
    };

    const classData = CLASS_SPELL_LISTS[chosenClass];
    if (!classData) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Magic Initiate',
                description: 'No class selected.',
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerStats.name, MAGIC_INITIATE_CLASS_KEY, chosenClass, campaignName);
    await setRuntimeValue(playerStats.name, MAGIC_INITIATE_ABILITY_KEY, classData.spellcastingAbility, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Magic Initiate',
            description: `Selected ${chosenClass} class. Spellcasting ability: ${classData.spellcastingAbility}.`,
            automation: auto,
        },
    };
}

export async function setMagicInitiateCantrips(playerStats, cantrips, campaignName) {
    await setRuntimeValue(playerStats.name, MAGIC_INITIATE_CANTRIPS_KEY, cantrips, campaignName);
}

export async function setMagicInitiateLevel1Spell(playerStats, spell, campaignName) {
    await setRuntimeValue(playerStats.name, MAGIC_INITIATE_LEVEL1_KEY, spell, campaignName);
}

export function getMagicInitiateClass(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, MAGIC_INITIATE_CLASS_KEY, campaignName);
}

export function getMagicInitiateAbility(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, MAGIC_INITIATE_ABILITY_KEY, campaignName);
}

export function getMagicInitiateCantrips(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, MAGIC_INITIATE_CANTRIPS_KEY, campaignName);
}

export function getMagicInitiateLevel1Spell(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, MAGIC_INITIATE_LEVEL1_KEY, campaignName);
}

export function restoreUses(playerName, campaignName) {
    setRuntimeValue(playerName, MAGIC_INITIATE_CLASS_KEY, null, campaignName);
    setRuntimeValue(playerName, MAGIC_INITIATE_ABILITY_KEY, null, campaignName);
    setRuntimeValue(playerName, MAGIC_INITIATE_CANTRIPS_KEY, null, campaignName);
    setRuntimeValue(playerName, MAGIC_INITIATE_LEVEL1_KEY, null, campaignName);
}
