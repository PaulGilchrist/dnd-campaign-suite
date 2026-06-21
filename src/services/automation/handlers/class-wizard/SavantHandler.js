import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { loadSpells } from '../../../ui/dataLoader.js';

export async function handle(action, playerStats, campaignName, _mapName, school) {
    const playerName = playerStats.name;
    const selectionKey = `_${school}_Savant_selection`;
    const currentSelection = getRuntimeValue(playerName, selectionKey, campaignName);
    const selectedSpells = Array.isArray(currentSelection) ? currentSelection : [];

    const allSpells = await loadSpells(playerStats.rules || '2024');
    const schoolSpells = allSpells.filter(s => {
        if (s.school !== school) return false;
        if (s.level < 0 || s.level > 2) return false;
        if (!s.classes?.includes('Wizard')) return false;
        return true;
    });

    if (!schoolSpells.length) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No ${school} school spells of level 2 or lower available.`,
            },
        };
    }

    const optionDetails = {};
    for (const s of schoolSpells) {
        optionDetails[s.name] = {
            name: s.name,
            level: s.level,
            casting_time: s.casting_time || '1 action',
            range: s.range || '',
            description: s.description || '',
            damage: s.damage || null,
        };
    }

    return {
        type: 'modal',
        modalName: `${school.toLowerCase()}Savant`,
        payload: {
            action,
            playerStats,
            campaignName,
            school,
            spellOptions: schoolSpells.map(s => s.name),
            optionDetails,
            selectedSpells,
        },
    };
}

export async function onSavantSelected(action, playerStats, campaignName, spell1, spell2, school) {
    const playerName = playerStats.name;
    const selectionKey = `_${school}_Savant_selection`;

    if (!spell1 && !spell2) {
        await setRuntimeValue(playerName, selectionKey, null, campaignName, true);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${school} Savant selection cleared.`,
            },
        };
    }

    if (!spell1 || !spell2 || spell1 === spell2) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Two different ${school} school spells (level 2 or lower) must be selected.`,
            },
        };
    }

    const currentSelection = getRuntimeValue(playerName, selectionKey, campaignName);
    const existingSelection = Array.isArray(currentSelection) ? [...currentSelection] : [];

    const newSpells = [spell1, spell2].filter(s => !existingSelection.includes(s));
    const updatedSelection = [...existingSelection, ...newSpells];

    await setRuntimeValue(playerName, selectionKey, updatedSelection, campaignName, true);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${school} Savant: You have added <b>${spell1}</b> and <b>${spell2}</b> to your spellbook for free. These are always prepared.`,
            automation: action.automation,
        },
    };
}

export async function onSavantLevelUp(action, playerStats, campaignName, spellName, school) {
    const playerName = playerStats.name;
    const selectionKey = `_${school}_Savant_selection`;

    if (!spellName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `A ${school} school spell must be selected.`,
            },
        };
    }

    const allSpells = await loadSpells(playerStats.rules || '2024');
    const spellDetail = allSpells.find(s => s.name === spellName);
    if (!spellDetail || spellDetail.school !== school) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${spellName} is not ${['A','E','I','O','U'].includes(school[0]) ? 'an' : 'a'} ${school} school spell.`,
            },
        };
    }

    const currentSelection = getRuntimeValue(playerName, selectionKey, campaignName);
    const updatedSelection = Array.isArray(currentSelection) ? [...currentSelection] : [];
    if (!updatedSelection.includes(spellName)) {
        updatedSelection.push(spellName);
    }

    await setRuntimeValue(playerName, selectionKey, updatedSelection, campaignName, true);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${school} Savant: You have added <b>${spellName}</b> to your spellbook for free (gained new spell slot level). This spell is always prepared.`,
            automation: action.automation,
        },
    };
}
