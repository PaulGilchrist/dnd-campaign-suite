import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../services/ui/logService.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation || {};
    const playerName = playerStats.name;

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const isActive = activeBuffs.some(b => b.name === action.name);

    if (isActive) {
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} deactivates ${action.name}. Attunement limit returns to normal.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[useMagicDevice] log error:', e); });
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} ended. Attunement limit returns to normal.`,
                automation: auto,
            },
        };
    }

    const buff = {
        name: action.name,
        effect: 'use_magic_device',
        duration: auto.duration || '1_minute',
        hasAutomation: true,
    };

    const newBuffs = [...activeBuffs, buff];
    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    const attunementLimit = auto.attunementLimit || 4;
    const chargeReroll = auto.chargeReroll || '1d6';
    const chargeRerollSuccess = auto.chargeRerollSuccess || 6;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activates ${action.name}: attune up to ${attunementLimit} magic items; charges reroll ${chargeReroll} on ${chargeRerollSuccess}; scrolls cast with INT (Arcana DC 10 + spell level, disintegrates on fail). Charges/scroll clauses GM-adjudicated.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[useMagicDevice] log error:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated. Attune to up to ${attunementLimit} magic items. Charges: roll 1d6, on ${chargeRerollSuccess} use without expending. Scrolls: Intelligence as spellcasting ability. Cantrips/Level 1 cast reliably. Higher levels: Arcana check DC 10 + spell level; on fail, scroll disintegrates.`,
            automation: auto,
        },
    };
}
