import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

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

    const buffEntry = {
        name: 'Starry Form',
        effect: 'starry_form',
        constellation: optionName,
        duration: '1_minute',
        hasAutomation: true,
        resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
    };

    if (optionName === 'Dragon' && isTwinkled) {
        buffEntry.effect = 'fly_speed_20_hover';
        buffEntry.flySpeed = 20;
    }

    // Build a NEW array (never splice the store's own reference): in-place
    // mutation makes setRuntimeValue's dirty-check see the same reference and
    // silently skip the POST (CLA-368).
    const newBuffs = [...activeBuffs.filter(b => b.name !== 'Starry Form'), buffEntry];
    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    const storedEffects = getRuntimeValue('campaign', 'targetEffects');
    const allTargetEffects = Array.isArray(storedEffects) ? storedEffects : [];
    const starryTargetEffect = {
        effect: 'starry_form',
        source: playerName,
        target: playerName,
        constellation: optionName,
        duration: '1_minute',
    };
    const newTargetEffects = [...allTargetEffects.filter(te => te.effect !== 'starry_form' || te.source !== playerName), starryTargetEffect];
    setRuntimeValue('campaign', 'targetEffects', newTargetEffects, campaignName, true);

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

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} changed Starry Form constellation to ${optionName} with Twinkling Constellations. ${optionEffects.join('. ')}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[twinklingConstellationHandler:log-error]", e); });

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
