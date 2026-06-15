import { loadSpellData } from '../../../ui/dataLoader.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const spellListKey = auto.spellList || 'wizard_cantrips';

    const allSpells = await loadSpellData(spellListKey, playerStats);
    if (!allSpells || !allSpells.length) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No Wizard cantrips available.',
            },
        };
    }

    const cantrips = allSpells.filter(s => s.level === 0);
    if (!cantrips.length) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No Wizard cantrips available.',
            },
        };
    }

    const optionNames = cantrips.map(s => s.name);
    const optionDetails = {};
    for (const s of cantrips) {
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
        modalName: 'warMagicCantrip',
        payload: {
            action,
            playerStats,
            campaignName,
            options: optionNames,
            optionDetails,
            spellListKey,
        },
    };
}

export async function confirmWarMagicCantrip(action, playerStats, campaignName, selectedSpellName) {
    if (!selectedSpellName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No cantrip selected.',
            },
        };
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name}: Replaced attack with cantrip "${selectedSpellName}"`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: 'war_magic_cantrip',
            description: `${action.name}: Replaced one attack with the cantrip <b>${selectedSpellName}</b>.`,
            automation: action.automation,
        },
    };
}
