import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

const QUIVERING_PALM_EFFECT = 'quivering_palm';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    const targetName = target?.name || null;

    const existingTarget = getRuntimeValue(campaignName, QUIVERING_PALM_EFFECT);

    if (existingTarget) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${action.name} — Vibrations already active against ${existingTarget}. Use again to release or trigger shockwave.`,
        }).catch(() => {});

        return {
            type: 'modal',
            modalName: 'quiveringPalm',
            payload: {
                action,
                playerStats,
                campaignName,
                targetName: existingTarget,
                isRelease: false,
            },
        };
    }

    const lastAttack = cs?.lastAttack;
    const isMonkAttacker = lastAttack?.attackerName === playerName;
    const isUnarmedStrike = lastAttack?.attackName === 'Unarmed Strike';
    const attackHit = lastAttack?.saveResult === 'success' || lastAttack?.hit === true || lastAttack?.total >= (lastAttack?.targetAc || 10);

    if (!isMonkAttacker) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${action.name} — Last attack was not made by ${playerName}.`,
        }).catch(() => {});

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} — Last attack was not made by you.`,
                automation: auto,
            },
        };
    }

    if (!isUnarmedStrike) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${action.name} — Last attack was not an Unarmed Strike.`,
        }).catch(() => {});

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} — Last attack was not an Unarmed Strike.`,
                automation: auto,
            },
        };
    }

    if (!attackHit) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${action.name} — Last Unarmed Strike did not hit.`,
        }).catch(() => {});

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} — Last Unarmed Strike did not hit.`,
                automation: auto,
            },
        };
    }

    if (!targetName) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${action.name} — No target selected.`,
        }).catch(() => {});

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} — No target selected.`,
                automation: auto,
            },
        };
    }

    const cost = auto.cost?.amount || 3;
    const resource = auto.cost?.resource || 'kiPoints';
    const maxResource = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.focus_points || 0;
    const currentResource = Number(getRuntimeValue(playerName, resource, campaignName) ?? maxResource);

    if (currentResource < cost) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${action.name} — Not enough ${resource === 'focusPoints' ? 'Focus Points' : 'Ki Points'}. ${currentResource}/${cost} required.`,
        }).catch(() => {});

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `Not enough ${resource === 'focusPoints' ? 'Focus Points' : 'Ki Points'}. ${currentResource}/${cost} required.`,
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, resource, currentResource - cost, campaignName);
    await setRuntimeValue(campaignName, QUIVERING_PALM_EFFECT, targetName, campaignName);

    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const newEffect = {
        target: targetName,
        source: action.name,
        option: 'Quivering Palm',
        effect: 'quivering_palm',
        value: null,
        duration: 'until_end',
        noOpportunityAttacks: false,
        saveType: null,
        condition: null,
    };
    const updatedEffects = [...storedEffects, newEffect];
    await setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} set lethal vibrations in ${targetName}'s body. Use the feature again to release the vibrations or trigger a shockwave.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `Quivering Palm set in ${targetName}. Use the feature again to release the vibrations or trigger a shockwave.`,
            automation: auto,
        },
    };
}

export async function applyShockwave(action, playerStats, campaignName, targetName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    await setRuntimeValue(campaignName, QUIVERING_PALM_EFFECT, null, campaignName);
    await cleanupQuiveringPalmEffect(campaignName, targetName);

    const damageExpression = auto.damageExpression || '10d12';
    const damageType = auto.damageType || 'Force';
    const saveDc = buildSaveDc(auto, playerStats);
    const saveType = 'CON';

    addEntry(campaignName, {
        type: 'roll',
        name: action.name,
        characterName: playerName,
        rollType: 'save-damage',
        targetName,
        saveDc,
        saveType,
        description: `${action.name} — ${targetName} must make a CON saving throw (DC ${saveDc}) or take ${damageExpression} ${damageType} damage.`,
    }).catch((e) => { console.error('[quiveringPalm] Error:', e); });

    const { promise } = createSaveListener(campaignName, {
        targetName,
        saveType,
        saveDc,
        actionName: action.name,
        attackerName: playerName,
    });

    const saveResult = await promise;
    const success = saveResult.success;

    const rawDamage = rollExpression(damageExpression)?.total || 0;
    const finalDamage = success ? Math.floor(rawDamage / 2) : rawDamage;

    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
    const cs = getCombatSummary(campaignName);

    if (cs) {
        applyDamageToTarget(cs, targetName, rawDamage, [damageType], campaignName, characters, false, playerName);
    }

    addEntry(campaignName, {
        type: 'roll',
        name: action.name,
        characterName: playerName,
        rollType: 'save-damage',
        targetName,
        saveDc,
        saveType,
        saveResult: success ? 'success' : 'failure',
        total: saveResult.total ?? 0,
        rolls: [saveResult.roll ?? 0],
        bonus: saveResult.saveBonus ?? 0,
        formula: `1d20${saveResult.saveBonus !== 0 ? '+' + saveResult.saveBonus : ''}`,
        description: `${action.name} — ${targetName} ${success ? 'succeeded' : 'failed'} the CON save (DC ${saveDc}). ${success ? 'Half damage (' + finalDamage + ' ' + damageType + ')' : 'Full damage (' + finalDamage + ' ' + damageType + ')'}${!success ? '' : ''}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[quiveringPalm] Error:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${targetName} rolled a ${saveType} save (DC ${saveDc}): <strong>${success ? 'Success' : 'Failure'}</strong>.<br/>${success ? 'Half damage: ' : 'Full damage: '}${finalDamage} ${damageType} damage.`,
            automation: auto,
        },
    };
}

export async function applyRelease(action, playerStats, campaignName, targetName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    await setRuntimeValue(campaignName, QUIVERING_PALM_EFFECT, null, campaignName);
    await cleanupQuiveringPalmEffect(campaignName, targetName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} released the vibrations harmlessly against ${targetName}.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `Vibrations released harmlessly against ${targetName}.`,
            automation: auto,
        },
    };
}

async function cleanupQuiveringPalmEffect(campaignName, targetName) {
    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const updatedEffects = storedEffects.filter(e => !(e.effect === QUIVERING_PALM_EFFECT && e.target === targetName));
    await setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
}
