import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const flySpeed = auto.flySpeed === '2x_speed'
        ? Math.max(30, playerStats.speed || 30) * 2
        : auto.flySpeed;

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const isAlreadyActive = activeBuffs.some(b => b.name === action.name && b.leapEffect);

    if (isAlreadyActive) {
        const usesKey = 'psionicEnergy';
        const defaultMax = playerStats._trackedResources?.[usesKey]?.max || 6;
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? defaultMax);

        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} is already active. Spend a Psionic Energy Die to refresh, or wait for end of turn to expire.`,
                    automation: auto,
                },
            };
        }

        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} refreshed — spent 1 Psionic Energy Die. Fly Speed ${flySpeed} ft until end of turn.`,
                automation: auto,
            },
        };
    }

    const leapEffect = {
        name: action.name,
        effect: 'telekinetic_leap',
        flySpeed: flySpeed,
        duration: auto.duration || 'until_end_of_turn',
        leapEffect: true,
    };

    const newBuffs = [...activeBuffs, leapEffect];
    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated — Fly Speed ${flySpeed} ft until end of turn.`,
            automation: auto,
        },
    };
}

export async function applyTelekineticLeap(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const existingIndex = activeBuffs.findIndex(b => b.name === action.name && b.leapEffect);

    const flySpeed = auto.flySpeed === '2x_speed'
        ? Math.max(30, playerStats.speed || 30) * 2
        : auto.flySpeed;

    const buff = {
        name: action.name,
        effect: 'telekinetic_leap',
        flySpeed: flySpeed,
        duration: auto.duration || 'until_end_of_turn',
        leapEffect: true,
    };

    let newBuffs;
    if (existingIndex >= 0) {
        newBuffs = [...activeBuffs];
        newBuffs[existingIndex] = buff;
    } else {
        newBuffs = [...activeBuffs, buff];
    }

    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated — Fly Speed ${flySpeed} ft until end of turn.`,
            automation: auto,
        },
    };
}
