import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const wasActive = activeBuffs.some(b => b.name === action.name);

    if (wasActive) {
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} ended`,
                automation: auto,
            },
        };
    }

    const resourceKey = auto.resourceKey || 'ragePoints';
    const storedResource = getRuntimeValue(playerName, resourceKey, campaignName);
    const currentResource = storedResource != null ? Number(storedResource) : 0;

    if (currentResource <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `No ${action.name} uses remaining.`,
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, resourceKey, currentResource - 1, campaignName);

    const newBuffs = [...activeBuffs, {
        name: action.name,
        effect: auto.effect || 'stance',
        duration: auto.duration || '1_minute',
        resistanceTypes: auto.resistanceTypes || [],
        advantages: auto.advantages || [],
        damageBonusExpression: auto.damageBonusExpression || '',
    }];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated (${currentResource - 1} use(s) remaining)`,
            automation: auto,
        },
    };
}
