import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

function resolveResistanceTypes(resistanceTypes) {
    return resistanceTypes.flatMap(rt => {
        if (rt === 'all_except_force_necrotic_psychic_radiant') {
            return ['acid', 'bludgeoning', 'cold', 'fire', 'lightning', 'piercing', 'poison', 'slashing', 'thunder'];
        }
        return rt;
    });
}

function getOptionProperty(option, prop, defaultValue) {
    const val = option[prop];
    return val != null ? val : defaultValue;
}

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

    const options = auto.options || [];
    if (options.length > 0) {
        return {
            type: 'modal',
            modalName: 'combatStance',
            payload: { action, playerStats, campaignName },
        };
    }

    return activateStance(action, playerStats, campaignName, null);
}

export async function applyStanceOption(action, playerStats, campaignName, optionName) {
    const auto = action.automation;
    const options = auto.options || [];
    const chosenOption = options.find(o => o.name === optionName);
    if (!chosenOption) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `Invalid option: ${optionName}`,
                automation: auto,
            },
        };
    }
    return activateStance(action, playerStats, campaignName, chosenOption);
}

async function activateStance(action, playerStats, campaignName, chosenOption) {
    const auto = action.automation;
    const playerName = playerStats.name;
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

    const resistanceTypes = chosenOption
        ? resolveResistanceTypes(getOptionProperty(chosenOption, 'resistanceTypes', []))
        : (auto.resistanceTypes || []);

    const buff = {
        name: action.name,
        effect: auto.effect || 'stance',
        duration: auto.duration || '1_minute',
        resistanceTypes,
        advantages: auto.advantages || [],
        damageBonusExpression: auto.damageBonusExpression || '',
        blocksSpellcasting: auto.blocksSpellcasting || false,
        optionName: chosenOption ? chosenOption.name : null,
    };
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const newBuffs = [...activeBuffs, buff];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    if (action.name === 'Rage') {
        const currentConditions = getRuntimeValue(playerName, 'activeConditions', campaignName) || [];
        if (Array.isArray(currentConditions)) {
            const filtered = currentConditions.filter(c => {
                const lower = String(c).toLowerCase();
                return lower !== 'charmed' && lower !== 'frightened';
            });
            if (filtered.length !== currentConditions.length) {
                setRuntimeValue(playerName, 'activeConditions', filtered, campaignName);
            }
        }
    }

    let description = `${action.name} activated (${currentResource - 1} use(s) remaining)`;
    if (chosenOption) {
        const optionEffects = [];
        if (chosenOption.name === 'Bear') {
            optionEffects.push('Resistance to Acid, Bludgeoning, Cold, Fire, Lightning, Piercing, Poison, Slashing, Thunder');
        } else if (chosenOption.name === 'Eagle') {
            optionEffects.push('You can take the Disengage and Dash action as part of this Bonus Action. While raging, you can take a Bonus Action to do both again.');
        } else if (chosenOption.name === 'Wolf') {
            optionEffects.push('While raging, allies have Advantage on attack rolls against enemies within 5 feet of you.');
        }
        description = `${chosenOption.name} chosen. ${optionEffects.join(' ')} (${currentResource - 1} use(s) remaining)`;
    }

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
