import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';
import { buildResultMessage } from '../../../automation/common/buildResultMessage.js';
import { addCondition } from '../../../../services/combat/conditions/conditionSaveService.js';
import utils from '../../../../services/ui/utils.js';

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
    }).catch((e) => { console.error("[openHandTechniqueHandler:log-error]", e); });

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
        const combatSummary = await getCombatContext(campaignName);
        await applyOpenHandEffect({ action, playerStats, campaignName, targetName, option: chosenOption, saveDc, combatSummary });
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
        const combatSummary = await getCombatContext(campaignName);
        await applyOpenHandEffect({ action, playerStats, campaignName, targetName, option: chosenOption, saveDc, combatSummary, saveType: optionSaveType });
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

async function applyOpenHandEffect({ action, playerStats, campaignName, targetName, option, saveDc, combatSummary, saveType }) {
    if (!targetName) return;

    // Push effects are instant — just log, no targetEffect
    if (option.effect === 'push_15ft') {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${playerStats.name} pushed ${targetName} 15 feet away.`,
            targetName: targetName,
        }).catch((e) => { console.error("[openHandTechniqueHandler:log-error]", e); });
        return;
    }

    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
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
    setRuntimeValue('campaign', 'targetEffects', updatedEffects, campaignName);

    if (option.effect === 'prone') {
        const conditionDef = { key: 'prone', label: 'Prone' };
        addCondition({ combatSummary, creatureName: targetName, conditionDef, dc: saveDc, ability: saveType || 'STR', getRuntimeValue, setRuntimeValue, campaignName, playerStats: findOpenHandTargetStats(playerStats, campaignName, targetName) });
    }

    if (option.noOpportunityAttacks) {
        const conditionDef = { key: 'addled', label: 'Addled' };
        addCondition({ combatSummary, creatureName: targetName, conditionDef, dc: saveDc, ability: saveType || 'STR', getRuntimeValue, setRuntimeValue, campaignName, playerStats: findOpenHandTargetStats(playerStats, campaignName, targetName) });
    }
}

function findOpenHandTargetStats(playerStats, campaignName, targetName) {
    if (!playerStats.name) return null;
    const targetCharacter = (getRuntimeValue('characters', 'characters', campaignName) || []).find(c => utils.getName(c.name) === targetName);
    return targetCharacter?.computedStats || targetCharacter;
}
