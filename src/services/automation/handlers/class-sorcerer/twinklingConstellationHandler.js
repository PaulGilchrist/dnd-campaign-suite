import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const CONSTELLATION_OPTIONS = ['Archer', 'Chalice', 'Dragon'];

export async function handle(action, playerStats, campaignName) {
    const level = playerStats.level || 1;
    const isTwinkled = level >= 10;

    if (!isTwinkled) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Twinkling Constellations requires level 10.`,
                automation: action.automation,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'twinklingConstellation',
        payload: { action, playerStats, campaignName },
    };
}

export async function applyConstellationOption(action, playerStats, campaignName, optionName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const isTwinkled = (playerStats.level || 1) >= 10;

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

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];

    const existingStarryFormIndex = activeBuffs.findIndex(b => b.name === 'Starry Form');
    if (existingStarryFormIndex !== -1) {
        activeBuffs.splice(existingStarryFormIndex, 1);
    }

    const buffEntry = {
        name: 'Starry Form',
        effect: 'starry_form',
        constellation: optionName,
        duration: '1_minute',
        hasAutomation: true,
    };

    if (optionName === 'Dragon' && isTwinkled) {
        buffEntry.effect = 'fly_speed_20_hover';
        buffEntry.flySpeed = 20;
    }

    activeBuffs.push(buffEntry);
    await setRuntimeValue(playerName, 'activeBuffs', activeBuffs, campaignName);

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

    const description = `${optionName} constellation chosen (Twinkling Constellations). ${optionEffects.join('. ')}.`;

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
