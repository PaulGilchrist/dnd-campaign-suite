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

    const existingTarget = getRuntimeValue('campaign', QUIVERING_PALM_EFFECT);

    if (existingTarget) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${action.name} — Vibrations already active against ${existingTarget}. Use again to release or trigger shockwave.`,
        }).catch((e) => { console.error("[quiveringPalmHandler:log-error]", e); });

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

    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    const isMonkAttacker = lastAttack?.attackerName === playerName;
    const isUnarmedStrike = lastAttack?.attackName === 'Unarmed Strike';
    const attackHit = didLastAttackHit(lastAttack);

    if (!isMonkAttacker) {
        return refusal(action, auto, playerName, campaignName,
            `${action.name} — Last attack was not made by ${playerName}.`,
            `${action.name} — Last attack was not made by you.`);
    }

    if (!isUnarmedStrike) {
        return refusal(action, auto, playerName, campaignName,
            `${action.name} — Last attack was not an Unarmed Strike.`);
    }

    if (!attackHit) {
        return refusal(action, auto, playerName, campaignName,
            `${action.name} — Last Unarmed Strike did not hit.`);
    }

    if (!targetName) {
        return refusal(action, auto, playerName, campaignName,
            `${action.name} — No target selected.`);
    }

    const cost = auto.cost?.amount || 3;
    const resource = auto.cost?.resource || 'kiPoints';
    const resourceLabel = resource === 'focusPoints' ? 'Focus Points' : 'Ki Points';
    const maxResource = monkFocusPointMax(playerStats);
    const currentResource = Number(getRuntimeValue(playerName, resource, campaignName) ?? maxResource);

    if (currentResource < cost) {
        return refusal(action, auto, playerName, campaignName,
            `${action.name} — Not enough ${resourceLabel}. ${currentResource}/${cost} required.`,
            `Not enough ${resourceLabel}. ${currentResource}/${cost} required.`);
    }

    await setRuntimeValue(playerName, resource, currentResource - cost, campaignName);
    await setRuntimeValue('campaign', QUIVERING_PALM_EFFECT, targetName, campaignName);

    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
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
    await setRuntimeValue('campaign', 'targetEffects', updatedEffects, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} set lethal vibrations in ${targetName}'s body. Use the feature again to release the vibrations or trigger a shockwave.`,
    }).catch((e) => { console.error("[quiveringPalmHandler:log-error]", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `Quivering Palm set on ${targetName}. Use the feature again to release the vibrations or trigger a shockwave.`,
            automation: auto,
        },
    };
}

function refusal(action, auto, playerName, campaignName, logDescription, popupDescription = logDescription) {
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: logDescription,
    }).catch((e) => { console.error("[quiveringPalmHandler:log-error]", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: popupDescription,
            automation: auto,
        },
    };
}

function didLastAttackHit(lastAttack) {
    return lastAttack?.saveResult === 'success' || lastAttack?.hit === true || lastAttack?.total >= (lastAttack?.targetAc || 10);
}

function monkFocusPointMax(playerStats) {
    return playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.focus_points || 0;
}

export async function applyShockwave(action, playerStats, campaignName, targetName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    await setRuntimeValue('campaign', QUIVERING_PALM_EFFECT, null, campaignName);
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

    const damageRoll = rollExpression(damageExpression);
    const rawDamage = damageRoll?.total || 0;
    const finalDamage = success ? Math.floor(rawDamage / 2) : rawDamage;

    applyShockwaveDamage(campaignName, playerName, targetName, finalDamage, damageType);

    addEntry(campaignName, buildShockwaveResultLog(action, {
        playerName, targetName, saveDc, saveType, success, saveResult, damageRoll, rawDamage, finalDamage, damageType, damageExpression,
    })).catch((e) => { console.error('[quiveringPalm] Error:', e); });

    const diceDisplay = damageRoll?.rolls?.length > 0 ? ` (${damageRoll.rolls.join(', ')})` : '';

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${targetName} rolled a ${saveType} save (DC ${saveDc}): <strong>${success ? 'Success' : 'Failure'}</strong>.<br/>${damageExpression}: ${rawDamage}${diceDisplay}<br/>${success ? 'Half damage' : 'Full damage'}: <strong>${finalDamage}</strong> ${damageType} damage.`,
            automation: auto,
            success,
            saveType,
            saveDc,
            rawDamage,
            finalDamage,
            damageExpression,
            damageType,
            diceDisplay,
            saveRoll: saveResult.roll ?? 0,
            saveBonus: saveResult.saveBonus ?? 0,
        },
    };
}

function applyShockwaveDamage(campaignName, playerName, targetName, finalDamage, damageType) {
    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
    const cs = getCombatSummary(campaignName);
    if (!cs) return;
    const applyResult = applyDamageToTarget(cs, targetName, finalDamage, [damageType], campaignName, characters, false, playerName);
    const actualDamage = applyResult?.finalDamage ?? finalDamage;
    if (actualDamage !== finalDamage) {
        console.error(`[quiveringPalm] Damage adjusted by resistances: ${finalDamage} → ${actualDamage}`);
    }
}

function buildShockwaveResultLog(action, { playerName, targetName, saveDc, saveType, success, saveResult, damageRoll, rawDamage, finalDamage, damageType, damageExpression }) {
    return {
        type: 'roll',
        name: action.name,
        characterName: playerName,
        rollType: 'save-damage',
        targetName,
        saveDc,
        saveType,
        saveResult: success ? 'success' : 'failure',
        saveRoll: saveResult.roll ?? 0,
        saveBonus: saveResult.saveBonus ?? 0,
        saveFormula: `1d20${saveResult.saveBonus !== 0 ? '+' + saveResult.saveBonus : ''}`,
        formula: damageExpression,
        rolls: damageRoll?.rolls || [],
        total: rawDamage,
        modifier: damageRoll?.modifier || 0,
        damageType,
        finalDamage,
        description: `${action.name} — ${targetName} ${success ? 'succeeded' : 'failed'} the CON save (DC ${saveDc}). ${success ? 'Half damage' : 'Full damage'}: **${finalDamage}** ${damageType} damage.`,
        timestamp: Date.now(),
    };
}

export async function applyRelease(action, playerStats, campaignName, targetName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    await setRuntimeValue('campaign', QUIVERING_PALM_EFFECT, null, campaignName);
    await cleanupQuiveringPalmEffect(campaignName, targetName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} released the vibrations harmlessly against ${targetName}.`,
    }).catch((e) => { console.error("[quiveringPalmHandler:log-error]", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `Vibrations released harmlessly against ${targetName}.`,
            automation: auto,
            isRelease: true,
        },
    };
}

async function cleanupQuiveringPalmEffect(campaignName, targetName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const updatedEffects = storedEffects.filter(e => !(e.effect === QUIVERING_PALM_EFFECT && e.target === targetName));
    await setRuntimeValue('campaign', 'targetEffects', updatedEffects, campaignName);
}
