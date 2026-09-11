import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getManeuversForRules } from './combatSuperiorityQueries.js';
import {
    checkSuperiorityDice,
    expendSuperiorityDie,
    rollManeuverDie,
    buildManeuverNotFoundPopup,
    buildNoDiceRemainingPopup,
    processManeuverSaveResult,
    buildManeuverSaveDescription,
} from './combatSuperiorityUtils.js';
import { validateSizeLimit } from './executeManeuver.js';

export async function applyManeuveringAllyGrant(allyName, casterName, targetName, campaignName) {
    const cs = await getCombatContext(campaignName);
    const ally = cs?.creatures?.find(c => c.name === allyName);
    const halfSpeed = Math.floor((ally?.speed || 30) / 2);

    await setRuntimeValue(allyName, 'maneuveringStepGranted', true, campaignName);
    await setRuntimeValue(allyName, 'maneuveringStepNoOA', true, campaignName);
    await setRuntimeValue(allyName, 'maneuveringStepNoOASource', targetName || null, campaignName);
    addExpiration(casterName, allyName, [
        { type: 'maneuvering_step_granted' }
    ], campaignName, undefined, casterName);

    const description = `Maneuvering Attack: ${allyName} can move up to half their Speed (${halfSpeed} ft) using their Reaction without provoking Opportunity Attacks from ${targetName || 'the target'}.`;
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Maneuvering Attack',
        description,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[maneuveringAttack:grant-log-error]', e); });

    return { halfSpeed, description };
}

async function applyBrutalStrikeRider(maneuver, targetName, playerStats, campaignName, dieValue, dieDescription, description) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const newEffect = {
        target: targetName,
        source: maneuver.name,
        effect: 'secondary_damage',
        value: dieValue,
        damageType: maneuver.damageType || 'force',
        duration: 'instant',
        saveType: null,
        saveDc: null,
        saveAbility: null,
    };
    const updatedEffects = [...storedEffects, newEffect];
    setRuntimeValue('campaign', 'targetEffects', updatedEffects, campaignName);

    const cs = await getCombatContext(campaignName);
    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
    if (cs && targetName) {
        const result = applyDamageToTarget(cs, targetName, dieValue, [maneuver.damageType || 'force'], campaignName, characters, false, playerStats.name);
        if (result.finalDamage > 0) {
            description += ` ${targetName} takes ${result.finalDamage} ${maneuver.damageType || 'force'} damage.`;
        }
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `${maneuver.name}: ${dieDescription} ${targetName} takes ${dieValue} ${maneuver.damageType || 'force'} damage.`,
    };

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
        },
        logEntries: [logEntry],
    };
}

// MN-018: reuse the ORIGINAL attack roll vs the SECOND creature's AC; offer a
// real chooser gated to creatures within 5 feet of the original target; carry
// the REAL original damageType (was hardcoded 'slashing'); stash RAW combatants
// into pendingSweepingAttack (CLA-326 shape) so the confirm applies real damage.
async function resolveSweepingAttack(maneuver, auto, targetName, playerStats, campaignName, attackInfo, dieValue, dieDescription) {
    const cs = await getCombatContext(campaignName);
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    const damageType = attackInfo?.damageType || lastAttack?.damageType || maneuver.damageType || (console.error('[MN-018] Sweeping Attack: no original attack damageType'), 'Slashing');
    const attackBonus = lastAttack?.bonus || 0;
    const originalTotal = lastAttack?.total ?? attackBonus;
    const originalD20Roll = lastAttack?.d20Roll ?? (originalTotal - attackBonus);

    const candidates = (cs?.creatures || []).filter(c =>
        c.name !== targetName && c.name !== playerStats.name
    );
    const rawSecondary = [];
    for (const c of candidates) {
        const ok = await isWithinRange(targetName, c.name, 5);
        if (ok) rawSecondary.push(c);
    }

    if (rawSecondary.length === 0) {
        const logDescription = `${maneuver.name}: ${dieDescription} No other creature is within 5 feet of ${targetName || 'the original target'}.`;
        return {
            type: 'popup',
            payload: { type: 'automation_info', name: maneuver.name, description: `${dieDescription} No other creature is within 5 feet of ${targetName || 'the original target'}.`, automation: auto },
            logEntries: [{ type: 'ability_use', characterName: playerStats.name, abilityName: maneuver.name, description: logDescription }],
        };
    }

    await setRuntimeValue(playerStats.name, 'pendingSweepingAttack', {
        dieValue,
        damageType,
        primaryTarget: targetName,
        targetName,
        originalTotal,
        originalD20Roll,
        attackBonus,
        secondaryTargets: rawSecondary,
    }, campaignName);

    const chooserDescription = `${maneuver.name}: ${dieDescription} Choose a creature within 5 feet of ${targetName || 'the original target'} — the original attack roll (${originalTotal}) is reused against its AC; if it would hit, it takes ${dieValue} ${damageType} damage.`;

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `${maneuver.name}: ${dieDescription} Expend 1 Superiority Die.`,
    };
    return {
        type: 'modal',
        modalName: 'sweepingAttackTarget',
        payload: {
            playerStats,
            campaignName,
            dieValue,
            damageType,
            primaryTarget: targetName,
            targetName,
            secondaryTargets: rawSecondary,
            description: chooserDescription,
        },
        logEntries: [logEntry],
    };
}

export async function executeAttackRiderManeuver(action, playerStats, campaignName, maneuverName, attackInfo) {
    const auto = action.automation || {};
    const allManeuvers = await getManeuversForRules(playerStats.rules);
    const maneuver = allManeuvers.find(m => m.name === maneuverName);

    if (!maneuver) {
        return buildManeuverNotFoundPopup(maneuverName, maneuverName);
    }

    const { superiorityDice, hasDiceRemaining } = checkSuperiorityDice(playerStats, campaignName);

    if (!hasDiceRemaining) {
        return buildNoDiceRemainingPopup(maneuver.name);
    }

    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || attackInfo?.targetName || null;

    // MN-015: size gate runs BEFORE the die roll so a refusal never expends a die
    // and never rides the maneuver die onto damage.
    if (targetName && maneuver.sizeLimit) {
        const sizeCheck = await validateSizeLimit(maneuver, targetName, campaignName, playerStats);
        if (!sizeCheck.valid) {
            return {
                type: 'popup',
                refused: true,
                payload: {
                    type: 'automation_info',
                    name: maneuver.name,
                    description: sizeCheck.description,
                },
                logEntries: [{
                    type: 'ability_use',
                    characterName: playerStats.name,
                    abilityName: maneuver.name,
                    description: sizeCheck.description,
                }],
            };
        }
    }

    const { dieValue, dieDescription, expendedDie } = rollManeuverDie(maneuver, playerStats, campaignName, auto.dieExpression);
    await expendSuperiorityDie(playerStats, campaignName, expendedDie, superiorityDice);

    let description = dieDescription;

    if (targetName) {
        description += ` Target: ${targetName}.`;
    }

    // Handle attack_rider maneuvers with options (Brutal Strike)
    const riderOptions = maneuver.automation?.options || [];
    if (riderOptions.length > 0 && maneuver.automation?.type === 'attack_rider') {
        return applyBrutalStrikeRider(maneuver, targetName, playerStats, campaignName, dieValue, dieDescription, description);
    }

    if (maneuver.saveType && targetName) {
        const saveDc = buildSaveDc(auto, playerStats);
        const { promise } = createSaveListener(campaignName, {
            targetName,
            saveType: maneuver.saveType,
            saveDc,
        });

        const saveResult = await promise;
        const success = saveResult.success;

        description += ` Target made ${maneuver.saveType} save DC ${saveDc}: ${success ? 'Success' : 'Failure'}.`;

        const saveEffectDesc = await processManeuverSaveResult(maneuver, targetName, saveDc, success, playerStats, campaignName);
        description += saveEffectDesc;
    }
    else if (maneuver.saveType) {
        const saveDc = buildSaveDc(auto, playerStats);
        description += buildManeuverSaveDescription(maneuver, saveDc);
    }

    if (maneuver.effect === 'next_attack_advantage' || maneuver.effect === 'distracting_strike_advantage') {
        description += ` The next attack against ${targetName || 'the target'} by an ally has Advantage.`;
        if (targetName) {
            const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
            const newEffect = {
                target: targetName,
                source: playerStats.name,
                effect: 'distracting_strike_advantage',
                value: null,
                duration: 'until_end_of_turn',
            };
            await setRuntimeValue('campaign', 'targetEffects', [...storedEffects, newEffect], campaignName);
        }
    }

    if (maneuver.effect === 'ally_movement') {
        description += ` Choose a willing ally: that ally can use its Reaction to move up to half its Speed without provoking Opportunity Attacks from ${targetName || 'the target'}.`;
    }

    if (maneuver.effect === 'secondary_damage') {
        return resolveSweepingAttack(maneuver, auto, targetName, playerStats, campaignName, attackInfo, dieValue, dieDescription);
    }

    if (maneuver.damageBonus) {
        description += ` Added ${dieValue} to the damage roll.`;
        // MN-020: the accumulated description already carries the save outcome and
        // any condition text ("fell Prone") — the log must carry the same full text.
        const logEntry = {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: maneuver.name,
            description: `${maneuver.name}: ${description}`,
        };

        return {
            type: 'popup',
            dieValue,
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description,
            },
            logEntries: [logEntry],
        };
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `${maneuver.name}: ${description}`,
    };

    return {
        type: 'popup',
        dieValue,
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
        },
        logEntries: [logEntry],
    };
}
