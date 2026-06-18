import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const options = auto.options || [];

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
    const targetName = target?.name || null;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} used${targetName ? ` against ${targetName}` : ''}`,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    const saveDc = buildSaveDc(auto, playerStats);

    if (options.length > 0) {
        return {
            type: 'modal',
            modalName: 'telekineticThrust',
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
            description: `${action.name} ready. The next Psionic Strike hit will trigger it.`,
            automation: auto,
        },
    };
}

export async function applyTelekineticThrust(action, playerStats, campaignName, targetName, saveDc, saveType) {
    const auto = action.automation;
    const options = auto.options || [];
    const chosenOption = options[0];
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

    await addEntry(campaignName, {
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

    await addEntry(campaignName, {
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
        await applyThrustEffect(action, playerStats, campaignName, targetName, chosenOption);
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

async function applyThrustEffect(action, playerStats, campaignName, targetName, option) {
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

    // Apply prone condition to the target
    const combatContext = await getCombatContext(campaignName);
    if (combatContext && combatContext.creatures) {
        const targetCreature = combatContext.creatures.find(c => c.name === targetName);
        if (targetCreature) {
            const conditions = targetCreature.conditions || [];
            const proneAlready = conditions.some(c => c.key === 'prone');
            if (!proneAlready) {
                conditions.push({ key: 'prone', source: action.name });
                setRuntimeValue(campaignName, 'combatContext', combatContext, campaignName);
            }
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
    if (option.effect === 'prone_and_push') {
        return `${option.name} — target falls Prone and is pushed ${option.value || 10} ft away`;
    }
    return option.name;
}
