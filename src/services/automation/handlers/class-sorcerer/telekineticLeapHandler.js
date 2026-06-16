import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { toggleBuff } from '../../common/buffToggle.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const flySpeed = auto.flySpeed === '2x_speed'
        ? (playerStats.speed || 30) * 2
        : auto.flySpeed;

    const { wasActive } = toggleBuff(
        playerName,
        action.name,
        { ...auto, effect: 'telekinetic_leap', flySpeed },
        campaignName,
        playerName
    );

    if (wasActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} deactivated`,
                automation: auto,
            },
        };
    }

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
        ? (playerStats.speed || 30) * 2
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
