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
    const { action, targetName, target, combatSummary, characters, resolvedDamage, damageType, saveType, saveDc, dcSuccess, radiantSoulChaMod, radiantSoulTarget, radiantSoulFlagKey, overchannelActive, isCarefulSpell, isCarefulAlly, pullMarkerEffect, logSaveSuccess, playerStats, campaignName } = ctx;
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
    const resResult = computeDamageAfterResistancesWithDetails(damageAfterSave, [damageType], resistances, immunities, false);
    let finalDamage = resResult.finalDamage;

    if (carefulSpellProtected) {
        finalDamage = 0;
    }

    if (finalDamage > 0) {
        applyDamageToTarget(combatSummary, targetName, finalDamage, [damageType], campaignName, characters, { ignoreResistance: true, attackerName: playerStats.name, suppressHpLog: false });
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
    const { action, targetName, combatSummary, characters, resolvedDamage, damageType, saveType, saveDc, dcSuccess, radiantSoulChaMod, radiantSoulTarget, overchannelActive, isCarefulSpell, isCarefulAlly, heightenTarget, playerStats, campaignName } = ctx;
    const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);
    const isSoulstitchProtected = hasSoulstitchProtection(targetName, playerStats.name, campaignName);

    if (isSoulstitchProtected) {
        // CLA-321: chosen creature auto-succeeds its save — no prompt, no damage.
        applyDamageToTarget(combatSummary, targetName, 0, [damageType], campaignName, characters, { ignoreResistance: true, attackerName: playerStats.name, suppressHpLog: false });
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
        applyDamageToTarget(combatSummary, targetName, 0, [damageType], campaignName, characters, { ignoreResistance: true, attackerName: playerStats.name, suppressHpLog: false });
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

        storeSpellLastAttack(campaignName, {
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
            const ctx = { action, targetName, target, combatSummary, characters, resolvedDamage, damageType, saveType, saveDc, dcSuccess, radiantSoulChaMod, radiantSoulTarget, radiantSoulFlagKey, overchannelActive, heightenTarget, isCarefulSpell, isCarefulAlly, pullMarkerEffect, logSaveSuccess, playerStats, campaignName };

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

        return { results, prompts };
    }, [campaignName, action, playerStats, damage, damageType, radiantSoulChaMod, dcSuccess, saveDc, saveType, isCarefulSpell, isCarefulAlly, heightenTarget, overchannelActive, overchannelUseCount, overchannelSpellLevel, pullMarkerEffect, logSaveSuccess]);

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
        applyDamageToTarget(combatSummary, targetName, finalDamage, [damageType], campaignName, characters, { ignoreResistance: false, attackerName: playerStats.name, suppressHpLog: false });

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
    }, [campaignName, damage, damageType, radiantSoulChaMod, dcSuccess, action, playerStats, saveDc, saveType, pendingPrompts, overchannelActive, pullMarkerEffect, logSaveSuccess]);

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

    const eligibleTargets = React.useMemo(() => {
        if (!combatSummary?.creatures) return [];
        return combatSummary.creatures
            .filter(c => !isTargetExcludedByTraps(c, playerStats.name))
            .map(c => ({
                ...c,
                carefulSpellProtected: isCarefulSpell && isCarefulAlly(c.name),
            }));
    }, [combatSummary, isCarefulSpell, isCarefulAlly, playerStats.name]);

    const getCreatureTargets = () => {
        return eligibleTargets.map(c => ({
            name: c.name,
            type: c.type,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            carefulSpellProtected: c.carefulSpellProtected,
        }));
    };

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
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, resolveAllSavesAndDamage]);

    const handleCreatureSelectionSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    const renderBody = (ctx) => {
        if (!ctx.processing && !ctx.allResolved && !summary) {
            return (
                <>
                    <p>Select creatures in the area of effect. Each must make a <strong>{saveType}</strong> saving throw (DC {saveDc}).</p>
                    <p className="sp-note">On a failed save, target takes {damage} {damageType} damage. On a successful save, target takes half damage.</p>
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
                                <strong>{r.targetName}</strong>: {r.soulstitchProtected
                                    ? 'Soulstitch — automatically succeeds, takes no damage'
                                    : r.success
                                        ? (r.finalDamage ?? 0) > 0
                                            ? `Saved — takes ${r.finalDamage} ${damageType} damage (rolled ${r.roll ?? 0}, halved)`
                                            : `Saved — takes no damage (rolled ${r.roll ?? 0})`
                                        : `Failed — takes ${r.finalDamage ?? 0} ${damageType} damage (rolled ${r.roll ?? 0})`}
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
                        <div className="abjure-results-list">
                            {summary.results.map(r => (
                                <div key={r.targetName} className={`abjure-result ${r.success ? 'abjure-result-success' : 'abjure-result-fail'}`}>
                                    <strong>{r.targetName}</strong>: {r.soulstitchProtected
                                        ? 'Soulstitch — automatically succeeds, takes no damage'
                                        : r.success
                                            ? (r.finalDamage ?? 0) > 0
                                                ? `Saved — takes ${r.finalDamage} ${damageType} damage (rolled ${r.roll ?? 0}, halved)`
                                                : `Saved — takes no damage (rolled ${r.roll ?? 0})`
                                            : `Failed — takes ${r.finalDamage ?? 0} ${damageType} damage (rolled ${r.roll ?? 0})`}
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

    return (
        <CreatureSelectionModal
            title={action.name}
            icon="fa-bomb"
            targets={getCreatureTargets()}
            description={`Select creatures in the area of effect. Each must make a <strong>${saveType}</strong> saving throw (DC ${saveDc}).`}
            note={`On a failed save, target takes ${damage} ${damageType} damage. On a successful save, target takes half damage.${metamagicHeighten ? ' Heightened Spell: one target will have disadvantage.' : ''}`}
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