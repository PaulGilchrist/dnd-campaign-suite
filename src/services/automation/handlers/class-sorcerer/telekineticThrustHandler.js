import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { buildResultMessage } from '../../common/buildResultMessage.js';
import storage from '../../../../services/ui/storage.js';
import { addCondition } from '../../../combat/conditions/conditionSaveService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const options = auto.options || [];

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
    const targetName = target?.name || null;

    // CLA-355: once per Short or Long Rest uses gate (null = re-armed by rest).
    if (options.length > 0) {
        const thrustMax = playerStats._trackedResources?.telekineticThrustUses?.max ?? 1;
        const thrustUses = Number(getRuntimeValue(playerStats.name, 'telekineticThrustUses', campaignName) ?? thrustMax);
        if (thrustUses <= 0) {
            await addEntry(campaignName, {
                type: 'automation',
                characterName: playerStats.name,
                automationType: 'telekinetic_thrust_refused',
                name: action.name,
                description: `${action.name} has no uses remaining. Recharges when you finish a Short or Long Rest.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[telekineticThrustHandler:log-error]", e); });
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name}: No uses remaining. Recharges when you finish a Short or Long Rest.`,
                    automation: auto,
                },
            };
        }
        if (!targetName) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name}: No target selected — no use spent.`,
                    automation: auto,
                },
            };
        }
        await setRuntimeValue(playerStats.name, 'telekineticThrustUses', thrustUses - 1, campaignName);
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} used${targetName ? ` against ${targetName}` : ''}`,
    }).catch((e) => { console.error("[telekineticThrustHandler:log-error]", e); });

    const saveDc = buildSaveDc(auto, playerStats);

    if (options.length > 0) {
        return applyTelekineticThrust(action, playerStats, campaignName, targetName, saveDc, auto.saveType || 'STR');
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
    }).catch((e) => { console.error("[telekineticThrust] Error:", e); });

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
    }).catch((e) => { console.error("[telekineticThrust] Error:", e); });

    if (!success) {
        await applyThrustEffect({ action, playerStats, campaignName, targetName, option: chosenOption, saveDc, saveType });
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

async function applyThrustEffect({ action, playerStats, campaignName, targetName, option, saveDc, saveType }) {
    if (!targetName) return;

    const combatContext = await getCombatContext(campaignName);
    if (!combatContext || !combatContext.creatures) return;

    const targetCreature = combatContext.creatures.find(c => c.name === targetName);
    if (!targetCreature) return;

    const proneAlready = targetCreature.conditions?.some(c => c.key === 'prone');
    if (proneAlready) return;

    const conditionDef = { key: 'prone', label: 'Prone' };
    addCondition({ combatSummary: combatContext, creatureName: targetName, conditionDef, dc: saveDc, ability: saveType, getRuntimeValue, setRuntimeValue, campaignName, playerStats });
    storage.set('combatSummary', combatContext, campaignName);

    const pushValue = option.value || 10;
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} knocked ${targetName} Prone and pushed ${pushValue} feet away.`,
        targetName: targetName,
    }).catch((e) => { console.error("[telekineticThrustHandler:log-error]", e); });
}
