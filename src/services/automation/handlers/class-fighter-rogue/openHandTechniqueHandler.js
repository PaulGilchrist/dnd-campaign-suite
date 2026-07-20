import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
    const targetName = target?.name || null;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} used${targetName ? ` against ${targetName}` : ''}`,
    }).catch(() => {});

    const saveDc = buildSaveDc(auto, playerStats);

    if (auto.options && auto.options.length > 0) {
        return {
            type: 'modal',
            modalName: 'openHandTechnique',
            payload: {
                action,
                playerStats,
                campaignName,
                targetName,
                saveDc,
            },
        };
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} — target must succeed on a saving throw (DC ${saveDc}) or be affected by one of the Open Hand Technique effects.`,
            automation: auto,
        },
    };
}

export async function applyOpenHandTechnique(action, playerStats, campaignName, targetName, selectedOptionName, saveDc) {
    const auto = action.automation || {};
    const options = auto.options || action.options || [];
    const chosenOption = options.find(o => o.name === selectedOptionName);
    if (!chosenOption) return null;

    setRuntimeValue(playerStats.name, 'pendingRiderChoice', null, campaignName);

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${chosenOption.name} — <i>No target selected — effect noted for manual application.</i>`,
                automation: auto,
            },
        };
    }

    if (chosenOption.effect === 'addled') {
        await applyOpenHandEffect(action, playerStats, campaignName, targetName, chosenOption);
        addEntry(campaignName, {
            type: 'roll',
            name: action.name,
            characterName: playerStats.name,
            rollType: 'save-damage',
            targetName,
            saveDc,
            description: `${action.name} — ${chosenOption.name}: ${targetName} cannot make Opportunity Attacks until the start of its next turn.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[openHandTechnique] Error:", e); });
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${chosenOption.name} — ${targetName} cannot make Opportunity Attacks until the start of its next turn.`,
                automation: auto,
            },
        };
    }

    const optionSaveType = chosenOption.saveType || 'STR';
    const { promise } = createSaveListener(campaignName, {
        targetName,
        saveType: optionSaveType,
        saveDc,
    });

    addEntry(campaignName, {
        type: 'roll',
        name: action.name,
        characterName: playerStats.name,
        rollType: 'save-damage',
        targetName,
        saveDc,
        saveType: optionSaveType,
        description: `${action.name} — ${chosenOption.name}: ${targetName} must make a ${optionSaveType} saving throw (DC ${saveDc}).`,
    }).catch((e) => { console.error("[openHandTechnique] Error:", e); });

    const saveResult = await promise;
    const success = saveResult.success;

    addEntry(campaignName, {
        type: 'roll',
        name: action.name,
        characterName: playerStats.name,
        rollType: 'save-damage',
        targetName,
        saveDc,
        saveType: optionSaveType,
        saveResult: success ? 'success' : 'failure',
        total: saveResult.total ?? 0,
        rolls: [saveResult.roll ?? 0],
        bonus: saveResult.saveBonus ?? 0,
        formula: `1d20${saveResult.saveBonus !== 0 ? '+' + saveResult.saveBonus : ''}`,
        description: `${chosenOption.name} — ${targetName} ${success ? 'succeeded' : 'failed'} the ${optionSaveType} save (DC ${saveDc}).${!success ? ' Effect applied.' : ''}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[openHandTechnique] Error:", e); });

    if (!success) {
        await applyOpenHandEffect(action, playerStats, campaignName, targetName, chosenOption);
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: buildResultMessage(action.name, targetName, chosenOption, saveDc, optionSaveType, success),
            automation: auto,
        },
    };
}

async function applyOpenHandEffect(action, playerStats, campaignName, targetName, option) {
    if (!targetName) return;

    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const newEffect = {
        target: targetName,
        source: action.name,
        option: option.name,
        effect: option.effect,
        value: option.value || null,
        duration: 'until_start_of_next_turn',
        noOpportunityAttacks: option.noOpportunityAttacks || false,
        saveType: option.saveType || null,
        condition: option.condition || null,
    };
    const updatedEffects = [...storedEffects, newEffect];
    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

    if (option.effect === 'prone') {
        const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const alreadyProne = conditions.some(c => String(c).toLowerCase() === 'prone');
        if (!alreadyProne) {
            setRuntimeValue(targetName, 'activeConditions', [...conditions, 'prone'], campaignName);
        }
    }

    if (option.noOpportunityAttacks) {
        const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const alreadyAddled = conditions.some(c => String(c).toLowerCase() === 'addled');
        if (!alreadyAddled) {
            setRuntimeValue(targetName, 'activeConditions', [...conditions, 'addled'], campaignName);
        }
    }
}

function buildResultMessage(actionName, targetName, option, saveDc, saveType, success) {
    const effectDesc = getEffectDescription(option);
    if (success) {
        return `${targetName} rolled a ${saveType} save (DC ${saveDc}): <strong>Success</strong>.<br/>No effect applied.`;
    }
    return `${targetName} rolled a ${saveType} save (DC ${saveDc}): <strong>Failure</strong>.<br/>${effectDesc} applied to ${targetName}.`;
}

function getEffectDescription(option) {
    if (option.effect === 'push_15ft') return `${option.name} — target pushed 15 ft away`;
    if (option.effect === 'prone') return `${option.name} — target gains the Prone condition`;
    if (option.effect === 'addled') return `${option.name} — target cannot make Opportunity Attacks`;
    if (option.effect === 'disadvantage_next_attack') return `${option.name} — target has Disadvantage on its next attack roll`;
    if (option.effect === 'no_reactions') return `${option.name} — target can't take Reactions until the start of your next turn`;
    return option.name;
}
