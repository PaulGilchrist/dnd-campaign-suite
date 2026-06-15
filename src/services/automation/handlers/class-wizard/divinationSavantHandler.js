import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { loadSpells } from '../../../ui/dataLoader.js';

const DIVINATION_SCHOOL = 'Divination';

export async function handle(action, playerStats, campaignName, _mapName) {
    const playerName = playerStats.name;
    const currentSelection = getRuntimeValue(playerName, '_Divination_Savant_selection', campaignName);
    const selectedSpells = Array.isArray(currentSelection) ? currentSelection : [];

    if (!selectedSpells.length) {
        const allSpells = await loadSpells(playerStats.rules || '2024');
        const divinationSpells = allSpells.filter(s => {
            if (s.school !== DIVINATION_SCHOOL) return false;
            if (s.level < 0 || s.level > 2) return false;
            return true;
        });

        if (!divinationSpells.length) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: 'No Divination school spells of level 2 or lower available.',
                },
            };
        }

        const optionDetails = {};
        for (const s of divinationSpells) {
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
            modalName: 'divinationSavant',
            payload: {
                action,
                playerStats,
                campaignName,
                divinationOptions: divinationSpells.map(s => s.name),
                optionDetails,
                selectedSpells: [],
            },
        };
    }

    const availableSpells = [];
    for (const sn of selectedSpells) {
        const usedKey = `_${action.name.replace(/\s+/g, '_')}_${sn.replace(/\s+/g, '_')}_used`;
        const used = getRuntimeValue(playerName, usedKey, campaignName);
        if (!used) {
            availableSpells.push(sn);
        }
    }

    if (availableSpells.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'All Divination Savant spells have been used. Finish a Short or Long Rest to regain them.',
                automation: action.automation,
            },
        };
    }

    return {
        type: 'popup',
        payload: {
            html: `<b>${action.name}</b><br/>${action.description || ''}<br/><br/><b>Available free casts:</b> ${availableSpells.join(', ')}<br/><br/><em>Open your spell sheet and cast one — no spell slot will be consumed.</em>`,
        },
    };
}

export async function onDivinationSavantSelected(action, playerStats, campaignName, spell1, spell2) {
    const playerName = playerStats.name;

    if (!spell1 || !spell2 || spell1 === spell2) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Two different Divination school spells (level 2 or lower) must be selected.',
            },
        };
    }

    await setRuntimeValue(playerName, '_Divination_Savant_selection', [spell1, spell2], campaignName, true);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Divination Savant: You have added <b>${spell1}</b> and <b>${spell2}</b> to your spellbook for free. These are always prepared.`,
            automation: action.automation,
        },
    };
}

export async function onDivinationSavantCast(action, playerStats, campaignName, spellName) {
    const playerName = playerStats.name;
    const selection = getRuntimeValue(playerName, '_Divination_Savant_selection', campaignName);
    const selectedSpells = Array.isArray(selection) ? selection : [];

    if (!selectedSpells.includes(spellName)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${spellName} is not a Divination Savant spell.`,
            },
        };
    }

    const usedKey = `_${action.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_used`;
    const used = getRuntimeValue(playerName, usedKey, campaignName);
    if (used) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${spellName} has already been cast as a Divination Savant spell. Finish a Short or Long Rest to regain.`,
            },
        };
    }

    await setRuntimeValue(playerName, usedKey, true, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${spellName} cast as a Divination Savant spell (no spell slot expended). Finish a Short or Long Rest to regain.`,
            automation: action.automation,
        },
    };
}

export async function onDivinationSavantLevelUp(action, playerStats, campaignName, spellName) {
    const playerName = playerStats.name;

    if (!spellName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'A Divination school spell must be selected.',
            },
        };
    }

    const allSpells = await loadSpells(playerStats.rules || '2024');
    const spellDetail = allSpells.find(s => s.name === spellName);
    if (!spellDetail || spellDetail.school !== DIVINATION_SCHOOL) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${spellName} is not a Divination school spell.`,
            },
        };
    }

    const currentSelection = getRuntimeValue(playerName, '_Divination_Savant_selection', campaignName);
    const updatedSelection = Array.isArray(currentSelection) ? [...currentSelection] : [];
    if (!updatedSelection.includes(spellName)) {
        updatedSelection.push(spellName);
    }

    await setRuntimeValue(playerName, '_Divination_Savant_selection', updatedSelection, campaignName, true);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Divination Savant: You have added <b>${spellName}</b> to your spellbook for free (gained new spell slot level). This spell is always prepared.`,
            automation: action.automation,
        },
    };
}
