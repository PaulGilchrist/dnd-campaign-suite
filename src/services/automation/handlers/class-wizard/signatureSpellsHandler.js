import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { loadSpells } from '../../../ui/dataLoader.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const playerName = playerStats.name;
    const currentSpells = getRuntimeValue(playerName, '_Signature_Spells_selection', campaignName);
    const selectedSpells = Array.isArray(currentSpells) ? currentSpells : [];

    if (!selectedSpells.length) {
        const allSpells = await loadSpells(playerStats.rules || '2024');
        const level3Spells = allSpells.filter(s => s.level === 3);

        if (!level3Spells.length) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: 'No level 3 spells available.',
                },
            };
        }

        const optionDetails = {};
        for (const s of level3Spells) {
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
            modalName: 'signatureSpells',
            payload: {
                action,
                playerStats,
                campaignName,
                level3Options: level3Spells.map(s => s.name),
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
                description: 'All signature spells have been used. Finish a Short or Long Rest to regain them.',
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

export async function onSignatureSpellsSelected(action, playerStats, campaignName, spell1, spell2) {
    const playerName = playerStats.name;

    if (!spell1 || !spell2 || spell1 === spell2) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Two different level 3 spells must be selected.',
            },
        };
    }

    await setRuntimeValue(playerName, '_Signature_Spells_selection', [spell1, spell2], campaignName, true);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Signature Spells: You can now cast <b>${spell1}</b> and <b>${spell2}</b> once at level 3 without expending a spell slot. Recharges on a Short or Long Rest.`,
            automation: action.automation,
        },
    };
}

export async function onSignatureSpellsCast(action, playerStats, campaignName, spellName) {
    const playerName = playerStats.name;
    const selection = getRuntimeValue(playerName, '_Signature_Spells_selection', campaignName);
    const selectedSpells = Array.isArray(selection) ? selection : [];

    if (!selectedSpells.includes(spellName)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${spellName} is not a selected signature spell.`,
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
                description: `${spellName} has already been cast as a signature spell. Finish a Short or Long Rest to regain.`,
            },
        };
    }

    await setRuntimeValue(playerName, usedKey, true, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${spellName} cast as a signature spell (no spell slot expended). Finish a Short or Long Rest to regain.`,
            automation: action.automation,
        },
    };
}
