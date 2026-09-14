import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import utils from '../../services/ui/utils.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { createSaveListener } from '../../services/automation/common/savePrompt.js';
import { addEntry } from '../../services/ui/logService.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { normalizeSaveType, computeDamageAfterEvasion, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { isCircleOfPowerActive } from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { hasIgnoreResistance, playerIsImmuneToCondition } from '../../services/combat/automation/automationService.js';
import { spendMonsterAbilityUse } from '../../services/encounters/monsterAbilityUses.js';
import { registerTargetEffect, getActiveTargetEffect } from '../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../services/rules/effects/expirationQueue.js';
import { parseSuccessImmunity } from '../../components/encounter/MonsterCardHelpers.js';
import { trackFrightfulPresence } from '../../services/rules/features/frightfulPresenceService.js';

export async function processSaveRoll({ rollType, target, characterName, campaignName, context, bonus, r1, r2, logEntry, setPopupHtml }) {
    const saveDc = context?.saveDc;
    const saveType = context?.saveType;
    const attackerName = context?.attackerName || characterName;
    const actionName = context?.actionName || context.name;
    const targetType = target?.type;
    const targetIsPlayer = targetType === 'player';
    const targetName = target?.name || context?.targetName;
    const useNpcPath = !saveDc || !targetIsPlayer;

    console.debug(`[saveDebug] processSaveRoll branch decision`, {
        rollType, saveDc, saveType, attackerName, actionName,
        targetName, targetType, targetIsPlayer,
        explicitContextTargetName: context?.targetName,
        branch: useNpcPath ? 'processNpcSave' : 'processPlayerSave',
        characterName,
    });

    if (useNpcPath) {
        return await processNpcSave({ rollType, target, characterName, campaignName, context, bonus, r1, r2, logEntry, setPopupHtml, saveDc, saveType, attackerName, actionName, targetName });
    }

    return await processPlayerSave({ target, characterName, campaignName, context, bonus, r1, r2, logEntry, setPopupHtml, saveDc, saveType, attackerName, actionName, targetName });
}

function stampPlayerSaveRolls({ characterName, campaignName, effectiveD20ForSave, saveResult, saveType, saveDc, actionName, targetName }) {
    setRuntimeValue(characterName, 'lastSaveRoll', {
        d20: effectiveD20ForSave,
        bonus: saveResult.saveBonus,
        saveType: saveType || null,
        targetName,
        timestamp: Date.now(),
    }, campaignName);

    setRuntimeValue(characterName, '_lastRollContext', {
        type: 'save',
        saveType: saveType || null,
        saveDc,
        actionName,
        targetName,
        oldTotal: saveResult.total,
        oldSuccess: saveResult.total >= saveDc,
        timestamp: Date.now(),
    }, campaignName);
}

async function stampPlayerSaveLastAttack({ target, context, campaignName, attackerName, effectiveD20ForSave, saveResult, saveSuccess, saveType, saveDc, actionName }) {
    const combatSummary = await loadCombatSummary(campaignName);
    if (!combatSummary) return;
    setRuntimeValue('campaign', 'lastAttack', {
        attackerName,
        targetName: target?.name || context?.targetName,
        d20: effectiveD20ForSave,
        d20Rolls: [saveResult.roll, ...(saveResult.rawRolls || [])],
        bonus: saveResult.saveBonus,
        total: saveResult.total,
        saveType,
        saveDc,
        saveResult: saveSuccess ? 'success' : 'failure',
        isNatural20: saveResult.roll === 20,
        isNatural1: saveResult.roll === 1,
        attackName: context?.actionName || context?.autoDamageName || context.name,
        actionName,
        rollType: 'save',
        // CLA-324: spell-origin stamp for save-based attacks rolled from the monster card.
        isSpellDamage: true,
        saveConditions: context?.saveConditions || [],
        timestamp: Date.now(),
    }, campaignName);
}

function buildPlayerSaveLogData({ targetName, characterName, actionName, effectiveD20ForSave, saveResult, saveSuccess, saveType, saveDc, attackerName, context }) {
    return {
        type: 'roll',
        characterName: targetName || characterName,
        rollType: 'save',
        name: actionName,
        rolls: [effectiveD20ForSave],
        mode: saveResult.mode || 'normal',
        total: saveResult.total,
        bonus: saveResult.saveBonus,
        bonusDetail: saveResult.bonusDetail,
        baneRoll: saveResult.baneRoll,
        isNatural20: effectiveD20ForSave === 20,
        isNatural1: effectiveD20ForSave === 1,
        targetName: targetName,
        saveType: saveType,
        saveDc: saveDc,
        saveResult: saveSuccess ? 'success' : 'failure',
        attackerName: attackerName,
        dcSuccess: context?.dcSuccess,
        timestamp: Date.now(),
        id: utils.guid(),
    };
}

async function processPlayerSave({ target, characterName, campaignName, context, logEntry, setPopupHtml, saveDc, saveType, attackerName, actionName, targetName }) {
    const { promise } = createSaveListener(campaignName, {
        targetName,
        saveType: saveType || 'CON',
        saveDc,
        dcSuccess: context?.dcSuccess || 'half',
        attackerName: attackerName,
        // CLA-324: monster-card save-based attacks are spell-like save attacks (eye rays,
        // magical rays) — flag spell-origin so against_spell gates can discriminate.
        isSpellDamage: true,
    });

    const saveResult = await promise;
    const saveSuccess = saveResult.success;
    const effectiveD20ForSave = saveResult.roll;
    const saveTotal = saveResult.total;

    stampPlayerSaveRolls({ characterName, campaignName, effectiveD20ForSave, saveResult, saveType, saveDc, actionName, targetName });
    await stampPlayerSaveLastAttack({ target, context, campaignName, attackerName, effectiveD20ForSave, saveResult, saveSuccess, saveType, saveDc, actionName });

    logEntry(buildPlayerSaveLogData({ targetName, characterName, actionName, effectiveD20ForSave, saveResult, saveSuccess, saveType, saveDc, attackerName, context }));

    // Apply save-triggered damage and conditions
    await applySaveOutcome({ context, characterName, campaignName, attackerName, targetName, saveType, saveDc, saveSuccess, effectiveD20ForSave, saveTotal: saveResult.total, logEntry, setPopupHtml });

    return { saveSuccess, effectiveD20ForSave, saveTotal, saveResult };
}

// Cosmic Omen: apply global pending bonus to effectiveD20
function applyCosmicOmenToSave(effectiveD20, campaignName) {
    let adjusted = effectiveD20;
    const cosmicOmenPendingRawSave2 = getRuntimeValue('cosmicOmen', 'cosmicOmenPendingBonus');
    if (!cosmicOmenPendingRawSave2) return adjusted;
    try {
        const pending = JSON.parse(cosmicOmenPendingRawSave2);
        if (pending && typeof pending.value === 'number' && pending.value > 0) {
            const isWeal = pending.type === 'Weal';
            adjusted += isWeal ? pending.value : -pending.value;
            setRuntimeValue('cosmicOmen', 'cosmicOmenPendingBonus', null, campaignName, true);
        }
    } catch (_e) { /* ignore */ }
    return adjusted;
}

// Bane/Blade Ward: apply -1d4 penalty to saving throws
function rollBaneSavePenalty(allTargetEffectsForSave, targetName) {
    const baneEffectsForSave = allTargetEffectsForSave.filter(te => te.target === targetName && te.effect === 'bane_penalty');
    if (baneEffectsForSave.length === 0) return { baneSavePenalty: 0, baneSaveRoll: null, baneSaveDisplayLabel: 'Bane' };
    const r = rollExpression('1d4');
    if (!r) return { baneSavePenalty: 0, baneSaveRoll: null, baneSaveDisplayLabel: 'Bane' };
    return { baneSavePenalty: -r.total, baneSaveRoll: r.total, baneSaveDisplayLabel: baneEffectsForSave[0].displayLabel || 'Bane' };
}

// Bane/Blade Ward on attacker: grant +1d4 to the target's save when the attacker is cursed
function rollBaneAttackerBonus(allTargetEffectsForSave, attackerName) {
    if (!attackerName) return { baneAttackerBonus: 0, baneAttackerRoll: null, baneAttackerDisplayLabel: 'Bane' };
    const baneOnAttacker = allTargetEffectsForSave.filter(te => te.target === attackerName && te.effect === 'bane_penalty');
    if (baneOnAttacker.length === 0) return { baneAttackerBonus: 0, baneAttackerRoll: null, baneAttackerDisplayLabel: 'Bane' };
    const r = rollExpression('1d4');
    if (!r) return { baneAttackerBonus: 0, baneAttackerRoll: null, baneAttackerDisplayLabel: 'Bane' };
    return { baneAttackerBonus: r.total, baneAttackerRoll: r.total, baneAttackerDisplayLabel: baneOnAttacker[0].displayLabel || 'Bane' };
}

// Bless: add 1d4 to saving throws for blessed targets
function rollBlessSaveBonus(allTargetEffectsForSave, targetName) {
    const blessEffectsForSave = allTargetEffectsForSave.filter(te => te.target === targetName && te.effect === 'bless_bonus');
    if (blessEffectsForSave.length === 0) return { blessSaveBonus: 0, blessSaveRoll: null };
    const r = rollExpression('1d4');
    if (!r) return { blessSaveBonus: 0, blessSaveRoll: null };
    return { blessSaveBonus: r.total, blessSaveRoll: r.total };
}

// Warding Bond: +1 flat bonus to saving throws
function resolveWardingBondSaveBonus(targetName, campaignName) {
    const targetBuffsForSave = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const targetActiveBuffsForSave = Array.isArray(targetBuffsForSave) ? targetBuffsForSave : [];
    const wardingBondBuffForSave = targetActiveBuffsForSave.find(b => b.effect === 'warding_bond' && b.saveBonus);
    return wardingBondBuffForSave ? wardingBondBuffForSave.saveBonus : 0;
}

function stampNpcSaveLastAttack({ attackerName, target, context, campaignName, effectiveD20ForSave, r1, r2, bonus, saveTotal, saveSuccess, saveType, saveDc, actionName }) {
    setRuntimeValue('campaign', 'lastAttack', {
        attackerName,
        targetName: target?.name || context?.targetName,
        d20: effectiveD20ForSave,
        d20Rolls: [r1, r2],
        bonus,
        total: saveTotal,
        saveType,
        saveDc,
        saveResult: saveSuccess ? 'success' : 'failure',
        isNatural20: r1 === 20,
        isNatural1: r1 === 1,
        attackName: context?.actionName || context?.autoDamageName || context.name,
        actionName,
        rollType: 'save',
        // CLA-324: spell-origin stamp for save-based attacks rolled from the monster card.
        isSpellDamage: true,
        saveConditions: context?.saveConditions || [],
        timestamp: Date.now(),
    }, campaignName);
}

function buildNpcSaveLogData({ targetName, characterName, actionName, effectiveD20ForSave, context, saveTotal, bonus, baneSaveRoll, baneSaveDisplayLabel, baneAttackerRoll, baneAttackerDisplayLabel, blessSaveRoll, wardingBondSaveBonus, saveType, saveDc, saveSuccess, attackerName }) {
    return {
        type: 'roll',
        characterName: targetName || characterName,
        rollType: 'save',
        name: actionName,
        rolls: [effectiveD20ForSave],
        mode: context?.forcedMode || 'normal',
        total: saveTotal,
        bonus,
        baneRoll: baneSaveRoll,
        baneDisplayLabel: baneSaveDisplayLabel,
        baneAttackerRoll: baneAttackerRoll,
        baneAttackerDisplayLabel: baneAttackerDisplayLabel,
        blessRoll: blessSaveRoll,
        wardingBondSaveBonus,
        isNatural20: effectiveD20ForSave === 20,
        isNatural1: effectiveD20ForSave === 1,
        targetName: targetName,
        saveType: saveType,
        saveDc: saveDc,
        saveResult: saveSuccess != null ? (saveSuccess ? 'success' : 'failure') : null,
        attackerName: attackerName,
        dcSuccess: context?.dcSuccess,
        timestamp: Date.now(),
        id: utils.guid(),
    };
}

async function processNpcSave({ target, characterName, campaignName, context, bonus, r1, r2, logEntry, setPopupHtml, saveDc, saveType, attackerName, actionName, targetName }) {
    const effectiveD20ForSave = applyCosmicOmenToSave(context.effectiveD20, campaignName);

    const allTargetEffectsForSave = getRuntimeValue('campaign', 'targetEffects') || [];
    const { baneSavePenalty, baneSaveRoll, baneSaveDisplayLabel } = rollBaneSavePenalty(allTargetEffectsForSave, targetName);
    const { baneAttackerBonus, baneAttackerRoll, baneAttackerDisplayLabel } = rollBaneAttackerBonus(allTargetEffectsForSave, attackerName);
    const { blessSaveBonus, blessSaveRoll } = rollBlessSaveBonus(allTargetEffectsForSave, targetName);
    const wardingBondSaveBonus = resolveWardingBondSaveBonus(targetName, campaignName);

    const saveTotal = effectiveD20ForSave + bonus + baneSavePenalty + blessSaveBonus + baneAttackerBonus + wardingBondSaveBonus;
    const saveSuccess = saveDc != null ? (saveTotal >= saveDc) : null;
    const saveTypeValue = context?.saveType || null;
    const saveDcValue = context?.saveDc || null;
    const oldSuccess = saveDcValue != null ? (context.effectiveD20 + bonus >= saveDcValue) : null;

    setRuntimeValue(characterName, 'lastSaveRoll', {
        d20: effectiveD20ForSave,
        bonus,
        saveType: saveTypeValue,
        targetName,
        timestamp: Date.now(),
    }, campaignName);

    setRuntimeValue(characterName, '_lastRollContext', {
        type: 'save',
        saveType: saveTypeValue,
        saveDc: saveDcValue,
        actionName: context?.actionName || context.name,
        targetName,
        oldTotal: context.effectiveD20 + context.effectiveBonus,
        oldSuccess,
        timestamp: Date.now(),
    }, campaignName);

    const combatSummary = await loadCombatSummary(campaignName);
    if (saveDc != null && combatSummary) {
        stampNpcSaveLastAttack({ attackerName, target, context, campaignName, effectiveD20ForSave, r1, r2, bonus, saveTotal, saveSuccess, saveType, saveDc, actionName });
    }

    logEntry(buildNpcSaveLogData({ targetName, characterName, actionName, effectiveD20ForSave, context, saveTotal, bonus, baneSaveRoll, baneSaveDisplayLabel, baneAttackerRoll, baneAttackerDisplayLabel, blessSaveRoll, wardingBondSaveBonus, saveType, saveDc, saveSuccess, attackerName }));

    // Apply save-triggered damage and conditions
    await applySaveOutcome({ context, characterName, campaignName, attackerName, targetName, saveType, saveDc, saveSuccess, effectiveD20ForSave, saveTotal, logEntry, setPopupHtml });

    return { saveSuccess, effectiveD20ForSave, saveTotal };
}

function resolveSaveEvasion({ context, characters, applyTarget, normalizedSaveType, isIncapacitated, campaignName }) {
    const targetChar = (characters || []).find(c => c.name === applyTarget);
    const ownEvasion = targetChar?.computedStats?.evasionEffects;
    const hasOwnEvasion = !isIncapacitated && context?.dcSuccess === 'half' && ownEvasion?.some(ef => ef.saveType === normalizedSaveType);
    const hasSharedEvasion = !hasOwnEvasion && !isIncapacitated && context?.dcSuccess === 'half' &&
        (characters || []).some(c => {
            if (c.name === applyTarget) return false;
            const ev = c?.computedStats?.evasionEffects;
            return ev?.some(ef => ef.saveType === normalizedSaveType && ef.shareable && ef.shareRange >= 5);
        });
    const hasEvasion = hasOwnEvasion || hasSharedEvasion || isCircleOfPowerActive(applyTarget, campaignName);
    return { targetChar, hasOwnEvasion, hasEvasion };
}

// Authored outcome-keyed te clause grants (MA-0030 success-immunity,
// MA-0038 failed-save concentration-disadvantage).
async function applyAuthoredClauseGrants({ context, saveSuccess, campaignName, attackerName, applyTarget }) {
    // MA-0030: "Success: immune to this yeti's Chilling Gaze for 1 hour" —
    // 1 hour encoded as 600 rounds (CLA-334 minutes×10).
    if (saveSuccess === true && context?.successImmunity) {
        await grantSuccessImmunity({ context, campaignName, attackerName, applyTarget });
    }
    // MA-0038: Cloud of Insects — "Disadvantage on saving throws to maintain
    // Concentration until the end of its next turn". te sourced from the
    // dragon; duration: 'until_end_of_next_turn' with rounds:2 drained by
    // the pendingExpirations clock (HurlThroughHell codebase convention).
    if (saveSuccess === false && context?.concentrationDisadvantage) {
        await grantConcentrationDisadvantage({ context, campaignName, attackerName, applyTarget });
    }
    // MA-0073: Scorching Sands — "the target's Speed is halved until the
    // end of its next turn". te producer mirror of the MA-0038 shape.
    if (saveSuccess === false && context?.speedHalf) {
        await grantSpeedHalf({ context, campaignName, attackerName, applyTarget });
    }
}

async function applySaveOutcome({ context, characterName, campaignName, attackerName, targetName, saveType, saveDc, saveSuccess, effectiveD20ForSave, saveTotal, logEntry, setPopupHtml }) {
    // MA-0020: ability N/Day spend lands here — prompt-confirm seam (reaches
    // this point only once the save has resolved), regardless of the outcome.
    if (context?.monsterAbilityUse) {
        await spendMonsterAbilityUse({ monsterName: attackerName, use: context.monsterAbilityUse, targetName: targetName || characterName, campaignName });
    }
    await applyAuthoredClauseGrants({ context, saveSuccess, campaignName, attackerName, applyTarget: targetName || characterName });
    if (context?.autoDamageFormula && saveDc != null) {
        await applySaveDamage({ context, characterName, campaignName, attackerName, targetName, saveType, saveDc, saveSuccess, effectiveD20ForSave, saveTotal, logEntry, setPopupHtml, characters: context._characters });
    } else {
        applyDamagelessSaveConditions({ context, saveDc, saveSuccess, applyTarget: targetName || characterName, attackerName, campaignName });
    }
    // MA-0048: authored repeat-save clause (Frightful Presence) — arm the
    // turn-end repeat-save marker on a failed save.
    if (saveSuccess === false && context?.repeatSave) {
        await trackFrightfulPresence({
            campaignName,
            attackerName,
            targetName: targetName || characterName,
            saveType: context.repeatSave.save_type || saveType,
            saveDc,
        });
    }
}

// MA-0030: successful-save immunity grant. Writes a registry te (e.g.
// gaze_immunity) on the target sourced from the attacker, with a
// minutes×10 rounds clock (CLA-334) removing the te via remove_target_effect.
async function grantSuccessImmunity({ context, campaignName, attackerName, applyTarget }) {
    const immunity = parseSuccessImmunity({ success_immunity: context.successImmunity });
    if (!immunity) return;
    const rounds = immunity.durationMinutes * 10;
    registerTargetEffect(campaignName, applyTarget, immunity.effect, attackerName, { duration: immunity.duration, rounds });
    addExpiration({ attackerName, targetName: applyTarget, campaignName, rounds, effects: [{ type: 'remove_target_effect', effectKey: immunity.effect, source: attackerName, target: applyTarget }] });
    const actionName = context?.actionName || context?.name || 'the gaze';
    await addEntry(campaignName, {
        type: 'automation',
        automationType: `${immunity.effect}_granted`,
        characterName: applyTarget,
        sourceName: attackerName,
        abilityName: actionName,
        description: `${applyTarget} succeeded its save against ${attackerName}'s ${actionName} — immune to it for ${immunity.durationMinutes / 60 >= 1 ? `${immunity.durationMinutes / 60} hour(s)` : `${immunity.durationMinutes} minute(s)`} (${rounds} rounds).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveProcessing:gaze-immunity-granted]', e); });
}

// MA-0038: failed-save concentration-disadvantage grant. Writes the
// registry te (concentration_disadvantage) on the target sourced from the
// attacker, duration until_end_of_next_turn (rounds:2 clock), and logs the
// named clause. Consumers: concentrationPromptRoll, applyDamage NPC
// concentration leg, createConcentrationHandlers GM roll.
async function grantConcentrationDisadvantage({ context, campaignName, attackerName, applyTarget }) {
    const actionName = context?.actionName || context?.name || 'the action';
    registerTargetEffect(campaignName, applyTarget, 'concentration_disadvantage', attackerName, {
        duration: 'until_end_of_next_turn',
        actionName,
    });
    addExpiration({
        attackerName,
        targetName: applyTarget,
        campaignName,
        rounds: 2,
        effects: [{ type: 'remove_target_effect', effectKey: 'concentration_disadvantage', source: attackerName, target: applyTarget }],
    });
    const granted = getActiveTargetEffect(campaignName, applyTarget, 'concentration_disadvantage');
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'concentration_disadvantage_granted',
        characterName: applyTarget,
        sourceName: attackerName,
        abilityName: actionName,
        description: `${applyTarget} failed ${attackerName}'s ${actionName} save — Disadvantage on saving throws to maintain Concentration until the end of ${attackerName}'s next turn.${granted ? '' : ' (te write unconfirmed)'}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveProcessing:concentration-disadvantage-granted]', e); });
}

// MA-0073: failed-save speed-halved grant. Writes the registry te
// (speed_half) on the target sourced from the attacker, duration
// until_end_of_next_turn (rounds:2 clock, MA-0038 shape), and logs the
// named clause. Consumers: ConditionEffectBadges 'Speed Halved' badge,
// computeConditionEffects → CharSummary halved Speed line (PC sheet).
async function grantSpeedHalf({ context, campaignName, attackerName, applyTarget }) {
    const actionName = context?.actionName || context?.name || 'the action';
    registerTargetEffect(campaignName, applyTarget, 'speed_half', attackerName, {
        duration: 'until_end_of_next_turn',
        actionName,
    });
    addExpiration({
        attackerName,
        targetName: applyTarget,
        campaignName,
        rounds: 2,
        effects: [{ type: 'remove_target_effect', effectKey: 'speed_half', source: attackerName, target: applyTarget }],
    });
    const granted = getActiveTargetEffect(campaignName, applyTarget, 'speed_half');
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'speed_half_granted',
        characterName: applyTarget,
        sourceName: attackerName,
        abilityName: actionName,
        description: `${applyTarget} failed ${attackerName}'s ${actionName} save — Speed halved until the end of ${applyTarget}'s next turn.${granted ? '' : ' (te write unconfirmed)'}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveProcessing:speed-half-granted]', e); });
}

// MA-0017: damageless save effects (e.g. Dominate Mind) must still apply conditions on a failed save.
function applyDamagelessSaveConditions({ context, saveDc, saveSuccess, applyTarget, attackerName, campaignName }) {
    if (saveDc == null || saveSuccess !== false) return;
    const saveConditions = context?.saveConditions || [];
    if (saveConditions.length <= 0) return;
    const targetChar = (context._characters || []).find(c => c.name === applyTarget);
    applyFailedSaveConditions({ saveConditions, saveSuccess, targetChar, applyTarget, attackerName, context, campaignName });
}

function applyFailedSaveConditions({ saveConditions, saveSuccess, targetChar, applyTarget, attackerName, context, campaignName }) {
    if (saveConditions.length <= 0 || saveSuccess) return;
    const targetStats = targetChar?.computedStats || targetChar;
    const isImmune = targetStats && playerIsImmuneToCondition({
        conditionKey: saveConditions[0],
        playerStats: targetStats,
        getRuntimeValue,
        campaignName,
    });
    if (isImmune) return;
    const currentConditions = getRuntimeValue(applyTarget, 'activeConditions') || [];
    const newConditions = [...currentConditions];
    for (const cond of saveConditions) {
        if (!newConditions.some(c => String(c).toLowerCase() === cond)) {
            newConditions.push(cond);
        }
    }
    setRuntimeValue(applyTarget, 'activeConditions', newConditions, campaignName);
    stampConditionMetaAndLogClauses({ applyTarget, saveConditions, attackerName, context, campaignName });
    const conditionNames = saveConditions.map(c => c.charAt(0).toUpperCase() + c.slice(1));
    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: applyTarget,
        condition: conditionNames.join(', '),
        sourceName: attackerName,
        sourceAbility: context?.actionName || context.name,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[saveProcessing:log-error]", e); });
}

// MA-0019 provenance: stamp the inflicting creature into condition meta so
// "by <source>" prerequisites (target_prerequisite.by_attacker) can be
// enforced. MA-0020: an authored "until …" clause (Dominate Mind) rides the
// same stamp as a durationNote — advisory only, no auto-expiry subsystem
// (CLA-325). Existing meta consumers read dc/ability only — additive.
function stampConditionMetaAndLogClauses({ applyTarget, saveConditions, attackerName, context, campaignName }) {
    const existingMeta = getRuntimeValue(applyTarget, 'activeConditionMeta', campaignName) || {};
    const newMeta = { ...existingMeta };
    for (const cond of saveConditions) {
        newMeta[cond] = { ...(existingMeta[cond] || {}), source: attackerName };
        if (context?.conditionDurationNote && !newMeta[cond].durationNote) {
            newMeta[cond].durationNote = context.conditionDurationNote;
        }
    }
    setRuntimeValue(applyTarget, 'activeConditionMeta', newMeta, campaignName);
    if (!context?.conditionDurationNote) return;
    const conditionNames = saveConditions.map(c => c.charAt(0).toUpperCase() + c.slice(1));
    addEntry(campaignName, {
        type: 'automation',
        automationType: 'condition_clauses_advisory',
        characterName: applyTarget,
        sourceName: attackerName,
        abilityName: context?.actionName || context.name,
        description: `${applyTarget} is ${conditionNames.join(', ')} ${context.conditionDurationNote} — control/telepathy/repeat-save clauses are GM-enforced (no control subsystem).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[saveProcessing:clause-advisory-log]", e); });
}

function logSaveEvasionRoll({ applyTarget, hasOwnEvasion, saveType, saveDc, saveSuccess, context, logEntry }) {
    logEntry({
        type: 'roll',
        characterName: applyTarget,
        rollType: 'evasion',
        name: hasOwnEvasion ? 'Evasion' : 'Leading Evasion',
        targetName: applyTarget,
        saveType,
        saveDc,
        saveResult: saveSuccess ? 'success' : 'failure',
        dcSuccess: context?.dcSuccess,
        timestamp: Date.now(),
        id: utils.guid(),
    });
}

function buildSaveDamageLogData({ attackerName, context, damageFormula, damageResult, finalDamage, damageType, applyTarget, applyResult, saveSuccess }) {
    return {
        type: 'roll',
        characterName: attackerName,
        rollType: 'save-damage',
        name: context?.actionName || context.name,
        formula: damageFormula,
        rolls: damageResult.rolls,
        total: finalDamage,
        modifier: damageResult.modifier,
        damageType: damageType,
        targetName: applyTarget,
        finalDamage: applyResult?.finalDamage,
        saveSuccess,
        timestamp: Date.now(),
        id: utils.guid(),
    };
}

function buildSaveDamagePopupData({ context, damageFormula, damageResult, finalDamage, damageType, applyTarget, applyResult, targetName, effectiveD20ForSave, saveTotal, saveSuccess, saveDc, saveType }) {
    return {
        type: 'save-damage',
        name: context?.actionName || context.name,
        formula: damageFormula,
        rolls: damageResult.rolls,
        total: finalDamage,
        bonus: 0,
        modifier: damageResult.modifier,
        damageType: damageType,
        targetName: applyTarget,
        targetCurrentHp: applyResult?.newHp,
        targetMaxHp: targetName ? (context._target?.type === 'player' ? (getRuntimeValue(targetName, 'hitPoints') ?? 0) : context._target?.maxHp ?? 0) : undefined,
        saveDc,
        saveType,
        dcSuccess: context?.dcSuccess,
        saveResult: { roll: effectiveD20ForSave, total: saveTotal, bonus: context._saveResultData?.saveBonus ?? 0, success: saveSuccess },
        finalDamage: applyResult?.finalDamage,
        damageApplied: true,
        damageReduced: applyResult?.damageReduced,
    };
}

async function applySaveDamage({ context, characterName, campaignName, attackerName, targetName, saveType, saveDc, saveSuccess, effectiveD20ForSave, saveTotal, logEntry, setPopupHtml, characters }) {
    const damageFormula = context.autoDamageFormula;
    const damageType = context?.autoDamageDamageType || 'Slashing';
    const saveConditions = context?.saveConditions || [];
    const damageResult = rollExpression(damageFormula);
    if (!damageResult) return;

    const applyTarget = targetName || characterName;
    const normalizedSaveType = normalizeSaveType(saveType);
    const targetConditions = getRuntimeValue(applyTarget, 'activeConditions', campaignName) || [];
    const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');
    const { targetChar, hasOwnEvasion, hasEvasion } = resolveSaveEvasion({ context, characters, applyTarget, normalizedSaveType, isIncapacitated, campaignName });
    if (hasEvasion) {
        logSaveEvasionRoll({ applyTarget, hasOwnEvasion, saveType, saveDc, saveSuccess, context, logEntry });
    }
    const finalDamage = computeDamageAfterEvasion(damageResult.total, saveSuccess, context?.dcSuccess, hasEvasion);

    const attackerChar = (characters || []).find(c => c.name === attackerName);
    const ignoreResistance = (attackerChar?.computedStats && hasIgnoreResistance(attackerChar.computedStats, damageType)) || false;
    const combatSummaryForSave = await loadCombatSummary(campaignName);
    // CLA-324: save-based spell-like attack damage — flag spell-origin for categorical
    // 'Spell' resistance (Abjurer Spell Resistance).
    const applyResult = await applyDamageToTarget(combatSummaryForSave, applyTarget, finalDamage, [damageType], { campaignName, characters: characters, ignoreResistance: ignoreResistance, attackerName: attackerName, suppressHpLog: false, ...{ isSpellDamage: true } });

    logEntry(buildSaveDamageLogData({ attackerName, context, damageFormula, damageResult, finalDamage, damageType, applyTarget, applyResult, saveSuccess }));

    setPopupHtml(buildSaveDamagePopupData({ context, damageFormula, damageResult, finalDamage, damageType, applyTarget, applyResult, targetName, effectiveD20ForSave, saveTotal, saveSuccess, saveDc, saveType }));

    applyFailedSaveConditions({ saveConditions, saveSuccess, targetChar, applyTarget, attackerName, context, campaignName });
    maybeLogMemoryGainAtZeroHp({ context, combatSummary: combatSummaryForSave, applyTarget, attackerName, applyResult, saveSuccess, campaignName });
}

// MA-0019: "The aboleth gains the target's memories if the target is a
// Humanoid and is reduced to 0 Hit Points by this action." Advisory log —
// no memory subsystem (CLA-325 GM-enforced precedent).
function isHumanoidCreature(csCreature) {
    if (!csCreature) return false;
    if (csCreature.type === 'player') return true;
    return String(csCreature.monsterType || '').toLowerCase() === 'humanoid';
}

function maybeLogMemoryGainAtZeroHp({ context, combatSummary, applyTarget, attackerName, applyResult, saveSuccess, campaignName }) {
    if (!context?.consumeMemoriesClause || saveSuccess !== false) return;
    if (!applyResult || applyResult.newHp > 0) return;
    const csCreature = (combatSummary?.creatures || []).find(c => c.name === applyTarget);
    if (!isHumanoidCreature(csCreature)) return;
    const memoryActionName = context?.actionName || context?.autoDamageName || 'the action';
    addEntry(campaignName, {
        type: 'automation',
        automationType: 'consume_memories',
        characterName: attackerName,
        abilityName: memoryActionName,
        targetName: applyTarget,
        description: `${attackerName} gains ${applyTarget}'s memories — target reduced to 0 Hit Points by ${memoryActionName} (Humanoid, GM-enforced).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[saveProcessing:consume-memories-log]", e); });
}
