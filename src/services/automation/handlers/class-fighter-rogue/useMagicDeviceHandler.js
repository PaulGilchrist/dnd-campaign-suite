import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation || {};
    const playerName = playerStats.name;

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const isActive = activeBuffs.some(b => b.name === action.name);

    if (isActive) {
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
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
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    const attunementLimit = auto.attunementLimit || 4;
    const chargeRerollSuccess = auto.chargeRerollSuccess || 6;

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
