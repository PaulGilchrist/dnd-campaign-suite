import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { loadSpells } from '../../../ui/dataLoader.js';

const ACTION_CASTING_TIMES = new Set(['Action', '1 Action']);

export async function handle(action, playerStats, campaignName, _mapName) {
    const playerName = playerStats.name;

    const allSpells = await loadSpells(playerStats.rules || '2024');
    const eligibleSpells = allSpells.filter(s => {
        if (s.level < 1 || s.level > 2) return false;
        if (!ACTION_CASTING_TIMES.has(s.casting_time)) return false;
        return true;
    });

    if (!eligibleSpells.length) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No level 1 or 2 spells with casting time of an action available.',
            },
        };
    }

    const currentLevel1 = getRuntimeValue(playerName, '_Spell_Mastery_level1', campaignName);
    const currentLevel2 = getRuntimeValue(playerName, '_Spell_Mastery_level2', campaignName);

    const level1Options = eligibleSpells.filter(s => s.level === 1).map(s => s.name);
    const level2Options = eligibleSpells.filter(s => s.level === 2).map(s => s.name);

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
        modalName: 'spellMastery',
        payload: {
            action,
            playerStats,
            campaignName,
            level1Options,
            level2Options,
            optionDetails,
            currentLevel1,
            currentLevel2,
        },
    };
}

export async function onSpellMasterySelected(action, playerStats, campaignName, selectedLevel1, selectedLevel2) {
    const playerName = playerStats.name;

    if (!selectedLevel1 || !selectedLevel2) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Both a level 1 and level 2 spell must be selected.',
            },
        };
    }

    await setRuntimeValue(playerName, '_Spell_Mastery_level1', selectedLevel1, campaignName, true);
    await setRuntimeValue(playerName, '_Spell_Mastery_level2', selectedLevel2, campaignName, true);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Spell Mastery: You can now cast <b>${selectedLevel1}</b> (level 1) and <b>${selectedLevel2}</b> (level 2) at will without expending spell slots. These spells are always prepared.`,
            automation: action.automation,
        },
    };
}
