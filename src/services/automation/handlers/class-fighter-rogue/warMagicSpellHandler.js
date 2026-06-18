import { loadSpellData } from '../../../ui/dataLoader.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const spellListKey = auto.spellList || 'wizard_spells';
    const maxLevel = auto.maxSpellLevel || 2;

    const allSpells = await loadSpellData(spellListKey, playerStats);
    if (!allSpells || !allSpells.length) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No Wizard spells available.',
            },
        };
    }

    const eligibleSpells = allSpells.filter(s => s.level > 0 && s.level <= maxLevel);
    if (!eligibleSpells.length) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No Wizard spells of level 1-2 available.',
            },
        };
    }

    const optionNames = eligibleSpells.map(s => s.name);
    const optionDetails = {};
    for (const s of eligibleSpells) {
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
        modalName: 'warMagicSpell',
        payload: {
            action,
            playerStats,
            campaignName,
            options: optionNames,
            optionDetails,
            spellListKey,
            maxSpellLevel: maxLevel,
        },
    };
}

export async function confirmWarMagicSpell(action, playerStats, campaignName, selectedSpellName) {
    if (!selectedSpellName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No spell selected.',
            },
        };
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name}: Replaced attack with spell "${selectedSpellName}"`,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: 'war_magic_spell',
            description: `${action.name}: Replaced one attack with the level ${action.automation.maxSpellLevel || 2} spell <b>${selectedSpellName}</b>.`,
            automation: action.automation,
        },
    };
}
