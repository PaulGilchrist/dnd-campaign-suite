import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const ALL_DAMAGES_EXCEPT_FORCE = [
    'acid', 'bludgeoning', 'cold', 'fire', 'lightning',
    'piercing', 'poison', 'slashing', 'thunder',
    'necrotic', 'psychic', 'radiant'
];

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const wasActive = activeBuffs.some(b => b.name === action.name);

    if (wasActive) {
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} ended ${action.name}.`,
        }).catch(() => {});
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} ended.`,
                automation: auto,
            },
        };
    }

    const cost = auto.cost || 3;
    const maxFocus = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.focus_points || 0;
    const currentFocus = Number(getRuntimeValue(playerName, 'focusPoints', campaignName) ?? maxFocus);

    if (currentFocus < cost) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `Not enough Focus Points. ${action.name} requires ${cost} Focus Points.`,
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, 'focusPoints', currentFocus - cost, campaignName);

    const buff = {
        name: action.name,
        effect: 'damage_resistance',
        duration: auto.duration || '1_minute',
        resistanceTypes: ALL_DAMAGES_EXCEPT_FORCE,
    };

    const newBuffs = [...activeBuffs, buff];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated ${action.name}. Resistance to all damage except Force for 1 minute or until Incapacitated.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated. Resistance to all damage except Force for 1 minute or until Incapacitated. (${currentFocus - cost} Focus Points remaining)`,
            automation: auto,
        },
    };
}

export async function activateAtTurnStart(playerStats, campaignName) {
    const playerName = playerStats.name;

    const conditions = getRuntimeValue(playerName, 'activeConditions') || [];
    const isIncapacitated = conditions.some(c => String(c).toLowerCase() === 'incapacitated');
    if (isIncapacitated) {
        return { activated: false, reason: 'incapacitated' };
    }

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    if (activeBuffs.some(b => b.name === 'Superior Defense')) {
        return { activated: false, reason: 'already_active' };
    }

    const auto = playerStats.automation?.specialActions?.find(a => a.name === 'Superior Defense')?.automation;
    if (!auto) {
        return { activated: false, reason: 'no_automation' };
    }

    const cost = auto.cost || 3;
    const maxFocus = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.focus_points || 0;
    const currentFocus = Number(getRuntimeValue(playerName, 'focusPoints', campaignName) ?? maxFocus);

    if (currentFocus < cost) {
        return { activated: false, reason: 'insufficient_focus', cost, available: currentFocus };
    }

    await setRuntimeValue(playerName, 'focusPoints', currentFocus - cost, campaignName);

    const buff = {
        name: 'Superior Defense',
        effect: 'damage_resistance',
        duration: auto.duration || '1_minute',
        resistanceTypes: ALL_DAMAGES_EXCEPT_FORCE,
    };

    const newBuffs = [...activeBuffs, buff];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Superior Defense',
        description: `${playerName} activated Superior Defense at start of turn. Resistance to all damage except Force.`,
    }).catch(() => {});

    return { activated: true, remainingFocus: currentFocus - cost };
}
