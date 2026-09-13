import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const CONSTELLATION_OPTIONS = ['Archer', 'Chalice', 'Dragon'];

const CONSTELLATION_OPTION_DESCRIPTIONS = {
    Archer: (isTwinkled) => [`Ranged Spell Attack: ${isTwinkled ? '2d8' : '1d8'} + Wisdom Modifier Radiant damage`],
    Chalice: (isTwinkled) => [`Healing Spell Ally Buff: ${isTwinkled ? '2d8' : '1d8'} + Wisdom Modifier HP to ally within 30 feet`],
    Dragon: (isTwinkled) => {
        const effects = ['Concentration Benefit: Treat d20 rolls of 9 or lower on Concentration checks/saves as 10'];
        if (isTwinkled) {
            effects.push('Fly Speed 20 feet (hover)');
        }
        return effects;
    },
};

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const level = playerStats.level || 1;
    const isTwinkled = level >= 10;

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const hasStarryFormActive = activeBuffs.some(b => b.name === 'Starry Form' && b.constellation);

    if (!hasStarryFormActive || !isTwinkled) {
        const usesKey = 'wildShapeUses';
        const usesMax = auto.uses || 0;
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        const maxWildShapeUses = classLevel?.wild_shape || 0;

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
            const resourceKey = 'wildShapeUses';
            const storedResource = getRuntimeValue(playerName, resourceKey, campaignName);
            const currentResource = storedResource != null ? Number(storedResource) : maxWildShapeUses;
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
    const existingStarryFormIndex = activeBuffs.findIndex(b => b.name === 'Starry Form');
    if (existingStarryFormIndex !== -1) {
        activeBuffs.splice(existingStarryFormIndex, 1);
    }
    const buffEntry = {
        name: action.name,
        effect: 'starry_form',
        constellation: optionName,
        duration: auto.duration || '1_minute',
        hasAutomation: true,
        resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
    };
    if (optionName === 'Dragon' && isTwinkled) {
        buffEntry.effect = 'fly_speed_20_hover';
        buffEntry.flySpeed = 20;
    }
    const newBuffs = [...activeBuffs, buffEntry];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const starryTargetEffect = {
        effect: 'starry_form',
        source: playerName,
        target: playerName,
        constellation: optionName,
        duration: auto.duration || '1_minute',
    };
    const newTargetEffects = [...allTargetEffects.filter(te => te.effect !== 'starry_form' || te.source !== playerName), starryTargetEffect];
    setRuntimeValue('campaign', 'targetEffects', newTargetEffects, campaignName, true);

    const describeOption = CONSTELLATION_OPTION_DESCRIPTIONS[optionName];
    const optionEffects = describeOption ? describeOption(isTwinkled) : [];

    const description = `${optionName} constellation chosen. ${optionEffects.join('. ')}.`;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} assumed Starry Form with the ${optionName} constellation. ${optionEffects.join('. ')}. Wild Shape use consumed.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[starryFormHandler:log-error]", e); });

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
