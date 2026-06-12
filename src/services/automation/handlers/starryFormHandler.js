import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

const CONSTELLATION_OPTIONS = ['Archer', 'Chalice', 'Dragon'];

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

    const usesKey = auto.resourceKey || 'starryFormUses';
    const usesMax = auto.uses || 0;

    if (usesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} has no uses remaining.`,
                    automation: auto,
                },
            };
        }
        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
    } else {
        const resourceKey = auto.resourceKey || 'starryFormUses';
        const storedResource = getRuntimeValue(playerName, resourceKey, campaignName);
        const currentResource = storedResource != null ? Number(storedResource) : 0;
        if (currentResource <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} has no uses remaining.`,
                    automation: auto,
                },
            };
        }
        await setRuntimeValue(playerName, resourceKey, currentResource - 1, campaignName);
    }

    return {
        type: 'modal',
        modalName: 'starryFormConstellation',
        payload: { action, playerStats, campaignName },
    };
}

export async function applyConstellationOption(action, playerStats, campaignName, optionName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    if (!CONSTELLATION_OPTIONS.includes(optionName)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `Invalid constellation: ${optionName}`,
                automation: auto,
            },
        };
    }

    const level = playerStats.level || 1;
    const isTwinkled = level >= 10;

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const buffEntry = {
        name: action.name,
        effect: 'starry_form',
        constellation: optionName,
        duration: auto.duration || '1_minute',
        hasAutomation: true,
    };
    if (optionName === 'Dragon' && isTwinkled) {
        buffEntry.effect = 'fly_speed_20_hover';
        buffEntry.flySpeed = 20;
    }
    const newBuffs = [...activeBuffs, buffEntry];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    const optionEffects = [];

    if (optionName === 'Archer') {
        const damageDice = isTwinkled ? '2d8' : '1d8';
        optionEffects.push(`Ranged Spell Attack: ${damageDice} + Wisdom Modifier Radiant damage`);
    } else if (optionName === 'Chalice') {
        const healDice = isTwinkled ? '2d8' : '1d8';
        optionEffects.push(`Healing Spell Ally Buff: ${healDice} + Wisdom Modifier HP to ally within 30 feet`);
    } else if (optionName === 'Dragon') {
        optionEffects.push('Concentration Benefit: Treat d20 rolls of 9 or lower on Concentration checks/saves as 10');
        if (isTwinkled) {
            optionEffects.push('Fly Speed 20 feet (hover)');
        }
    }

    const description = `${optionName} constellation chosen. ${optionEffects.join('. ')}.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description,
            automation: auto,
        },
    };
}
