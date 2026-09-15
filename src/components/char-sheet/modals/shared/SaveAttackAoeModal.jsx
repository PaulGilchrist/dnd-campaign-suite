import React, { useState, useCallback, useEffect } from 'react';
import { rollExpression, rollExpressionMaximized } from '../../../../services/dice/diceRoller.js';
import { resolveScaling } from '../../../../services/combat/automation/automationExpressions.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { applyDamageToTarget, computeDamageAfterEvasion, computeDamageAfterResistancesWithDetails, hasEvasionForSave, normalizeSaveType } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { registerTargetEffect } from '../../../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../../../services/rules/effects/expirationQueue.js';
import { isWithinRange } from '../../../../services/rules/combat/rangeCheck.js';
import { stageSleepTargets } from '../../../../services/rules/features/sleepService.js';
import { grantWeakeningBreath } from '../../../../services/rules/features/weakeningBreathService.js';
import CreatureSelectionModal from './CreatureSelectionModal.jsx';
import AreaEffectTargetModalBase from './AreaEffectTargetModalBase.jsx';
import { renderTargetList, persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { handleOverchannelSelfDamage } from '../../../../hooks/combat/handlers/handleOverchannelSelfDamage.js';
import { hasSoulstitchProtection, clearSoulstitchStamp } from '../../../../hooks/combat/loggedDiceRollUtils.js';

// Decide the NPC's save roll against the AoE DC, honouring heighten / rider / slow disadvantage.
function computeNpcSave(targetName, ctx) {
    const { target, saveType, saveDc, heightenTarget } = ctx;
    const saveBonus = target?.saveBonuses?.[saveType.toLowerCase()] ?? 0;
    const isHeightenTarget = heightenTarget === targetName;
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const hasRiderDisadvantage = targetEffects.some(te => te.target === targetName && te.effect === 'disadvantage_on_next_save');
    const targetActiveConditions = getRuntimeValue(targetName, 'activeConditions') || [];
    const slowDexDisadvantage = saveType.toLowerCase() === 'dex' && (
        (Array.isArray(targetActiveConditions) && targetActiveConditions.some(c => String(c).toLowerCase() === 'slow'))
        || targetEffects.some(te => te.target === targetName && te.effect === 'dex_save_disadvantage')
    );
    const saveRollRaw1 = Math.floor(Math.random() * 20) + 1;
    const saveRollRaw2 = Math.floor(Math.random() * 20) + 1;
    const hasSaveDisadvantage = isHeightenTarget || hasRiderDisadvantage || slowDexDisadvantage;
    const saveRoll = hasSaveDisadvantage ? Math.min(saveRollRaw1, saveRollRaw2) : saveRollRaw1;
    const saveTotal = saveRoll + saveBonus;
    const success = saveTotal >= saveDc;
    return { saveBonus, hasRiderDisadvantage, hasSaveDisadvantage, saveRollRaw1, saveRollRaw2, saveRoll, saveTotal, success, targetEffects };
}

// Build the campaign-log roll entry for an NPC save + damage resolution.
function buildNpcSaveLogEntry({ action, playerStats, targetDamageFormula, damageRoll, rawDamage, damageType, targetName, saveType, saveDc, dcSuccess, success, saveRoll, saveBonus, saveRollRaw1, saveRollRaw2, hasSaveDisadvantage, finalDamage }) {
    return {
        type: 'roll',
        characterName: playerStats.name,
        rollType: 'save-damage',
        name: action.name,
        formula: targetDamageFormula,
        rolls: damageRoll?.rolls ?? [],
        total: rawDamage,
        modifier: damageRoll?.modifier ?? 0,
        damageType: damageType,
        targetName,
        saveType: saveType,
        saveDc: saveDc,
        dcSuccess: dcSuccess,
        saveResult: success ? 'success' : 'failure',
        saveRoll: saveRoll,
        saveBonus,
        saveRawRolls: [saveRollRaw1, saveRollRaw2],
        mode: hasSaveDisadvantage ? 'disadvantage' : 'normal',
        finalDamage: finalDamage,
        timestamp: Date.now(),
    };
}

function rollDamageFormula(formula, overchannelActive) {
    return overchannelActive ? rollExpressionMaximized(formula) : rollExpression(formula);
}

function getTargetDefenses(combatSummary, targetName) {
    const targetCreature = combatSummary.creatures.find(c => c.name === targetName);
    const resistances = targetCreature?.resistances || [];
    const immunities = targetCreature?.immunities || [];
    const targetChar = (combatSummary.creatures?.filter(c => c.type === 'player') || []).find(c => c.name === targetName);
    return { resistances, immunities, evasionEffects: targetChar?.computedStats?.evasionEffects };
}

function npcSaveBonus(target, saveType) {
    return target?.saveBonuses?.[saveType.toLowerCase()] ?? 0;
}

// Resolve an NPC target's save/damage, performing all writes, and return the results row.
function resolveNpcTarget(ctx) {
    const { action, targetName, target, combatSummary, characters, resolvedDamage, damageType, saveType, saveDc, dcSuccess, radiantSoulChaMod, radiantSoulTarget, radiantSoulFlagKey, overchannelActive, isCarefulSpell, isCarefulAlly, pullMarkerEffect, logSaveSuccess, playerStats, campaignName, saveConditions, sleepStaging, pushFeet, slowedClauses } = ctx;
    const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);
    const isSoulstitchProtected = hasSoulstitchProtection(targetName, playerStats.name, campaignName);

    if (isSoulstitchProtected) {
        // CLA-321: Soulstitch Spells — chosen creature auto-succeeds, takes no damage.
        const saveBonus = npcSaveBonus(target, saveType);
        addEntry(campaignName, {
            type: 'roll',
            characterName: playerStats.name,
            rollType: 'save-damage',
            name: `${action.name} (Soulstitch)`,
            formula: resolvedDamage,
            rolls: [],
            total: 0,
            modifier: 0,
            damageType: damageType,
            targetName,
            saveType: saveType,
            saveDc: saveDc,
            dcSuccess: dcSuccess,
            saveResult: 'soulstitch_auto_success',
            saveRoll: null,
            saveBonus,
            saveRawRolls: [],
            finalDamage: 0,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging soulstitch auto-save:', e); });
        addTargetResult(campaignName, { targetName, saveResult: 'soulstitch_auto_success', roll: null, total: saveBonus, conditions: [], appliedDamage: 0 });
        return { targetName, success: true, roll: null, total: saveBonus, saveBonus, rawDamage: 0, finalDamage: 0, soulstitchProtected: true };
    }

    const { saveBonus, hasRiderDisadvantage, hasSaveDisadvantage, saveRollRaw1, saveRollRaw2, saveRoll, saveTotal, success, targetEffects } = computeNpcSave(targetName, ctx);

    const isRadiantSoulTarget = targetName === radiantSoulTarget;
    const targetDamageFormula = isRadiantSoulTarget ? `${resolvedDamage} + ${radiantSoulChaMod} [Radiant Soul]` : resolvedDamage;
    const damageRoll = rollDamageFormula(targetDamageFormula, overchannelActive);
    const rawDamage = damageRoll?.total ?? 0;
    const { resistances, immunities, evasionEffects } = getTargetDefenses(combatSummary, targetName);
    const normalizedSaveType = normalizeSaveType(saveType);
    const evasionActive = hasEvasionForSave(evasionEffects, normalizedSaveType);
    const damageAfterSave = computeDamageAfterEvasion(rawDamage, success, dcSuccess, evasionActive);
    const resResult = computeDamageAfterResistancesWithDetails({ rawDamage: damageAfterSave, damageTypes: [damageType], resistances, immunities, ignoreResistance: false });
    let finalDamage = resResult.finalDamage;

    if (carefulSpellProtected) {
        finalDamage = 0;
    }

    if (finalDamage > 0) {
        applyDamageToTarget(combatSummary, targetName, finalDamage, [damageType], { campaignName, characters: characters, ignoreResistance: true, attackerName: playerStats.name, suppressHpLog: false });
        if (isRadiantSoulTarget) {
            setRuntimeValue(playerStats.name, radiantSoulFlagKey, true, campaignName);
            setRuntimeValue(playerStats.name, 'pendingRadiantSoulTarget', null, campaignName);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: 'Radiant Soul',
                description: `Radiant Soul: +${radiantSoulChaMod} ${damageType} damage added to ${targetName}'s damage roll (once per turn).`,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging Radiant Soul:', e); });
        }
        addEntry(campaignName, buildNpcSaveLogEntry({ action, playerStats, targetDamageFormula, damageRoll, rawDamage, damageType, targetName, saveType, saveDc, dcSuccess, success, saveRoll, saveBonus, saveRollRaw1, saveRollRaw2, hasSaveDisadvantage, finalDamage })).catch((e) => { console.error('[SaveAttackAoeModal] Error logging save:', e); });
    }

    if (!success && pullMarkerEffect) {
        // CLA-384: feature-flagged save-fail marker (e.g. Warping Implosion pull).
        registerTargetEffect(campaignName, targetName, pullMarkerEffect, action.name, { duration: 'instant' });
    }
    // MA-0068 staged sleep / MA-0063 one-shot grant dispatch (byte-inert
    // when neither flag authored).
    resolveSaveFailGrant({ sleepStaging, success, saveDc, saveType, targetName, playerStats, action, saveRoll, saveBonus, saveConditions, campaignName, pushFeet, slowedClauses, weakeningBreath: ctx.weakeningBreath, acPenaltyClause: ctx.acPenaltyClause, conditionDurationNote: ctx.conditionDurationNote });
    if (success && logSaveSuccess) {
        addEntry(campaignName, {
            type: 'roll',
            rollType: 'save-damage',
            characterName: playerStats.name,
            name: action.name,
            targetName,
            saveType: saveType,
            saveDc: saveDc,
            dcSuccess: dcSuccess,
            saveResult: 'success',
            saveRoll: saveRoll,
            saveBonus,
            finalDamage: 0,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging save success:', e); });
    }
    if (hasRiderDisadvantage) {
        const updatedEffects = targetEffects.filter(te => !(te.target === targetName && te.effect === 'disadvantage_on_next_save'));
        setRuntimeValue('campaign', 'targetEffects', updatedEffects, campaignName);
    }
    addTargetResult(campaignName, { targetName, saveResult: success ? 'success' : 'failure', roll: saveRoll, total: saveTotal, conditions: [], appliedDamage: finalDamage });
    return { targetName, success, roll: saveRoll, total: saveTotal, saveBonus, rawDamage, finalDamage };
}

// Resolve a PC target: soulstitch/careful auto-protect (returns { result }) or a save prompt ({ prompt }).
function resolvePcTarget(ctx) {
    const { action, targetName, combatSummary, characters, resolvedDamage, damageType, saveType, saveDc, dcSuccess, radiantSoulChaMod, radiantSoulTarget, overchannelActive, isCarefulSpell, isCarefulAlly, heightenTarget, playerStats, campaignName, saveConditions } = ctx;
    const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);
    const isSoulstitchProtected = hasSoulstitchProtection(targetName, playerStats.name, campaignName);

    if (isSoulstitchProtected) {
        // CLA-321: chosen creature auto-succeeds its save — no prompt, no damage.
        applyDamageToTarget(combatSummary, targetName, 0, [damageType], { campaignName, characters: characters, ignoreResistance: true, attackerName: playerStats.name, suppressHpLog: false });
        addEntry(campaignName, {
            type: 'roll',
            characterName: playerStats.name,
            rollType: 'save-damage',
            name: `${action.name} (Soulstitch)`,
            targetName,
            saveType: saveType,
            saveDc: saveDc,
            dcSuccess: dcSuccess,
            saveResult: 'soulstitch_auto_success',
            saveRoll: null,
            finalDamage: 0,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging soulstitch auto-save:', e); });
        addTargetResult(campaignName, { targetName, saveResult: 'soulstitch_auto_success', roll: null, total: 0, conditions: [], appliedDamage: 0 });
        return { result: { targetName, success: true, roll: null, total: 0, saveBonus: 0, rawDamage: 0, finalDamage: 0, soulstitchProtected: true } };
    }

    if (carefulSpellProtected) {
        applyDamageToTarget(combatSummary, targetName, 0, [damageType], { campaignName, characters: characters, ignoreResistance: true, attackerName: playerStats.name, suppressHpLog: false });
        return { result: { targetName, success: true, roll: null, total: 0, saveBonus: 0, rawDamage: 0, finalDamage: 0 } };
    }

    const promptId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const scalingEntry = resolveScaling(playerStats, action.automation?.scaling);
    const pcResolvedDamage = scalingEntry?.damage || resolvedDamage;
    const isRadiantSoulTarget = targetName === radiantSoulTarget;
    const targetDamageFormula = isRadiantSoulTarget ? `${pcResolvedDamage} + ${radiantSoulChaMod} [Radiant Soul]` : pcResolvedDamage;
    const damageRoll = overchannelActive ? rollExpressionMaximized(targetDamageFormula) : rollExpression(targetDamageFormula);
    const rawDamage = damageRoll?.total ?? 0;

    sendSavePrompt(campaignName, {
        promptId,
        targetName,
        saveType: saveType,
        saveDc: saveDc,
        sourceName: playerStats.name,
        rawDamage,
        dcSuccess,
        disadvantage: heightenTarget === targetName,
        // MA-0079: carry the authored failed-save conditions onto the prompt
        // so the quick-roll lastAttack stamp keeps saveConditions (was []).
        saveConditions: saveConditions || [],
    });

    const existingPrompts = Array.from(getRuntimeValue('campaign', 'pendingSaveListenerPrompts') || []);
    existingPrompts.push(promptId);
    setRuntimeValue('campaign', 'pendingSaveListenerPrompts', existingPrompts, campaignName);
    return { prompt: { promptId, targetName } };
}

// CLA-321: soulstitch-chosen target auto-succeeds the prompt's save, takes no damage.
function resolveSoulstitchOutcome(detail, isSoulstitchProtected) {
    return {
        success: isSoulstitchProtected ? true : detail.success,
        rawDamage: isSoulstitchProtected ? 0 : (detail.rawDamage ?? 0),
        saveBonus: detail.saveBonus ?? 0,
    };
}

function resolveEvasionFinalDamage({ combatSummary, targetName, rawDamage, success, saveType, dcSuccess }) {
    const targetChar = (combatSummary?.creatures?.filter(c => c.type === 'player') || []).find(c => c.name === targetName);
    const evasionEffects = targetChar?.computedStats?.evasionEffects;
    const evasionActive = hasEvasionForSave(evasionEffects, normalizeSaveType(saveType));
    return computeDamageAfterEvasion(rawDamage, success, dcSuccess, evasionActive);
}

function saveResultLabel(isSoulstitchProtected, success) {
    if (isSoulstitchProtected) return 'soulstitch_auto_success';
    return success ? 'success' : 'failure';
}

function appendPromptTargetResult(setResultsFn, setPendingPromptsFn, targetResult, promptId) {
    setResultsFn(prev => {
        if (prev.some(r => r.targetName === targetResult.targetName)) return prev;
        return [...prev, targetResult];
    });
    setPendingPromptsFn(prev => prev.filter(p => p.promptId !== promptId));
}

// MA-0031 optional seams (byte-inert when props are null).
function isExcludedByName(name, excludeNames) {
    return (excludeNames || []).includes(name);
}

function isInAllowedRange(name, rangeAllowed) {
    return rangeAllowed == null || rangeAllowed.has(name);
}

const TRAP_BLOCKING_EFFECTS = ['forcecage', 'maze', 'banishment', 'imprisonment'];

function trapEffectBlocksAttack(effects, effectName, attackerName, targetName) {
    if (!Array.isArray(effects) || effects.length === 0) return false;
    const attackerTrapped = effects.some(te => te.effect === effectName && te.target === attackerName);
    const targetTrapped = effects.some(te => te.effect === effectName && te.target === targetName);
    if (!attackerTrapped && !targetTrapped) return false;
    if (!attackerTrapped || !targetTrapped) return true;
    const attackerSources = effects
        .filter(te => te.effect === effectName && te.target === attackerName)
        .map(te => te.source);
    return !effects.some(te => te.effect === effectName && te.target === targetName && attackerSources.includes(te.source));
}

function isTargetExcludedByTraps(c, attackerName) {
    if (!attackerName || !c.name) return false;
    const effects = getRuntimeValue('campaign', 'targetEffects') || [];
    return TRAP_BLOCKING_EFFECTS.some(name => trapEffectBlocksAttack(effects, name, attackerName, c.name));
}

// CLA-279: if this PC is the stamped Radiant Soul recipient, its damage roll carries the CHA adder.
function resolveRadiantSoulDamageRoll({ playerStats, action, damage, campaignName, radiantSoulChaMod, overchannelActive, targetName }) {
    const scalingEntry = resolveScaling(playerStats, action.automation?.scaling);
    const resolvedDamage = scalingEntry?.damage || damage;
    const radiantSoulFlagKey = `_radiantSoul_${playerStats.name.replace(/\s+/g, '_')}_oncePerTurn`;
    const radiantSoulPending = getRuntimeValue(playerStats.name, 'pendingRadiantSoulTarget', campaignName);
    const isRadiantSoulTarget = radiantSoulChaMod > 0 && radiantSoulPending === targetName;
    const targetDamageFormula = isRadiantSoulTarget ? `${resolvedDamage} + ${radiantSoulChaMod} [Radiant Soul]` : resolvedDamage;
    const damageRoll = overchannelActive ? rollExpressionMaximized(targetDamageFormula) : rollExpression(targetDamageFormula);
    return { resolvedDamage, radiantSoulFlagKey, isRadiantSoulTarget, targetDamageFormula, damageRoll };
}

function maybeStoreLastAttack(enabled, campaignName, cfg) {
    if (enabled) storeSpellLastAttack(campaignName, cfg);
}

// MA-0042: persisting-zone arm seam (byte-inert when zoneTe is null) — on
// area confirm, writes a zone te per covered creature (SP-111 zone te shape)
// plus caster tracking `_<trackingPrefix>_<caster>` {radius/saveDc} for any
// future zone consumer. repeatTurnEnd rows log "repeat <dice> at turn end —
// GM-enforced": no turn-END zone-damage consumer exists in this engine
// (expireStaleEffects zone phases are turn-START passes only), so the
// repeat damage + "until dismissed" duration stay advisory (CLA-325).
function armZoneTargets({ zoneTe, selectedNames, casterName, actionName, saveDc, saveType, campaignName }) {
    if (!zoneTe || !zoneTe.effectKey) return;
    for (const targetName of selectedNames) {
        registerTargetEffect(campaignName, targetName, zoneTe.effectKey, casterName, {
            dc: saveDc,
            radiusFt: zoneTe.radiusFt,
            repeatTurnEnd: zoneTe.repeatTurnEnd === true,
            duration: 'until_end_of_zone',
        });
    }
    const trackingKey = `_${zoneTe.trackingPrefix}_${String(casterName).replace(/\s+/g, '_')}`;
    setRuntimeValue(casterName, trackingKey, {
        saveDc,
        saveType,
        radiusFt: zoneTe.radiusFt,
        repeatTurnEnd: zoneTe.repeatTurnEnd === true,
        damage: zoneTe.damage || null,
        duration: zoneTe.duration || null,
        affectedNames: [...selectedNames],
    }, campaignName);
    const saveNote = saveDc != null ? `${saveType} save DC ${saveDc}` : 'no save';
    const repeatNote = zoneTe.repeatTurnEnd
        ? ` Repeat ${zoneTe.damage || 'damage'} at turn end — GM-enforced (no turn-end zone-damage consumer).`
        : '';
    const clauseNote = zoneTe.clause ? ` ${zoneTe.clause}` : '';
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: actionName,
        description: `${casterName} ${actionName}: ${zoneTe.effectKey} zone armed (radius ${zoneTe.radiusFt} ft, ${saveNote}) over ${selectedNames.join(', ') || 'no targets'}.${repeatNote}${clauseNote} Duration ${zoneTe.duration || 'GM-adjudicated'} — GM-enforced.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging zone arm:', e); });
}

// MA-0063: damageless failed-save condition grant inside the AoE picker
// (byte-inert when saveConditions is empty — every existing consumer is
// damage-only or zoneOnly). On a failed save the condition lands on the
// target's activeConditions + activeConditionMeta {dc, ability} so the PC
// badge-click repeat-save seam (CharConditions → createRollConditionSaveHandler)
// can strip it on a later success (MA-0017 damageless-save shape). A
// lair_sand_cloud te mirrors the zone with dc for future consumers. NPC
// turn-end auto-repeat and the 1-minute expiry stay GM-enforced (no NPC
// turn-end zone-save consumer — advisory in the log).
// MA-0084: an authored duration clause (Thunderclap "until the end of its
// next turn") replaces the MA-0063 1-minute repeat-save copy when present —
// byte-identical for the sand-cloud rows that have no until-clause.
function failConditionDurationText(conditionDurationNote) {
    return conditionDurationNote
        || '1 minute; repeats the save at the end of each of its turns (success ends it on itself). NPC turn-end auto-repeat and 1-minute expiry GM-enforced.';
}

function applySaveFailConditions({ saveConditions, saveSuccess, saveDc, saveType, targetName, casterName, actionName, campaignName, pushFeet, conditionDurationNote }) {
    if (saveSuccess === true) return;
    if (!saveConditions || saveConditions.length === 0) return;
    const ability = String(saveType || '').toLowerCase().slice(0, 3) || 'con';
    const existing = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(existing) ? existing : [];
    const merged = [...conditions];
    for (const cond of saveConditions) {
        if (!merged.some(c => String(c).toLowerCase() === cond)) merged.push(cond);
    }
    setRuntimeValue(targetName, 'activeConditions', merged, campaignName);
    const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
    const nextMeta = { ...existingMeta };
    for (const cond of saveConditions) {
        nextMeta[cond] = { ...(existingMeta[cond] || {}), dc: saveDc, ability, source: casterName };
    }
    setRuntimeValue(targetName, 'activeConditionMeta', nextMeta, campaignName);
    const conditionNames = saveConditions.map(c => c.charAt(0).toUpperCase() + c.slice(1));
    // MA-0079: authored push clause (Repulsion Breath) — instant marker te
    // on failed saves (CLA-384 pull-marker seam shape; instant te persists
    // as marker, GM moves the token — §7 no position consumer).
    const pushNote = pushFeet != null
        ? ` Pushed up to ${pushFeet} ft straight away from ${casterName} (marker te; token movement GM-enforced).`
        : '';
    if (pushFeet != null) {
        registerTargetEffect(campaignName, targetName, 'push', casterName, { duration: 'instant', value: pushFeet, actionName });
    }
    // MA-0084: an authored duration clause (Thunderclap "until the end of its
    // next turn") replaces the MA-0063 1-minute repeat-save copy when present —
    // byte-identical for the sand-cloud rows that have no until-clause.
    const durationText = failConditionDurationText(conditionDurationNote);
    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: conditionNames.join(', '),
        sourceName: casterName,
        sourceAbility: actionName,
        description: `${targetName} failed the ${saveType} save (DC ${saveDc}) in ${casterName}'s ${actionName} — ${conditionNames.join(', ')} ${durationText}${pushNote}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging save-fail condition:', e); });
}

// MA-0068: staged Sleep Breath fail (byte-inert unless sleepStaging authored).
// A failed save STAGES the sleep (Incapacitated + sleep_staged te, SP-107
// sleepService shape) instead of the MA-0063 one-shot all-conditions grant:
// the turn-END seam (navigationHandlers applyOutgoingTurnEndPasses →
// sleepService.applySleepTurnEnd) rolls the CON repeat save, and a second
// fail escalates to Unconscious for unconsciousRounds (10 min = 100 rounds,
// CLA-334 minutes×10). Wake-on-damage lands at the existing applyDamage
// wakeSleepOnDamage seam. Shaking awake within 5 ft stays GM-enforced
// (§7 sleep_shake residual). Zero damage — HP untouched; roll + condition
// logs written here (no damage = no damage log — MA-0090 fingerprint).
function applyStagedSleepSave({ sleepStaging, success, saveDc, saveType, targetName, casterName, actionName, roll, saveBonus, campaignName }) {
    const failed = success !== true;
    const unconsciousMinutes = Math.max(1, Math.round((sleepStaging.unconsciousRounds ?? 100) / 10));
    addEntry(campaignName, {
        type: 'roll',
        rollType: 'save',
        characterName: targetName,
        name: actionName,
        targetName,
        saveType,
        saveDc,
        saveResult: failed ? 'failure' : 'success',
        rolls: [roll ?? 0],
        bonus: saveBonus ?? 0,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging staged sleep save:', e); });
    if (!failed) return;
    stageSleepTargets(campaignName, casterName, [targetName], saveDc, {
        saveType,
        concentrate: false,
        label: actionName,
        logLabel: actionName,
        unconsciousRounds: sleepStaging.unconsciousRounds ?? 100,
    }).catch((e) => { console.error('[SaveAttackAoeModal] Error staging sleep:', e); });
    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Incapacitated',
        sourceName: casterName,
        sourceAbility: actionName,
        description: `${targetName} failed ${casterName}'s ${actionName} (${saveType} save DC ${saveDc}) — Incapacitated until the end of its next turn, when it repeats the save; a second failure makes it Unconscious for ${unconsciousMinutes} minutes (ends early on damage; shaking awake is GM-enforced).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging staged sleep condition:', e); });
}

// Failed-save dispatch: MA-0068 staged sleep rows route through the SP-107
// staging seams; everything else keeps the MA-0063 one-shot grant untouched.
function resolveSaveFailGrant({ sleepStaging, success, saveDc, saveType, targetName, playerStats, action, saveRoll, saveBonus, saveConditions, campaignName, pushFeet, slowedClauses, weakeningBreath, acPenaltyClause, conditionDurationNote }) {
    if (sleepStaging) {
        applyStagedSleepSave({ sleepStaging, success, saveDc, saveType, targetName, casterName: playerStats.name, actionName: action.name, roll: saveRoll, saveBonus, campaignName });
        return;
    }
    // MA-0087: "slowed" rider clauses grant te for each authored clause on a
    // failed save ('slowed' is not a registered condition, so each clause maps
    // to a registered te with a live consumer). Byte-inert when null.
    if (!success && slowedClauses?.effects?.length) {
        grantSlowedClauses({ effects: slowedClauses.effects, campaignName, targetName, casterName: playerStats.name, actionName: action.name, saveType, saveDc });
    }
    // MA-0102: Weakening Breath failed-save grant (Adult Gold Dragon) —
    // weakening_breath te (STR-test disadvantage + 1d6 damage subtract) with
    // the turn-END repeat-save marker and a 10-round auto-success clock
    // (weakeningBreathService, MA-0048/MA-0087 shapes). Byte-inert when null.
    if (!success && weakeningBreath) {
        grantWeakeningBreath({ campaignName, attackerName: playerStats.name, targetName, saveType, saveDc, roll: saveRoll, saveBonus }).catch((e) => { console.error('[SaveAttackAoeModal] Error granting weakening breath:', e); });
    }
    // MA-0115: Noxious Miasma failed-save AC-penalty clause — ac_penalty te
    // (value −2) until the end of the target's next turn, rounds:2 clock
    // (MA-0073 recipe); live consumer conditionEffects → sheet AC fold.
    if (!success && acPenaltyClause) {
        grantAcPenaltyClause({ acPenaltyClause, campaignName, targetName, casterName: playerStats.name, actionName: action.name, saveType, saveDc });
    }
    applySaveFailConditions({ saveConditions, saveSuccess: success, saveDc, saveType, targetName, casterName: playerStats.name, actionName: action.name, campaignName, pushFeet, conditionDurationNote });
}

// MA-0115: Noxious Miasma failed-save AC-penalty grant (Adult Green Dragon
// sphere). Registry ac_penalty te with the parsed value; drained by a
// rounds:2 clock (MA-0073/MA-0087 shape). Badge consumer: ConditionEffectBadges.
function grantAcPenaltyClause({ acPenaltyClause, campaignName, targetName, casterName, actionName, saveType, saveDc }) {
    const value = Number(acPenaltyClause?.value) || 2;
    registerTargetEffect(campaignName, targetName, 'ac_penalty', casterName, {
        duration: 'until_end_of_next_turn',
        value,
        actionName,
    });
    addExpiration({
        attackerName: casterName,
        targetName,
        campaignName,
        rounds: 2,
        effects: [{ type: 'remove_target_effect', effectKey: 'ac_penalty', source: casterName, target: targetName }],
    });
    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'AC Penalty',
        sourceName: casterName,
        sourceAbility: actionName,
        description: `${targetName} failed the ${saveType} save (DC ${saveDc}) in ${casterName}'s ${actionName} — \u2212${value} AC until the end of ${targetName}'s next turn.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging AC penalty:', e); });
}

// MA-0087: Slowing Breath failed-save rider te grants (Adult Copper Dragon).
// speed_half (MA-0073 consumer), no_reactions (CharReactions), and
// no_action_and_bonus_action (Stinking Cloud / slow2024 consumer) — each is an
// existing registered te; no new consumers. Duration until the end of the
// target's next turn, drained by a rounds:2 clock (MA-0073 recipe).
function grantSlowedClauses({ effects, campaignName, targetName, casterName, actionName, saveType, saveDc }) {
    for (const effectKey of effects) {
        registerTargetEffect(campaignName, targetName, effectKey, casterName, {
            duration: 'until_end_of_next_turn',
            actionName,
        });
        addExpiration({
            attackerName: casterName,
            targetName,
            campaignName,
            rounds: 2,
            effects: [{ type: 'remove_target_effect', effectKey, source: casterName, target: targetName }],
        });
    }
    const clauseText = 'can\'t take Reactions, Speed halved, and one action or Bonus Action (not both)';
    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Slowed',
        sourceName: casterName,
        sourceAbility: actionName,
        description: `${targetName} failed the ${saveType} save (DC ${saveDc}) in ${casterName}'s ${actionName} — Slowed: ${clauseText} until the end of ${targetName}'s next turn.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging slowed clauses:', e); });
}

// Result-row copy: damage rows keep the byte-identical damage line; damageless
// rows never print "null null damage" (MA-0090 cosmetic), and staged sleep
// rows state the Incapacitated-until-repeat-save semantics (MA-0068).
function resultRowText(r, damage, damageType, sleepStaging) {
    if (r.soulstitchProtected) return 'Soulstitch — automatically succeeds, takes no damage';
    if (r.success) {
        return (r.finalDamage ?? 0) > 0
            ? `Saved — takes ${r.finalDamage} ${damageType} damage (rolled ${r.roll ?? 0}, halved)`
            : `Saved — takes no damage (rolled ${r.roll ?? 0})`;
    }
    if (!damage) {
        return sleepStaging
            ? `Failed — Incapacitated until the end of its next turn, then repeats the save (rolled ${r.roll ?? 0})`
            : `Failed the save (rolled ${r.roll ?? 0})`;
    }
    return `Failed — takes ${r.finalDamage ?? 0} ${damageType} damage (rolled ${r.roll ?? 0})`;
}

// MA-0031: advisory cone/area coverage gate — isWithinRange from the attacker
// (gridless lenient §7); null rangeGateFt = no gate (PC-spell default).
function useRangeAllowedSet(eligibleTargets, rangeGateFt, attackerName) {
    const [rangeAllowed, setRangeAllowed] = useState(null);
    useEffect(() => {
        if (rangeGateFt == null) return undefined;
        let cancelled = false;
        Promise.all(eligibleTargets.map(async c => ({ name: c.name, ok: await isWithinRange(attackerName, c.name, rangeGateFt) })))
            .then(rows => { if (!cancelled) setRangeAllowed(new Set(rows.filter(r => r.ok).map(r => r.name))); });
        return () => { cancelled = true; };
    }, [rangeGateFt, eligibleTargets, attackerName]);
    return rangeAllowed;
}

function aoePickerTitle(action, titleOverride) {
    return titleOverride || action.name;
}

// MA-0043: zoneOnly rows (Shroud of Darkness) read as save-less darkness
// copy; every other consumer keeps the byte-identical save picker text.
// MA-0068: staged Sleep Breath picker copy — fail stages Incapacitated
// (repeat save at end of next turn); second fail = Unconscious for N minutes,
// ends early on damage. No half-damage copy on this damageless row.
function stagedSleepPickerCopy(head, sleepStaging, metamagicHeighten) {
    const minutes = Math.max(1, Math.round((sleepStaging.unconsciousRounds ?? 100) / 10));
    return {
        icon: 'fa-moon',
        description: head,
        note: `On a failed save, target is Incapacitated until the end of its next turn, then repeats the save. Second failure: Unconscious for ${minutes} minutes — the effect ends if the target takes damage.${metamagicHeighten ? ' Heightened Spell: one target will have disadvantage.' : ''}`,
    };
}

// MA-0102: damageless weakening cone (Adult Gold Weakening Breath) —
// failed saves impose STR-test disadvantage + a damage-subtract die and
// repeat at turn end; never a damage line (kills the MA-0090 "null null
// damage" cosmetic). Byte-inert unless the clause authored.
function weakeningPickerCopy(head, weakeningBreath, metamagicHeighten) {
    return {
        icon: 'fa-hand-fist',
        description: head,
        note: `On a failed save, target has Disadvantage on Strength-based D20 Tests and subtracts ${weakeningBreath.damageSubtractDie || '1d6'} from its damage rolls. It repeats the save at the end of each of its turns, ending on a success — auto-succeeds after 1 minute.${metamagicHeighten ? ' Heightened Spell: one target will have disadvantage.' : ''}`,
    };
}

// MA-0087: damageless "slowed" cone (Adult Copper Slowing Breath) —
// failed saves impose Reactions/Speed/action riders, never a damage line.
// Byte-inert unless the clause authored.
function slowedPickerCopy(head, metamagicHeighten) {
    return {
        icon: 'fa-hourglass-half',
        description: head,
        note: `On a failed save, target is Slowed: can't take Reactions, Speed halved, and one action or Bonus Action (not both) until the end of its next turn.${metamagicHeighten ? ' Heightened Spell: one target will have disadvantage.' : ''}`,
    };
}

function buildPickerCopy({ zoneOnly, zoneTe, range, saveType, saveDc, damage, damageType, metamagicHeighten, saveConditions, sleepStaging, slowedClauses, weakeningBreath, dcSuccess }) {
    // MA-0084: dc_success 'none' rows (Thunderclap) never print the
    // half-on-success sentence — byte-identical copy for every other row.
    const successSentence = dcSuccess === 'none'
        ? 'On a successful save, target takes no damage.'
        : 'On a successful save, target takes half damage.';
    if (!zoneOnly) {
        const head = `Select creatures in the area of effect. Each must make a <strong>${saveType}</strong> saving throw (DC ${saveDc}).`;
        if (sleepStaging) return stagedSleepPickerCopy(head, sleepStaging, metamagicHeighten);
        if (!damage && weakeningBreath) return weakeningPickerCopy(head, weakeningBreath, metamagicHeighten);
        if (!damage && slowedClauses?.effects?.length) return slowedPickerCopy(head, metamagicHeighten);
        // MA-0063: damageless condition row (e.g. Adult Blue Dragon Sand Cloud) —
        // no damage formula, failed saves grant conditions. Byte-inert when empty.
        if (!damage && saveConditions && saveConditions.length > 0) {
            const names = saveConditions.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
            return {
                icon: 'fa-smog',
                description: head,
                note: `On a failed save, target is ${names}.${metamagicHeighten ? ' Heightened Spell: one target will have disadvantage.' : ''}`,
            };
        }
        return {
            icon: 'fa-bomb',
            description: head,
            note: `On a failed save, target takes ${damage} ${damageType} damage. ${successSentence}${metamagicHeighten ? ' Heightened Spell: one target will have disadvantage.' : ''}`,
        };
    }
    return zoneOnlyPickerCopy(zoneTe, range);
}

// MA-0043: save-less zone picker copy (Shroud of Darkness). MA-0085: optional
// zone noun/icon (Adult Bronze Dragon Fog Cloud "fog") — absent → darkness
// defaults, MA-0043 byte-identical.
function zoneOnlyPickerCopy(zoneTe, range) {
    return {
        icon: zoneTe?.icon || 'fa-moon',
        description: `Select creatures inside the <strong>${zoneTe?.radiusFt ?? range}-foot</strong> ${zoneTe?.noun || 'darkness'}. No saving throw — the GM positions the origin (selection advisory).`,
        note: `${zoneTe?.clause || ''} Duration ${zoneTe?.duration || 'GM-adjudicated'} — GM-enforced.`,
    };
}

// MA-0102: RAW Weakening Breath targets "each creature that isn't currently
// affected by this breath" — creatures already carrying this attacker's
// weakening_breath te are merged into the picker's excludeNames. Byte-inert
// (no read) unless the weakening clause is authored on the row.
function weakenedNamesFor(catalog, attackerName, weakeningBreath) {
    if (!weakeningBreath) return [];
    const effects = getRuntimeValue('campaign', 'targetEffects') || [];
    return (catalog || [])
        .map(c => c.name)
        .filter(name => effects.some(te => te.effect === 'weakening_breath' && te.target === name && te.source === attackerName));
}

function buildEligibleTargets(combatSummary, attackerName, isCarefulSpell, isCarefulAlly, excludeNames) {
    if (!combatSummary?.creatures) return [];
    return combatSummary.creatures
        .filter(c => !isTargetExcludedByTraps(c, attackerName))
        .filter(c => !isExcludedByName(c.name, excludeNames))
        .map(c => ({
            ...c,
            carefulSpellProtected: isCarefulSpell && isCarefulAlly(c.name),
        }));
}

function toPickerTargets(eligibleTargets, rangeAllowed) {
    return eligibleTargets
        .filter(c => isInAllowedRange(c.name, rangeAllowed))
        .map(c => ({
            name: c.name,
            type: c.type,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            carefulSpellProtected: c.carefulSpellProtected,
        }));
}

// MA-0043: zone-armed confirmation line on the save-less picker results view.
function ZoneArmedNote({ zoneOnly, zoneTe, selected }) {
    if (!zoneOnly) return null;
    return <p>{zoneTe?.effectKey || 'Zone'} armed over {Array.from(selected).join(', ') || 'no targets'} — GM-enforced.</p>;
}

// Damageless rows (MA-0068/MA-0090) never print the half-damage line.
// MA-0084: dc_success 'none' rows state "no damage" on a successful save.
function DamageNote({ damage, damageType, dcSuccess }) {
    if (!damage) return null;
    const successText = dcSuccess === 'none' ? 'no damage' : 'half damage';
    return <p className="sp-note">On a failed save, target takes {damage} {damageType} damage. On a successful save, target takes {successText}.</p>;
}

function SaveAttackAoeModal({
    action,
    playerStats,
    campaignName,
    _shape,
    range,
    damage,
    damageType,
    radiantSoulChaMod = 0,
    saveType,
    saveDc,
    dcSuccess,
    activeOverlay,
    metamagicCareful,
    metamagicHeighten,
    overchannelActive = false,
    overchannelUseCount = 0,
    overchannelSpellLevel = 1,
    pullMarkerEffect = null,
    logSaveSuccess = false,
    // MA-0031 optional seams (byte-inert defaults for all PC-spell consumers):
    // monster-card cone rows pass a title label, exclude the attacker itself,
    // an advisory isWithinRange coverage gate, and skip the spell lastAttack
    // stamp (a breath weapon is not spell-origin — keeps counterspell gates clean).
    titleOverride,
    excludeNames,
    rangeGateFt,
    storeLastAttack,
    // MA-0042 optional persisting-zone seam (byte-inert null default):
    // { effectKey, trackingPrefix, radiusFt, repeatTurnEnd, damage, duration, clause? }
    zoneTe = null,
    // MA-0043 zoneOnly (byte-inert false default): save-less zone rows
    // (Shroud of Darkness) — confirm arms the zone and logs, but resolves
    // NO saves and applies NO damage (canonical darkness lair = no save).
    zoneOnly = false,
    // MA-0063 optional failed-save conditions (byte-inert empty default):
    // damageless condition rows (Adult Blue Dragon Sand Cloud) grant these
    // conditions on failed saves inside the picker (MA-0017 shape).
    saveConditions,
    // MA-0068 optional staged sleep (byte-inert when unset): Adult Brass
    // Dragon Sleep Breath — failed saves STAGE the sleep (sleepService SP-107
    // shape) instead of the one-shot grant. { unconsciousRounds }.
    sleepStaging,
    // MA-0079 optional failed-save push clause (byte-inert undefined default):
    // Adult Bronze Dragon Repulsion Breath — failed saves grant the registry
    // push te as an instant marker (CLA-384 pull-marker shape; token movement
    // GM-enforced, §7 no position consumer). Feet parsed from save_effect.
    pushFeet,
    // MA-0084 optional authored condition duration (byte-inert undefined
    // default): Adult Bronze Dragon Thunderclap — "until the end of its next
    // turn" replaces the MA-0063 1-minute repeat-save log copy when authored
    // (extractConditionDurationNote shape).
    conditionDurationNote,
    // MA-0087 optional failed-save "slowed" rider clause (byte-inert undefined
    // default): Adult Copper Dragon Slowing Breath — grants speed_half,
    // no_reactions, no_action_and_bonus_action te on each failed save.
    slowedClauses,
    // MA-0102 optional failed-save weakening clause (byte-inert undefined
    // default): Adult Gold Dragon Weakening Breath — grants the registered
    // weakening_breath te (STR-test disadvantage + damageSubtractDie 1d6)
    // with a turn-END repeat save and a 1-minute (10-round) auto-success
    // clock; targets already affected by this dragon's breath are excluded
    // (RAW "each creature that isn't currently affected by this breath").
    weakeningBreath,
    // MA-0115 optional failed-save AC-penalty clause (byte-inert undefined
    // default): Adult Green Dragon Noxious Miasma — grants the registered
    // ac_penalty te (value −2, until_end_of_next_turn, rounds:2 clock) on
    // each failed save; live consumer conditionEffects → sheet AC fold.
    acPenaltyClause,
    onClose,
}) {
    const [summary, setSummary] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [pendingPrompts, setPendingPrompts] = useState([]);
    const [results, setResults] = useState([]);
    const [heightenTarget, setHeightenTarget] = useState(null);

    const isCarefulSpell = metamagicCareful || false;
    const allyList = isCarefulSpell ? getAllyList(playerStats.name) : null;
    const isCarefulAlly = useCallback((name) => allyList ? allyList.includes(name) : false, [allyList]);

    useEffect(() => {
        return () => {
            setSummary(null);
            setSelected(new Set());
            setPendingPrompts([]);
            setResults([]);
        };
    }, []);

    useEffect(() => {
        if (pendingPrompts.length === 0 && results.length > 0 && !summary) {
            const selectedNames = results.map(r => r.targetName);
            setSummary({ results, selected: new Set(selectedNames) });
        }
    }, [pendingPrompts.length, results, summary]);

    const resolveAllSavesAndDamage = useCallback(async (selectedNames) => {
        const combatSummary = getCombatSummary(campaignName);
        if (!combatSummary) return;

        maybeStoreLastAttack(storeLastAttack !== false, campaignName, {
            casterName: playerStats.name,
            spellName: action.name,
            saveType,
            saveDc,
            attackScope: 'aoe',
        });

        const results = [];
        const prompts = [];
        const characters = combatSummary.creatures.filter(c => c.type === 'player');
        const scalingEntry = resolveScaling(playerStats, action.automation?.scaling);
        const resolvedDamage = scalingEntry?.damage || damage;

        // CLA-279: Radiant Soul — CHA mod lands on exactly ONE of the spell's targets (first eligible).
        const radiantSoulFlagKey = `_radiantSoul_${playerStats.name.replace(/\s+/g, '_')}_oncePerTurn`;
        let radiantSoulTarget = null;
        if (radiantSoulChaMod > 0 && !getRuntimeValue(playerStats.name, radiantSoulFlagKey, campaignName)) {
            radiantSoulTarget = selectedNames.find(n => combatSummary.creatures.some(c => c.name === n)) || null;
            if (radiantSoulTarget) {
                setRuntimeValue(playerStats.name, 'pendingRadiantSoulTarget', radiantSoulTarget, campaignName);
            }
        }

        for (const targetName of selectedNames) {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            if (!target) continue;

            const isNpc = target.type === 'npc';
            const ctx = { action, targetName, target, combatSummary, characters, resolvedDamage, damageType, saveType, saveDc, dcSuccess, radiantSoulChaMod, radiantSoulTarget, radiantSoulFlagKey, overchannelActive, heightenTarget, isCarefulSpell, isCarefulAlly, pullMarkerEffect, logSaveSuccess, playerStats, campaignName, saveConditions, sleepStaging, pushFeet, slowedClauses, weakeningBreath, acPenaltyClause, conditionDurationNote };

            if (isNpc) {
                results.push(resolveNpcTarget(ctx));
                continue;
            }

            const outcome = resolvePcTarget(ctx);
            if (outcome.result) {
                results.push(outcome.result);
            } else {
                prompts.push(outcome.prompt);
            }
        }

        persistAndNotify(combatSummary, campaignName);

        if (overchannelActive) {
            await handleOverchannelSelfDamage(playerStats.name, campaignName,
                { overchannelActive, overchannelUseCount, overchannelSpellLevel },
                (entry) => { addEntry(campaignName, entry).catch((e) => { console.error('[SaveAttackAoeModal] Error logging overchannel self-damage:', e); }); },
                characters);
        }

        // CLA-321: Soulstitch protection lasts only for the cast that wrote the stamp.
        clearSoulstitchStamp(playerStats.name, campaignName);

        // MA-0042: persisting-zone arm (byte-inert unless zoneTe authored).
        armZoneTargets({ zoneTe, selectedNames, casterName: playerStats.name, actionName: action.name, saveDc, saveType, campaignName });

        return { results, prompts };
    }, [campaignName, action, playerStats, damage, damageType, radiantSoulChaMod, dcSuccess, saveDc, saveType, isCarefulSpell, isCarefulAlly, heightenTarget, overchannelActive, overchannelUseCount, overchannelSpellLevel, pullMarkerEffect, logSaveSuccess, storeLastAttack, zoneTe, saveConditions, sleepStaging, pushFeet, slowedClauses, weakeningBreath, acPenaltyClause, conditionDurationNote]);

    function logSoulstitchAutoSave({ campaignName, playerStats, actionName, targetName, detail, saveBonus }) {
        addEntry(campaignName, {
            type: 'roll',
            rollType: 'save-damage',
            characterName: playerStats.name,
            name: `${actionName} (Soulstitch)`,
            targetName,
            saveType: detail.saveType,
            saveDc: detail.saveDc,
            dcSuccess: detail.dcSuccess,
            saveResult: 'soulstitch_auto_success',
            saveRoll: detail.roll ?? 0,
            saveBonus,
            finalDamage: 0,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging soulstitch auto-save:', e); });
    }

    function applyPlayerSaveDamage({ campaignName, combatSummary, playerStats, actionName, targetName, detail, success, saveBonus, saveDc, saveType, dcSuccess, damageType, rawDamage, targetDamageFormula, damageRoll, finalDamage, isRadiantSoulTarget, radiantSoulChaMod, radiantSoulFlagKey }) {
        const saveResult = success ? 'success' : 'failure';
        const detailRoll = detail.roll ?? 0;
        addEntry(campaignName, {
            type: 'roll',
            characterName: playerStats.name,
            rollType: 'save-damage',
            name: actionName,
            targetName,
            saveDc: saveDc,
            saveType: saveType,
            saveResult,
            total: detail.total ?? 0,
            rolls: [detailRoll],
            bonus: saveBonus,
            formula: `1d20${saveBonus !== 0 ? '+' + saveBonus : ''}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging player save:', e); });

        const characters = combatSummary?.creatures?.filter(c => c.type === 'player') || [];
        applyDamageToTarget(combatSummary, targetName, finalDamage, [damageType], { campaignName, characters: characters, ignoreResistance: false, attackerName: playerStats.name, suppressHpLog: false });

        if (isRadiantSoulTarget) {
            setRuntimeValue(playerStats.name, radiantSoulFlagKey, true, campaignName);
            setRuntimeValue(playerStats.name, 'pendingRadiantSoulTarget', null, campaignName);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: 'Radiant Soul',
                description: `Radiant Soul: +${radiantSoulChaMod} ${damageType} damage added to ${targetName}'s damage roll (once per turn).`,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging Radiant Soul:', e); });
        }

        addEntry(campaignName, {
            type: 'roll',
            characterName: playerStats.name,
            rollType: 'save-damage',
            name: actionName,
            formula: targetDamageFormula,
            rolls: damageRoll?.rolls ?? [],
            total: rawDamage,
            modifier: damageRoll?.modifier ?? 0,
            damageType: damageType,
            targetName,
            saveType: saveType,
            saveDc: saveDc,
            dcSuccess: dcSuccess,
            saveResult,
            saveRoll: detailRoll,
            saveBonus,
            saveRawRolls: [detailRoll, detailRoll],
            finalDamage: finalDamage,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging player damage:', e); });
    }

    function logPlayerSaveSuccess({ campaignName, playerStats, actionName, targetName, detail, saveBonus }) {
        addEntry(campaignName, {
            type: 'roll',
            rollType: 'save-damage',
            characterName: playerStats.name,
            name: actionName,
            targetName,
            saveType: detail.saveType,
            saveDc: detail.saveDc,
            dcSuccess: detail.dcSuccess,
            saveResult: 'success',
            saveRoll: detail.roll ?? 0,
            saveBonus,
            finalDamage: 0,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging player save success:', e); });
    }

    const handleSaveResult = useCallback(async (event, ctx) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const targetName = pendingPrompts[pendingIndex].targetName;
        // CLA-321: soulstitch-chosen target auto-succeeds the prompt's save, takes no damage.
        const isSoulstitchProtected = hasSoulstitchProtection(targetName, playerStats.name, campaignName);
        const { success, rawDamage, saveBonus } = resolveSoulstitchOutcome(detail, isSoulstitchProtected);
        const saveRoll = detail.roll ?? 0;
        const saveTotal = detail.total ?? 0;

        const combatSummary = getCombatSummary(campaignName);
        const finalDamage = resolveEvasionFinalDamage({ combatSummary, targetName, rawDamage, success, saveType: detail.saveType, dcSuccess });

        if (isSoulstitchProtected) {
            logSoulstitchAutoSave({ campaignName, playerStats, actionName: action.name, targetName, detail, saveBonus });
        }

        const { radiantSoulFlagKey, isRadiantSoulTarget, targetDamageFormula, damageRoll } = resolveRadiantSoulDamageRoll({ playerStats, action, damage, campaignName, radiantSoulChaMod, overchannelActive, targetName });

        if (finalDamage > 0) {
            applyPlayerSaveDamage({ campaignName, combatSummary, playerStats, actionName: action.name, targetName, detail, success, saveBonus, saveDc, saveType, dcSuccess, damageType, rawDamage, targetDamageFormula, damageRoll, finalDamage, isRadiantSoulTarget, radiantSoulChaMod, radiantSoulFlagKey });
        }

        if (!success && pullMarkerEffect) {
            // CLA-384: feature-flagged save-fail marker (e.g. Warping Implosion pull).
            registerTargetEffect(campaignName, targetName, pullMarkerEffect, action.name, { duration: 'instant' });
        }
        // MA-0068 staged sleep / MA-0063 one-shot grant dispatch (byte-inert
        // when neither flag authored).
        resolveSaveFailGrant({ sleepStaging, success, saveDc, saveType, targetName, playerStats, action, saveRoll, saveBonus, saveConditions, campaignName, pushFeet, slowedClauses, weakeningBreath, acPenaltyClause, conditionDurationNote });
        if (success && logSaveSuccess) {
            logPlayerSaveSuccess({ campaignName, playerStats, actionName: action.name, targetName, detail, saveBonus });
        }

        addTargetResult(campaignName, {
            targetName,
            saveResult: saveResultLabel(isSoulstitchProtected, success),
            roll: saveRoll,
            total: saveTotal,
            conditions: [],
            appliedDamage: finalDamage,
        });

        if (combatSummary) {
            persistAndNotify(combatSummary, campaignName);
        }
        const targetResult = {
            targetName,
            success,
            roll: saveRoll,
            total: saveTotal,
            saveBonus,
            rawDamage,
            finalDamage,
            soulstitchProtected: isSoulstitchProtected,
        };
        const setters = ctx || { setResults, setPendingPrompts };
        appendPromptTargetResult(setters.setResults, setters.setPendingPrompts, targetResult, detail.promptId);
    }, [campaignName, damage, damageType, radiantSoulChaMod, dcSuccess, action, playerStats, saveDc, saveType, pendingPrompts, overchannelActive, pullMarkerEffect, logSaveSuccess, saveConditions, sleepStaging, pushFeet, slowedClauses, weakeningBreath, acPenaltyClause, conditionDurationNote]);

    useEffect(() => {
        if (pendingPrompts.length === 0) return;
        const handleSaveEvent = (event) => {
            handleSaveResult(event, null);
        };
        window.addEventListener('save-result', handleSaveEvent);
        return () => window.removeEventListener('save-result', handleSaveEvent);
    }, [pendingPrompts.length, handleSaveResult]);

    const handleApply = useCallback(async (ctx) => {
        if (!summary) {
            ctx.setProcessing(true);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: action.name,
                description: `${action.name}: Selecting ${ctx.selected.size} target(s) for save (DC ${saveDc} ${saveType})`,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging feature use:', e); });

            const { results: newResults, prompts } = await resolveAllSavesAndDamage(Array.from(ctx.selected));
            ctx.setResults(newResults);
            ctx.setPendingPrompts(prompts);
        }
    }, [summary, campaignName, playerStats.name, action.name, saveDc, saveType, resolveAllSavesAndDamage]);

    const combatSummary = getCombatSummary(campaignName);
    const isOverlayTargeted = playerStats.targetName?.startsWith('overlay-');

    const eligibleTargets = React.useMemo(
        () => buildEligibleTargets(combatSummary, playerStats.name, isCarefulSpell, isCarefulAlly, [...(excludeNames || []), ...weakenedNamesFor(combatSummary?.creatures, playerStats.name, weakeningBreath)]),
        [combatSummary, isCarefulSpell, isCarefulAlly, playerStats.name, excludeNames, weakeningBreath]);

    const rangeAllowed = useRangeAllowedSet(eligibleTargets, rangeGateFt, playerStats.name);


    const toggleTarget = useCallback((name) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    }, []);

    const handleCreatureSelectionConfirm = useCallback(async (selectedNames) => {
        setSelected(new Set(selectedNames));

        if (zoneOnly) {
            // MA-0043: zone arming only — no saves, no damage, no lastAttack.
            armZoneTargets({ zoneTe, selectedNames, casterName: playerStats.name, actionName: action.name, saveDc, saveType, campaignName });
            setResults([]);
            setPendingPrompts([]);
            setSummary({ results: [], selected: new Set(selectedNames) });
            return;
        }

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${action.name}: Selecting ${selectedNames.length} target(s) for save (DC ${saveDc} ${saveType})`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging feature use:', e); });

        const combatSummary = getCombatSummary(campaignName);
        if (!combatSummary) return;

        const { results, prompts } = await resolveAllSavesAndDamage(selectedNames);

        setResults(results);
        setPendingPrompts(prompts);

        if (prompts.length === 0 && results.length > 0) {
            setSummary({ results, selected: new Set(selectedNames) });
        }
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, zoneOnly, zoneTe, resolveAllSavesAndDamage]);

    const handleCreatureSelectionSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    const renderBody = (ctx) => {
        if (!ctx.processing && !ctx.allResolved && !summary) {
            return (
                <>
                    <p>Select creatures in the area of effect. Each must make a <strong>{saveType}</strong> saving throw (DC {saveDc}).</p>
                    <DamageNote damage={damage} damageType={damageType} dcSuccess={dcSuccess} />
                    {metamagicHeighten && <p className="sp-note">Heightened Spell: select one target for disadvantage on its first save.</p>}
                    <p className="sp-note">Targets selected: {ctx.selected.size}/{ctx.eligibleTargets.length}</p>
                    {metamagicCareful && renderTargetList({ eligibleTargets: ctx.eligibleTargets, selected: ctx.selected, toggleTarget: ctx.toggleTarget, isCarefulAlly: ctx.isCarefulAlly, heightenTarget: ctx.heightenTarget, setHeightenTarget: ctx.setHeightenTarget, metamagicHeighten: metamagicHeighten })}
                    {!metamagicCareful && renderTargetList({ eligibleTargets: ctx.eligibleTargets, selected: ctx.selected, toggleTarget: ctx.toggleTarget, heightenTarget: ctx.heightenTarget, setHeightenTarget: ctx.setHeightenTarget, metamagicHeighten: metamagicHeighten })}
                </>
            );
        }

        if (ctx.processing || ctx.pendingPrompts.length > 0) {
            return (
                <>
                    <p>Resolving {saveType} saving throws (DC {saveDc})...</p>
                    <div className="abjure-results-list">
                        {ctx.results.map(r => (
                            <div key={r.targetName} className={`abjure-result ${r.success ? 'abjure-result-success' : 'abjure-result-fail'}`}>
                                <strong>{r.targetName}</strong>: {resultRowText(r, damage, damageType, sleepStaging)}
                            </div>
                        ))}
                        {ctx.pendingPrompts.map(p => (
                            <div key={p.promptId} className="abjure-result abjure-result-pending">
                                <strong>{p.targetName}</strong>: <em>Waiting for save roll...</em>
                            </div>
                        ))}
                    </div>
                    {ctx.allResolved && (
                        <p className="sp-note" style={{ marginTop: '8px' }}>All targets resolved.</p>
                    )}
                </>
            );
        }

        return null;
    };

    const renderActions = (ctx) => {
        if (!ctx.processing && !ctx.allResolved && !summary) {
            return (
                <>
                    <button className="sp-roll-btn" onClick={() => handleApply(ctx)} disabled={ctx.selected.size === 0 || ctx.processing} type="button">
                        <i className="fa-solid fa-bomb"></i> {action.name} ({ctx.selected.size} target{ctx.selected.size !== 1 ? 's' : ''})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">Cancel</button>
                </>
            );
        }

        if (ctx.allResolved && ctx.pendingPrompts.length === 0 && summary === null) {
            setSummary({
                results: [...ctx.results],
                selected: ctx.selected,
            });
        }

        return null;
    };

    const extraState = { selected, setSelected, toggleTarget, heightenTarget, setHeightenTarget };

    if (summary) {
        return (
            <div className="sp-overlay">
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-bomb"></i> {action.name} — Results
                    </div>
                    <div className="sp-body">
                        <ZoneArmedNote zoneOnly={zoneOnly} zoneTe={zoneTe} selected={summary.selected} />
                        <div className="abjure-results-list">
                            {summary.results.map(r => (
                                <div key={r.targetName} className={`abjure-result ${r.success ? 'abjure-result-success' : 'abjure-result-fail'}`}>
                                    <strong>{r.targetName}</strong>: {resultRowText(r, damage, damageType, sleepStaging)}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onClose} type="button">
                            <i className="fa-solid fa-check"></i> Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isOverlayTargeted && activeOverlay) {
        return (
            <AreaEffectTargetModalBase
                combatSummary={combatSummary}
                attackerName={playerStats.name}
                attackerPos={null}
                saveDc={saveDc}
                campaignName={campaignName}
                mapData={null}
                featureName={action.name}
                saveType={saveType}
                rangeFeet={range}
                onClose={onClose}
                icon="fa-solid fa-bomb"
                handleApplyOverride={handleApply}
                handleSaveResultOverride={handleSaveResult}
                extraState={extraState}
                renderBody={renderBody}
                renderActions={renderActions}
            />
        );
    }

    const pickerCopy = buildPickerCopy({ zoneOnly, zoneTe, range, saveType, saveDc, damage, damageType, metamagicHeighten, saveConditions, sleepStaging, slowedClauses, weakeningBreath, dcSuccess });

    return (
        <CreatureSelectionModal
            title={aoePickerTitle(action, titleOverride)}
            icon={pickerCopy.icon}
            targets={toPickerTargets(eligibleTargets, rangeAllowed)}
            description={pickerCopy.description}
            note={pickerCopy.note}
            confirmLabel={action.name}
            confirmIcon="fa-bomb"
            onConfirm={handleCreatureSelectionConfirm}
            onSkip={handleCreatureSelectionSkip}
            metamagicHeighten={metamagicHeighten}
            heightenTarget={heightenTarget}
            setHeightenTarget={setHeightenTarget}
        />
    );
}

export default SaveAttackAoeModal;