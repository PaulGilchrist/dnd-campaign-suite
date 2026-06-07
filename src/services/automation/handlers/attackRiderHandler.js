import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../rules/damageUtils.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const options = auto.options || [];

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
    const targetName = target?.name || null;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} used${targetName ? ` against ${targetName}` : ''}`,
    }).catch(() => {});

    if (options.length > 0 && (auto.chooseOne || (auto.maxEffects || 1) > 1)) {
        return {
            type: 'modal',
            modalName: 'attackRider',
            payload: {
                action,
                playerStats,
                campaignName,
                targetName,
            },
        };
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} ready. The next eligible attack will apply it.`,
            automation: auto,
        },
    };
}

export async function applyRiderOption(action, playerStats, campaignName, targetName, optionNames) {
    const auto = action.automation;
    const options = auto.options || [];

    const names = Array.isArray(optionNames) ? optionNames : [optionNames];
    const chosenOptions = names.map(name => options.find(o => o.name === name)).filter(Boolean);
    if (chosenOptions.length === 0) return null;

    setRuntimeValue(playerStats.name, 'pendingRiderChoice', null, campaignName);

    const results = [];
    for (const chosen of chosenOptions) {
        const res = await applyRiderEffect(action, playerStats, campaignName, targetName, chosen);
        results.push(res);
    }

    if (results.length === 1) {
        return results[0];
    }

    const effectDescriptions = chosenOptions.map(opt => {
        let desc = opt.name;
        if (opt.effect === 'disadvantage_on_next_save') desc += ' — target has Disadvantage on the next saving throw it makes';
        if (opt.noOpportunityAttacks) desc += ' — target cannot make Opportunity Attacks until the start of your next turn';
        if (opt.effect === 'next_attack_advantage') desc += ` — the next attack against ${targetName || 'target'} gains +${opt.value || '5'}`;
        if (opt.effect === 'push_15ft') desc += ' — target pushed 15 ft away';
        if (opt.effect === 'speed_reduction') desc += ' — target Speed reduced by 15 ft';
        return desc;
    });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation.type,
            description: `Applied to ${targetName || 'target'}:<br/>• ${effectDescriptions.join('<br/>• ')}`,
            automation: action.automation,
        },
    };
}

async function applyRiderEffect(action, playerStats, campaignName, targetName, option) {
    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: action.automation.type,
                description: `${option.name}: ${option.effect}<br/><br/><i>No target selected — effect noted for manual application.</i>`,
                automation: action.automation,
            },
        };
    }

    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const newEffect = {
        target: targetName,
        source: action.name,
        option: option.name,
        effect: option.effect,
        value: option.value || null,
        noOpportunityAttacks: option.noOpportunityAttacks || false,
        duration: 'until_start_of_next_turn',
    };
    const updatedEffects = [...storedEffects, newEffect];
    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation.type,
            description: `${option.name} applied to ${targetName}${option.noOpportunityAttacks ? ' — target cannot make Opportunity Attacks until the start of your next turn.' : ''}${option.effect === 'disadvantage_on_next_save' ? ' — target has Disadvantage on the next saving throw it makes.' : ''}${option.effect === 'next_attack_advantage' ? ` — the next attack against ${targetName} gains +${option.value || '5'}.` : ''}`,
            automation: action.automation,
        },
    };
}
