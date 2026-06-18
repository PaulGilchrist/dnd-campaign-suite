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
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

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
                saveType: auto.saveType || 'STR',
            },
        };
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} — target must succeed on a ${auto.saveType || 'STR'} saving throw (DC ${saveDc}) or be affected by one of the Open Hand Technique effects.`,
            automation: auto,
        },
    };
}

export async function applyOpenHandTechnique(action, playerStats, campaignName, targetName, selectedOptionName, saveDc, saveType) {
    const auto = action.automation;
    const options = auto.options || [];
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

    const { promise } = createSaveListener(campaignName, {
        targetName,
        saveType,
        saveDc,
    });

    addEntry(campaignName, {
        type: 'roll',
        name: action.name,
        characterName: playerStats.name,
        rollType: 'save-damage',
        targetName,
        saveDc,
        saveType,
        description: `${action.name} — ${targetName} must make a ${saveType} saving throw (DC ${saveDc}).`,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    const saveResult = await promise;
    const success = saveResult.success;

    addEntry(campaignName, {
        type: 'roll',
        name: action.name,
        characterName: playerStats.name,
        rollType: 'save-damage',
        targetName,
        saveDc,
        saveType,
        saveResult: success ? 'success' : 'failure',
        total: saveResult.total ?? 0,
        rolls: [saveResult.roll ?? 0],
        bonus: saveResult.saveBonus ?? 0,
        formula: `1d20${saveResult.saveBonus !== 0 ? '+' + saveResult.saveBonus : ''}`,
        timestamp: Date.now(),
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    if (!success) {
        await applyOpenHandEffect(action, playerStats, campaignName, targetName, chosenOption);
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: buildResultMessage(action.name, targetName, chosenOption, saveDc, saveType, success),
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
    };
    const updatedEffects = [...storedEffects, newEffect];
    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
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
    if (option.effect === 'disadvantage_next_attack') return `${option.name} — target has Disadvantage on its next attack roll`;
    if (option.effect === 'no_reactions') return `${option.name} — target can't take Reactions until the start of your next turn`;
    return option.name;
}
