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
import { registerTargetEffect, getActiveTargetEffect, getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../services/rules/effects/expirationQueue.js';
import { EXHAUSTION_LEVELS } from '../../services/combat/conditions/exhaustionRules.js';
import { parseSuccessImmunity } from '../../components/encounter/MonsterCardHelpers.js';
import { trackFrightfulPresence } from '../../services/rules/features/frightfulPresenceService.js';
import { grantRepeatSaveEffect } from '../../services/rules/features/repeatSaveService.js';
import { setTempHp } from '../../services/automation/handlers/buffs/tempHpService.js';
import { grantInfernalWound } from '../../services/rules/features/infernalWoundService.js';
import { applyEyeRayFailedGrants } from '../../services/rules/features/beholderEyeRayService.js';
import { stagePetrifyingBiteTargets } from '../../services/rules/features/cockatricePetrifyService.js';

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
    const hasSecondaryDamage = !!context?.autoDamageSecondaryFormula;
    const { promise } = createSaveListener(campaignName, {
        targetName,
        saveType: saveType || 'CON',
        saveDc,
        dcSuccess: context?.dcSuccess || 'half',
        attackerName: attackerName,
        // CLA-324: monster-card save-based attacks are spell-like save attacks (eye rays,
        // magical rays) — flag spell-origin so against_spell gates can discriminate.
        isSpellDamage: true,
        // MA-0427: dual-damage rows (Brazen Gorgon Smelting Charge) surface BOTH
        // formulas in the prompt copy honestly; single-formula rows keep every damage
        // field null exactly as before (prompt payload + reroll log byte-identical).
        damageFormula: hasSecondaryDamage ? (context?.autoDamageFormula || null) : null,
        damageType: hasSecondaryDamage ? (context?.autoDamageDamageType || null) : null,
        secondaryFormula: context?.autoDamageSecondaryFormula || null,
        secondaryDamageType: context?.autoDamageSecondaryDamageType || null,
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
    if (saveSuccess === false) {
        await applyFailedSaveClauseGrants({ context, campaignName, attackerName, applyTarget });
    }
    // MA-0275: Animal Lord variant trio — the GM-chosen clause lands on
    // EITHER outcome (the save gates only the damage). Variant key armed at
    // the chip-click chooser, rides the save context.
    if (context?.animalSpiritVariant) {
        await applyAnimalSpiritVariantGrant({ context, saveSuccess, campaignName, attackerName, applyTarget });
    }
}

// Failed-save te clause grants (MA-0038/0073/0093/0104) — split from the
// dispatcher to keep both functions under the lint complexity ceiling.
async function applyFailedSaveClauseGrants({ context, campaignName, attackerName, applyTarget }) {
    // MA-0038: Cloud of Insects — "Disadvantage on saving throws to maintain
    // Concentration until the end of its next turn". te sourced from the
    // dragon; duration: 'until_end_of_next_turn' with rounds:2 drained by
    // the pendingExpirations clock (HurlThroughHell codebase convention).
    if (context?.concentrationDisadvantage) {
        await grantConcentrationDisadvantage({ context, campaignName, attackerName, applyTarget });
    }
    // MA-0073: Scorching Sands — "the target's Speed is halved until the
    // end of its next turn". te producer mirror of the MA-0038 shape.
    if (context?.speedHalf) {
        await grantSpeedHalf({ context, campaignName, attackerName, applyTarget });
    }
    // MA-0093: Giggling Magic — "the target rolls 1d6 whenever it makes an
    // ability check or attack roll and subtracts the number rolled" until the
    // end of its next turn. te producer mirror of the MA-0073 shape; the
    // subtractDie value rides the te to the generalized roll-time consumer.
    if (context?.subtractDebuff) {
        await grantSubtractDieDebuff({ context, campaignName, attackerName, applyTarget });
    }
    // MA-0104/0107/0115/0146: banishment + movement-penalty clause arms
    // (demiplane transport, dream-plane banishment, AC penalty, speed-zero)
    // extracted to a sibling helper to keep this dispatcher under the
    // complexity ceiling (playbook §5 — split by clause family, MA-0087 model).
    await applyTransportAndMovementClauseGrants({ context, campaignName, attackerName, applyTarget });
    // MA-0367: Bearded Devil Infernal Glaive — failed DC 12 CON save inflicts
    // the infernal_wound te + ONE rounds:10 clock (1 minute, CLA-334) via
    // infernalWoundService (RAW skips targets already carrying a wound).
    if (context?.infernalWound) {
        await grantInfernalWound({
            campaignName,
            attackerName,
            targetName: applyTarget,
            actionName: context?.actionName || context?.name || 'Infernal Glaive',
            bleedDie: context.infernalWound.bleedDie,
        });
    }
    // MA-0374: Beholder Eye Rays per-ray failed-save grants — te grants
    // (Slowing trio / Enervation no_healing / Telekinetic move marker) with
    // ONE rounds clock, plus the Paralyzed and Petrification repeat-save
    // ladders (beholderEyeRayService; turn-end consumer in
    // navigationHandlers). Byte-inert for every row without context.eyeRay.
    if (context?.eyeRay) {
        await applyEyeRayFailedGrants({ campaignName, attackerName, targetName: applyTarget, ray: context.eyeRay });
    }
    // MA-0501: Cockatrice staged petrify ladder arm (byte-inert unless
    // context.stagedPetrify authored; cockatricePetrifyService).
    await applyStagedPetrifyClauseGrant({ context, campaignName, attackerName, applyTarget });
}

// MA-0501: Cockatrice Petrifying Bite staged ladder — first failed CON
// save Restrains + arms the petrifying_bite_staged te (turn-END repeat
// save consumer in navigationHandlers); a second failure — repeat save or
// a fresh bite while Restrained — Petrifies for 24 hours
// (cockatricePetrifyService, MA-0248/MA-0374 ladder shapes). Split to a
// sibling helper to keep applyFailedSaveClauseGrants under the ceiling (§5).
async function applyStagedPetrifyClauseGrant({ context, campaignName, attackerName, applyTarget }) {
    if (!context || !context.stagedPetrify) return;
    await stagePetrifyingBiteTargets({
        campaignName,
        casterName: attackerName,
        targetNames: [applyTarget],
        saveDc: context.saveDc,
        options: { ...context.stagedPetrify, label: context.actionName || context.name || 'Petrifying Bite' },
    });
}

// Banishment-family + movement-penalty te grants (MA-0104/0107/0115/0146),
// split out of applyFailedSaveClauseGrants (complexity ceiling §5).
async function applyTransportAndMovementClauseGrants({ context, campaignName, attackerName, applyTarget }) {
    // MA-0104: Adult Gold Dragon Banish — "transported to a harmless demiplane
    // until the start of the dragon's next turn". Distinct te from the PC spell
    // banishment (concentration/permanent semantics); badge + honest advisory
    // display, reappearance placement GM-enforced (§7).
    if (context?.demiplaneTransport) {
        await grantDemiplaneTransport({ context, campaignName, attackerName, applyTarget });
    }
    // MA-0107: Adult Gold Dragon lair action Dream Plane Banishment —
    // "banished to a dream plane ... the effect ends on initiative count 20 on
    // the next round". Distinct te from banished_demiplane (MA-0104 — the
    // Banish wording never matches, and vice versa); rounds:2 clock mirrors the
    // verified MA-0104 shape (initiative-20 cadence stays GM-enforced §7).
    if (context?.dreamPlaneBanishment) {
        await grantDreamPlaneBanishment({ context, campaignName, attackerName, applyTarget });
    }
    // MA-0115: Adult Green Dragon Noxious Miasma — "the target takes a −2
    // penalty to AC until the end of its next turn". te producer mirror of the
    // MA-0073 shape; the parsed value rides the te to the live consumer
    // (conditionEffects acPenalty → CharSummary AC fold + penalty line).
    if (context?.acPenaltyClause) {
        await grantAcPenaltyClause({ context, campaignName, attackerName, applyTarget });
    }
    // MA-0146: Adult White Dragon Freezing Burst — "the target's Speed is 0
    // until the end of the target's next turn". te + activeCondition producer
    // mirror of the MA-0073 shape (the sphere row normally routes through the
    // radius picker seam; this leg covers any single-target save resolution).
    if (context?.speedZeroClause) {
        await grantSpeedZeroClause({ context, campaignName, attackerName, applyTarget });
    }
    // MA-0711: Faerie Dragon Euphoria Breath — inline failed-save slowed-rider
    // grant (shapeless row, picker never opens, MA-0087 picker-only gap;
    // MA-0146 both-seams twin shape). Grants each registered te named by
    // parseSlowedClauses (no_reactions here) + ONE merged clock; the d6
    // behavior table / repeat-save ender legs are §70 advisory, logged.
    if (context?.slowedClauses) {
        await grantSlowedClausesInline({ context, campaignName, attackerName, applyTarget });
    }
    // MA-0751: Fomorian Warping Hex — failed WIS save "and the target gains
    // 1 Exhaustion level". Level-based grant onto the canonical per-victim
    // runtime exhaustionLevel storage (exhaustionRules/CharConditions/rest
    // rules channel — NOT the boolean condition list, NOT a te; no expiry
    // clock: RAW persistence ends only at a rest, whose consumers already
    // read exhaustionLevel). `condition applied` log names level + source.
    if (context.exhaustionLevel) {
        await grantExhaustionClause({ context, campaignName, attackerName, applyTarget });
    }
}

// MA-0711: inline failed-save slowed-clause grant (Faerie Dragon Euphoria
// Breath — "The target can't take reactions and must roll a d6 at the start
// of each of its turns to determine its behavior ... make a DC 11 Wisdom
// saving throw, ending the effect on itself on a success"). The MA-0087
// picker grant (SaveAttackAoeModal.grantSlowedClauses) never reached this
// shapeless inline row; this is its both-seams twin (MA-0146 speed_zero).
// Grants EACH te named by parseSlowedClauses through the registry
// (no_reactions consumer: CharReactions), duration honest per row — an
// "until … next turn" clause row maps to the MA-0073 rounds:2 clock, else
// 1 minute → rounds:10 (§37 minutes×10) — drained by ONE merged
// addExpiration write (§38 never two racing clocks). Logs the grant in the
// MA-0087 'condition applied' copy and names the unmodelable d6
// start-of-turn behavior table + repeat-save ender as §70 GM-enforced
// advisory (MA-0706 durationNote advisory precedent).
// MA-0711 (complexity hoist, playbook §5): duration honesty per clause row —
// an "until … next turn" clause (Spectator Confusion Ray) maps to the MA-0073
// rounds:2 clock; else the row's RAW 1 minute → rounds:10 (§37 minutes×10).
function resolveInlineSlowedDuration({ context, applyTarget }) {
    const untilNextTurn = /next turn/i.test(context?.conditionDurationNote || '');
    return untilNextTurn
        ? { rounds: 2, durationKey: 'until_end_of_next_turn', durationText: `until the end of ${applyTarget}'s next turn` }
        : { rounds: 10, durationKey: '1_minute', durationText: 'for 1 minute' };
}

async function grantSlowedClausesInline({ context, campaignName, attackerName, applyTarget }) {
    const effects = context.slowedClauses.effects || [];
    if (effects.length === 0) return;
    const actionName = context?.actionName || context?.name || 'the action';
    const { rounds, durationKey, durationText } = resolveInlineSlowedDuration({ context, applyTarget });
    const labels = [];
    for (const effectKey of effects) {
        registerTargetEffect(campaignName, applyTarget, effectKey, attackerName, {
            duration: durationKey,
            actionName,
        });
        const def = getEffectDefinition(effectKey);
        labels.push(def?.label || effectKey);
    }
    addExpiration({
        attackerName,
        targetName: applyTarget,
        campaignName,
        rounds,
        effects: effects.map(effectKey => ({ type: 'remove_target_effect', effectKey, source: attackerName, target: applyTarget })),
    });
    const granted = getActiveTargetEffect(campaignName, applyTarget, effects[0]);
    await addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: applyTarget,
        condition: labels.join(', '),
        sourceName: attackerName,
        sourceAbility: actionName,
        description: `${applyTarget} failed ${attackerName}'s ${actionName} save — ${labels.join(', ')} ${durationText}.${granted ? '' : ' (te write unconfirmed)'}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveProcessing:slowed-clause-granted]', e); });
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'condition_clauses_advisory',
        characterName: applyTarget,
        sourceName: attackerName,
        abilityName: actionName,
        description: `${applyTarget}'s ${actionName} d6 start-of-turn behavior table (1-4 random movement; 5-6 no movement + repeat save ending on self) is GM-enforced — no behavior-table subsystem; te clock rounds:${rounds} (${durationText}).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveProcessing:slowed-clause-advisory]', e); });
}

// MA-0751: failed-save exhaustion-level grant (Fomorian Warping Hex — "the
// target gains 1 Exhaustion level"). exhaustionRules.js consumes a NUMERIC
// per-victim level (stackable to 6, rest-removable), and the live storage is
// the per-character runtime key exhaustionLevel (producers:
// useTravelManagement forced march; consumers: CharConditions sheet,
// restRules short/long rest, sleepService immunity) — so this rides THAT
// canonical channel instead of a te or the boolean condition list (neither
// is expressive for levels). Stamps source+level into activeConditionMeta
// (§191 per-victim provenance surface) and logs `condition applied` with
// level + source. NO addExpiration clock — RAW exhaustion persists until a
// rest, whose consumers already read exhaustionLevel (monster rest-rearm
// stays §70 advisory). Exhaustion-immune targets (cs.immunities, §43 partial
// join caveat) get a zero-grant advisory; the level-6 death cap is capped +
// advisory (§7 no 0-HP instakill consumer).
function csIsExhaustionImmune(csCreature) {
    const immunities = Array.isArray(csCreature && csCreature.immunities) ? csCreature.immunities : [];
    return immunities.some(i => String(i).toLowerCase() === 'exhaustion');
}

function stampExhaustionMeta({ campaignName, applyTarget, attackerName, newLevel }) {
    const meta = getRuntimeValue(applyTarget, 'activeConditionMeta', campaignName) || {};
    setRuntimeValue(applyTarget, 'activeConditionMeta', { ...meta, exhaustion: { ...(meta.exhaustion || {}), source: attackerName, level: newLevel } }, campaignName);
}

async function logExhaustionGrant({ campaignName, applyTarget, attackerName, actionName, levels, newLevel }) {
    const stored = getRuntimeValue(applyTarget, 'exhaustionLevel', campaignName);
    await addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: applyTarget,
        condition: `Exhaustion ${newLevel}`,
        sourceName: attackerName,
        sourceAbility: actionName,
        description: `${applyTarget} failed ${attackerName}'s ${actionName} save — gains ${levels} Exhaustion level${levels > 1 ? 's' : ''}, now ${newLevel}/${EXHAUSTION_LEVELS} (stacks until a Long Rest; level 6 = death, GM-enforced).${Number(stored) === newLevel ? '' : ' (exhaustionLevel write unconfirmed)'}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveProcessing:exhaustion-granted]', e); });
}

async function grantExhaustionClause({ context, campaignName, attackerName, applyTarget }) {
    const actionName = context.actionName || context.name || 'the action';
    const levels = Number(context.exhaustionLevel.level) || 1;
    const combatSummary = await loadCombatSummary(campaignName) || {};
    const csCreature = (combatSummary.creatures || []).find(c => c.name === applyTarget);
    if (csIsExhaustionImmune(csCreature)) {
        await addEntry(campaignName, {
            type: 'automation',
            automationType: 'exhaustion_immune_advisory',
            characterName: applyTarget,
            sourceName: attackerName,
            abilityName: actionName,
            description: `${applyTarget} is immune to Exhaustion — ${attackerName}'s ${actionName} grants no exhaustion level.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[saveProcessing:exhaustion-immune]', e); });
        return;
    }
    const current = Number(getRuntimeValue(applyTarget, 'exhaustionLevel', campaignName)) || 0;
    const newLevel = Math.min(EXHAUSTION_LEVELS, current + levels);
    await setRuntimeValue(applyTarget, 'exhaustionLevel', newLevel, campaignName);
    stampExhaustionMeta({ campaignName, applyTarget, attackerName, newLevel });
    await logExhaustionGrant({ campaignName, applyTarget, attackerName, actionName, levels, newLevel });
}

// MA-0048/MA-0610: failed-save repeat-save arm (complexity hoist out of
// applySaveOutcome). GENERIC fork — an authored repeat_save object that names
// its te via `effect` routes to the generic turn-END repeat-save roller
// (repeatSaveService); every legacy row (Frightful Presence:
// repeat_save={condition:'frightened', save_type, duration_minutes} with NO
// `effect`) stays on the FP-specific trackFrightfulPresence leg byte-identical.
async function armRepeatSaveClause({ saveSuccess, context, campaignName, attackerName, applyTarget, saveDc, saveType }) {
    if (saveSuccess !== false || !context?.repeatSave) return;
    if (context.repeatSave.effect) {
        await grantRepeatSaveEffect({ campaignName, attackerName, targetName: applyTarget, repeatSave: context.repeatSave, saveDc, saveType });
        return;
    }
    await trackFrightfulPresence({ campaignName, attackerName, targetName: applyTarget, saveType: context.repeatSave.save_type || saveType, saveDc });
}

async function applySaveOutcome({ context, characterName, campaignName, attackerName, targetName, saveType, saveDc, saveSuccess, effectiveD20ForSave, saveTotal, logEntry, setPopupHtml }) {
    // MA-0020: ability N/Day spend lands here — prompt-confirm seam (reaches
    // this point only once the save has resolved), regardless of the outcome.
    if (context?.monsterAbilityUse) {
        await spendMonsterAbilityUse({ monsterName: attackerName, use: context.monsterAbilityUse, targetName: targetName || characterName, campaignName });
    }
    await applyAuthoredClauseGrants({ context, saveSuccess, campaignName, attackerName, applyTarget: targetName || characterName });
    if (context?.autoDamageFormula && saveDc != null) {
        if (!await maybeApplyThresholdKillLeg({ context, characterName, campaignName, attackerName, targetName, saveSuccess, effectiveD20ForSave, saveTotal, saveType, saveDc, setPopupHtml, characters: context._characters })) {
            await applySaveDamage({ context, characterName, campaignName, attackerName, targetName, saveType, saveDc, saveSuccess, effectiveD20ForSave, saveTotal, logEntry, setPopupHtml, characters: context._characters });
        }
    } else {
        applyDamagelessSaveConditions({ context, saveDc, saveSuccess, saveTotal, applyTarget: targetName || characterName, attackerName, campaignName });
    }
    await armRepeatSaveClause({ saveSuccess, context, campaignName, attackerName, applyTarget: targetName || characterName, saveDc, saveType });
}

// MA-0639: failed-save fail-margin rider (Drow Hand Crossbow — "If the
// saving throw fails by 5 or more, the target is also unconscious while
// poisoned in this way"). Armed ONLY by the structured context.saveMargin
// forwarded from the row's save_margin key (parser: parseSaveMarginClause,
// playbook §5 trio) — byte-inert for every clauseless row. The margin rides
// saveTotal (all bane/bless/cosmic-omen adjustments already folded), so
// margin = saveDc − saveTotal. Grants the canonical condition (no new te
// key — unconscious is a canonical activeConditions entry, same machinery as
// the poisoned grant above) with source meta + its own `condition applied`
// log. ONE addExpiration clock (CLA-334 hours×600 = 1 hour, matching the
// save_effect "for 1 hour" the rider is bound to — "unconscious WHILE
// poisoned") carrying BOTH condition legs in a single merged write (§5 —
// never two racing clocks; the clock is armed only on save_margin rows, so
// every legacy condition grant stays byte-identical). Waking early on damage
// / a shake-awake action has no consumer app-wide (§70 "shake awake"
// advisory residual — GM-enforced, documented not built).
function applySaveMarginRider({ context, saveDc, saveTotal, applyTarget, attackerName, campaignName }) {
    const margin = context?.saveMargin;
    if (!margin || saveDc == null || !Number.isFinite(Number(saveTotal))) return;
    if ((saveDc - saveTotal) < margin.failsBy) return;
    const condition = margin.also;
    const current = getRuntimeValue(applyTarget, 'activeConditions') || [];
    if (!current.some(c => String(c).toLowerCase() === condition)) {
        setRuntimeValue(applyTarget, 'activeConditions', [...current, condition], campaignName);
    }
    const meta = getRuntimeValue(applyTarget, 'activeConditionMeta') || {};
    setRuntimeValue(applyTarget, 'activeConditionMeta', { ...meta, [condition]: { ...(meta[condition] || {}), source: attackerName } }, campaignName);
    addExpiration({
        attackerName,
        targetName: applyTarget,
        campaignName,
        rounds: 600,
        effects: [
            { type: 'condition', condition: 'poisoned' },
            { type: 'condition', condition },
        ],
    });
    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: applyTarget,
        condition: condition.charAt(0).toUpperCase() + condition.slice(1),
        sourceName: attackerName,
        sourceAbility: context?.actionName || context?.name,
        description: `${applyTarget} failed the save by ${saveDc - saveTotal} (DC ${saveDc}, total ${saveTotal}) — also unconscious while poisoned (1 hour; waking on damage/shake is GM-enforced).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveProcessing:save-margin-rider]', e); });
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

// MA-0093: failed-save subtract-die debuff grant (Giggling Magic). Writes
// the registry te (giggling_magic_debuff) on the target sourced from the
// attacker with subtractDie: '1d6', duration until_end_of_next_turn
// (rounds:2 clock, MA-0073 shape), and logs the named clause. Consumers:
// computeSubtractDiePenalty (attack/check rolls), ConditionEffectBadges.
async function grantSubtractDieDebuff({ context, campaignName, attackerName, applyTarget }) {
    const debuff = context.subtractDebuff;
    const actionName = context?.actionName || context?.name || 'the action';
    registerTargetEffect(campaignName, applyTarget, debuff.effect, attackerName, {
        duration: 'until_end_of_next_turn',
        subtractDie: debuff.die,
        displayLabel: debuff.displayLabel || 'Giggling Magic',
        actionName,
    });
    addExpiration({
        attackerName,
        targetName: applyTarget,
        campaignName,
        rounds: 2,
        effects: [{ type: 'remove_target_effect', effectKey: debuff.effect, source: attackerName, target: applyTarget }],
    });
    const granted = getActiveTargetEffect(campaignName, applyTarget, debuff.effect);
    await addEntry(campaignName, {
        type: 'automation',
        automationType: `${debuff.effect}_granted`,
        characterName: applyTarget,
        sourceName: attackerName,
        abilityName: actionName,
        description: `${applyTarget} failed ${attackerName}'s ${actionName} save — rolls ${debuff.die} and subtracts it from ability checks and attack rolls until the end of ${applyTarget}'s next turn.${granted ? '' : ' (te write unconfirmed)'}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveProcessing:subtract-die-debuff-granted]', e); });
}

// MA-0115: failed-save AC-penalty grant (Adult Green Dragon Noxious
// Miasma). Writes the registry te (ac_penalty) on the target sourced from
// the attacker with the parsed value (−2), duration until_end_of_next_turn
// (rounds:2 clock, MA-0073 shape), and logs the named clause. Consumers:
// conditionEffects acPenalty accumulation → CharSummary AC fold (live).
async function grantAcPenaltyClause({ context, campaignName, attackerName, applyTarget }) {
    const clause = context.acPenaltyClause;
    const value = Number(clause?.value) || 2;
    const actionName = context?.actionName || context?.name || 'the action';
    registerTargetEffect(campaignName, applyTarget, 'ac_penalty', attackerName, {
        duration: 'until_end_of_next_turn',
        value,
        actionName,
    });
    addExpiration({
        attackerName,
        targetName: applyTarget,
        campaignName,
        rounds: 2,
        effects: [{ type: 'remove_target_effect', effectKey: 'ac_penalty', source: attackerName, target: applyTarget }],
    });
    const granted = getActiveTargetEffect(campaignName, applyTarget, 'ac_penalty');
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'ac_penalty_granted',
        characterName: applyTarget,
        sourceName: attackerName,
        abilityName: actionName,
        description: `${applyTarget} failed ${attackerName}'s ${actionName} save — takes a \u2212${value} penalty to AC until the end of ${applyTarget}'s next turn.${granted ? '' : ' (te write unconfirmed)'}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveProcessing:ac-penalty-granted]', e); });
}

// MA-0275: Animal Spirit variant grant. The GM picked a form variant at the
// chip-click chooser; the clause lands on EITHER save outcome (the save
// gates only the 4d10+6 Radiant damage). Fortify (Forager): the lord gains
// temp HP (replace-if-larger, tempHpService semantics; MonsterCardModal
// reads tempHp for display). Marked as Prey (Hunter): registry te
// (marked_as_prey) on the LORD with vexTarget = the save target —
// computeConditionEffects folds Advantage via the verified vexTarget channel
// (CLA-341), rounds:2 clock anchored to the lord (MA-0104 shape,
// until_start_of_attacker_next_turn). Pesky Swarm (Sage): registry te
// (pesky_swarm) on the target — Disadvantage on attack rolls AND ability
// checks until the end of its next turn (rounds:2 clock, MA-0073 shape).
async function applyAnimalSpiritVariantGrant({ context, saveSuccess, campaignName, attackerName, applyTarget }) {
    const variant = context.animalSpiritVariant;
    const actionName = context?.actionName || context?.name || 'Animal Spirit';
    const outcomeNote = saveSuccess ? 'succeeded' : 'failed';
    if (variant === 'fortify') {
        const amount = Number(context.animalSpiritFortifyHp) || 20;
        setTempHp(attackerName, amount, campaignName);
        const granted = Number(getRuntimeValue(attackerName, 'tempHp', campaignName)) || 0;
        await addEntry(campaignName, {
            type: 'automation',
            automationType: 'animal_spirit_fortify_granted',
            characterName: attackerName,
            sourceName: attackerName,
            abilityName: actionName,
            description: `Animal Spirit (Fortify, Forager form) — ${applyTarget} ${outcomeNote} the save; ${attackerName} gains ${amount} Temporary Hit Points.${granted >= amount ? '' : ` (tempHp write unconfirmed, now ${granted})`}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[saveProcessing:animal-spirit-fortify-granted]', e); });
        return;
    }
    if (variant === 'marked_as_prey') {
        registerTargetEffect(campaignName, attackerName, 'marked_as_prey', attackerName, {
            duration: 'until_start_of_attacker_next_turn',
            vexTarget: applyTarget,
            actionName,
        });
        addExpiration({
            attackerName,
            targetName: attackerName,
            campaignName,
            rounds: 2,
            effects: [{ type: 'remove_target_effect', effectKey: 'marked_as_prey', source: attackerName, target: attackerName }],
        });
        const granted = getActiveTargetEffect(campaignName, attackerName, 'marked_as_prey');
        await addEntry(campaignName, {
            type: 'automation',
            automationType: 'marked_as_prey_granted',
            characterName: attackerName,
            sourceName: attackerName,
            abilityName: actionName,
            description: `Animal Spirit (Marked as Prey, Hunter form) — ${applyTarget} ${outcomeNote} the save; ${attackerName} has Advantage on attack rolls against ${applyTarget} until the start of ${attackerName}'s next turn.${granted ? '' : ' (te write unconfirmed)'}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[saveProcessing:marked-as-prey-granted]', e); });
        return;
    }
    if (variant === 'pesky_swarm') {
        registerTargetEffect(campaignName, applyTarget, 'pesky_swarm', attackerName, {
            duration: 'until_end_of_next_turn',
            actionName,
        });
        addExpiration({
            attackerName,
            targetName: applyTarget,
            campaignName,
            rounds: 2,
            effects: [{ type: 'remove_target_effect', effectKey: 'pesky_swarm', source: attackerName, target: applyTarget }],
        });
        const granted = getActiveTargetEffect(campaignName, applyTarget, 'pesky_swarm');
        await addEntry(campaignName, {
            type: 'automation',
            automationType: 'pesky_swarm_granted',
            characterName: applyTarget,
            sourceName: attackerName,
            abilityName: actionName,
            description: `${applyTarget} ${outcomeNote} ${attackerName}'s Animal Spirit save (Pesky Swarm, Sage form) — Disadvantage on attack rolls and ability checks until the end of ${applyTarget}'s next turn.${granted ? '' : ' (te write unconfirmed)'}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[saveProcessing:pesky-swarm-granted]', e); });
        return;
    }
    console.error(`[saveProcessing] unknown animalSpiritVariant: ${variant}`);
}

// MA-0146: failed-save speed-zero grant (Adult White Dragon Freezing Burst).
// Writes the registry te (speed_zero) on the target sourced from the attacker
// AND the activeCondition speed_zero (live consumers: conditionEffects
// speedZero → CharSummary/MonsterCardBody Speed 0), duration
// until_end_of_next_turn (rounds:2 clock, MA-0073 shape — the clock removes
// both via remove_target_effect + the registered 'speed_zero' condition-clear
// expiry), and logs the named clause.
async function grantSpeedZeroClause({ context, campaignName, attackerName, applyTarget }) {
    const actionName = context?.actionName || context?.name || 'the action';
    registerTargetEffect(campaignName, applyTarget, 'speed_zero', attackerName, {
        duration: 'until_end_of_next_turn',
        actionName,
    });
    const stored = getRuntimeValue(applyTarget, 'activeConditions');
    const conditions = Array.isArray(stored) ? stored : [];
    if (!conditions.some(c => String(c).toLowerCase() === 'speed_zero')) {
        await setRuntimeValue(applyTarget, 'activeConditions', [...conditions, 'speed_zero'], campaignName);
    }
    addExpiration({
        attackerName,
        targetName: applyTarget,
        campaignName,
        rounds: 2,
        effects: [
            { type: 'remove_target_effect', effectKey: 'speed_zero', source: attackerName, target: applyTarget },
            { type: 'speed_zero' },
        ],
    });
    const granted = getActiveTargetEffect(campaignName, applyTarget, 'speed_zero');
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'speed_zero_granted',
        characterName: applyTarget,
        sourceName: attackerName,
        abilityName: actionName,
        description: `${applyTarget} failed ${attackerName}'s ${actionName} save — Speed is 0 until the end of ${applyTarget}'s next turn.${granted ? '' : ' (te write unconfirmed)'}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveProcessing:speed-zero-granted]', e); });
}

// MA-0104: failed-save demiplane-transport grant (Adult Gold Dragon Banish).
// Writes the registry te (banished_demiplane) on the target sourced from the
// dragon, duration until_start_of_attacker_next_turn with the MA-0073 rounds:2
// clock, and logs the named clause. Consumers: ConditionEffectBadges 'Banished'
// badge. Incapacitation lands via saveConditions — not duplicated here.
// Reappearing in an unoccupied space of the dragon's choice within 120 feet
// stays GM-enforced advisory (§7 — no grid transport consumer).
async function grantDemiplaneTransport({ context, campaignName, attackerName, applyTarget }) {
    const actionName = context?.actionName || context?.name || 'Banish';
    registerTargetEffect(campaignName, applyTarget, 'banished_demiplane', attackerName, {
        duration: 'until_start_of_attacker_next_turn',
        actionName,
    });
    addExpiration({
        attackerName,
        targetName: applyTarget,
        campaignName,
        rounds: 2,
        effects: [{ type: 'remove_target_effect', effectKey: 'banished_demiplane', source: attackerName, target: applyTarget }],
    });
    const granted = getActiveTargetEffect(campaignName, applyTarget, 'banished_demiplane');
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'banished_demiplane_granted',
        characterName: applyTarget,
        sourceName: attackerName,
        abilityName: actionName,
        description: `${applyTarget} failed ${attackerName}'s ${actionName} save — transported to a harmless demiplane (Incapacitated) until the start of ${attackerName}'s next turn, then reappears in an unoccupied space of ${attackerName}'s choice within 120 feet (reappearance placement GM-enforced).${granted ? '' : ' (te write unconfirmed)'}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveProcessing:demiplane-transport-granted]', e); });
}

// MA-0107: failed-save dream-plane banishment grant (Adult Gold Dragon lair
// action). Writes the registry te (lair_dream_plane) on the target sourced
// from the dragon with the MA-0104 rounds:2 clock — the RAW "ends on
// initiative count 20 on the next round" cadence maps to the nearest expiry
// seam (initiative-20 lair seam absent §7), so expiry/reappearance stays
// GM-enforced advisory. Consumers: ConditionEffectBadges 'Dream Plane' badge.
async function grantDreamPlaneBanishment({ context, campaignName, attackerName, applyTarget }) {
    const actionName = context?.actionName || context?.name || 'Dream Plane Banishment';
    registerTargetEffect(campaignName, applyTarget, 'lair_dream_plane', attackerName, {
        duration: 'until_initiative_count_20_next_round',
        actionName,
    });
    addExpiration({
        attackerName,
        targetName: applyTarget,
        campaignName,
        rounds: 2,
        effects: [{ type: 'remove_target_effect', effectKey: 'lair_dream_plane', source: attackerName, target: applyTarget }],
    });
    const granted = getActiveTargetEffect(campaignName, applyTarget, 'lair_dream_plane');
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'lair_dream_plane_granted',
        characterName: applyTarget,
        sourceName: attackerName,
        abilityName: actionName,
        description: `${applyTarget} failed ${attackerName}'s ${actionName} save — banished to a dream plane until the effect ends on initiative count 20 on the next round; escaping early requires a contested Charisma check and reappearance placement is GM-enforced (no initiative lair seam).${granted ? '' : ' (te write unconfirmed)'}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveProcessing:dream-plane-banishment-granted]', e); });
}

// MA-0017: damageless save effects (e.g. Dominate Mind) must still apply conditions on a failed save.
function applyDamagelessSaveConditions({ context, saveDc, saveSuccess, saveTotal, applyTarget, attackerName, campaignName }) {
    if (saveDc == null || saveSuccess !== false) return;
    const saveConditions = context?.saveConditions || [];
    if (saveConditions.length <= 0) return;
    const targetChar = (context._characters || []).find(c => c.name === applyTarget);
    const applied = applyFailedSaveConditions({ saveConditions, saveSuccess, targetChar, applyTarget, attackerName, context, campaignName });
    // MA-0639: fail-by-N margin rider lands ONLY when the base condition
    // actually landed (RAW: "unconscious WHILE poisoned" — immunity to the
    // base save_effect blocks the rider too).
    if (applied) applySaveMarginRider({ context, saveDc, saveTotal, applyTarget, attackerName, campaignName });
}

function applyFailedSaveConditions({ saveConditions, saveSuccess, targetChar, applyTarget, attackerName, context, campaignName }) {
    if (saveConditions.length <= 0 || saveSuccess) return false;
    const targetStats = targetChar?.computedStats || targetChar;
    const isImmune = targetStats && playerIsImmuneToCondition({
        conditionKey: saveConditions[0],
        playerStats: targetStats,
        getRuntimeValue,
        campaignName,
    });
    if (isImmune) return false;
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
    return true;
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

// MA-0427: authored secondary damage on a monster SAVE row (Brazen Gorgon
// Smelting Charge — "Failure: 13 (2d8 + 4) Piercing damage plus 13 (3d8) Fire
// damage"). Rolled SEPARATELY from the primary, each leg passes the SAME
// dc_success/evasion adjudication (computeDamageAfterEvasion — 'half' floors
// each leg independently, matching the MA-0426 attack-path secondary recipe),
// applied against its own damage type, and logged as its own save-damage
// entry. Byte-inert null return for every row without autoDamageSecondaryFormula.
async function applySecondarySaveDamageLeg({ context, combatSummary, attackerName, applyTarget, saveSuccess, hasEvasion, characters, campaignName, logEntry }) {
    const secondaryFormula = context?.autoDamageSecondaryFormula;
    if (!secondaryFormula) return null;
    const secondaryDamageType = context?.autoDamageSecondaryDamageType || null;
    if (!secondaryDamageType) console.error(`[saveProcessing] MA-0427 secondary formula "${secondaryFormula}" has no authored damage_type_secondary — applying typeless.`);
    const secondaryRollResult = rollExpression(secondaryFormula);
    if (!secondaryRollResult) {
        console.error(`[saveProcessing] MA-0427 unparseable secondary formula "${secondaryFormula}" — GM adjudicate manually.`);
        return null;
    }
    const secondarySaveDamage = computeDamageAfterEvasion(secondaryRollResult.total, saveSuccess, context?.dcSuccess, hasEvasion);
    const attackerChar = (characters || []).find(c => c.name === attackerName);
    const secondaryIgnoreResistance = (attackerChar?.computedStats && hasIgnoreResistance(attackerChar.computedStats, secondaryDamageType)) || false;
    const secondaryApplyResult = await applyDamageToTarget(combatSummary, applyTarget, secondarySaveDamage, [secondaryDamageType].filter(Boolean), { campaignName, characters, ignoreResistance: secondaryIgnoreResistance, attackerName, suppressHpLog: false, ...{ isSpellDamage: true } });
    logEntry(buildSaveDamageLogData({
        attackerName,
        context,
        damageFormula: secondaryFormula,
        damageResult: secondaryRollResult,
        finalDamage: secondarySaveDamage,
        damageType: secondaryDamageType,
        applyTarget,
        applyResult: secondaryApplyResult,
        saveSuccess,
    }));
    return {
        formula: secondaryFormula,
        rolls: secondaryRollResult.rolls,
        modifier: secondaryRollResult.modifier,
        total: secondaryRollResult.total,
        finalDamage: secondaryApplyResult?.finalDamage ?? secondarySaveDamage,
        damageType: secondaryDamageType,
        applyResult: secondaryApplyResult,
    };
}

// MA-0427 popup fields for the secondary save-damage leg — merged over the
// primary save-damage popup so the DiceRollResult SecondaryDamageSection names
// both dice, both halves, and the after-both-legs HP. {} for single-damage
// rows (popup byte-identical).
function buildSecondarySaveDamagePopupFields({ secondaryOutcome, effectiveD20ForSave, saveTotal, saveSuccess }) {
    if (!secondaryOutcome) return {};
    return {
        targetCurrentHp: secondaryOutcome.applyResult?.newHp,
        secondaryFormula: secondaryOutcome.formula,
        secondaryRolls: secondaryOutcome.rolls,
        secondaryModifier: secondaryOutcome.modifier,
        secondaryTotal: secondaryOutcome.total,
        secondaryFinalDamage: secondaryOutcome.finalDamage,
        secondaryDamageType: secondaryOutcome.damageType,
        secondarySaveResult: { roll: effectiveD20ForSave, total: saveTotal, bonus: 0, success: saveSuccess },
    };
}

// MA-0352: authored HP-threshold kill clause (Banshee Deathly Wail — "If the
// target has 25 Hit Points or fewer, it drops to 0 Hit Points"). Failed-save
// seam ONLY (success takes ZERO — dc_success:"none"): victim currentHp ≤
// threshold → lethal clamp to 0 via the canonical applyDamageToTarget choke
// point (death-clamp family), clause logged, normal 3d6 damage skipped;
// above threshold the row falls through to its normal damage roll unchanged.
// Byte-inert for every row without the authored numeric key.
// HP truth (§2): PC = runtime currentHitPoints, monster = cs currentHp ONLY.
function resolveThresholdVictimHp(csCreature, applyTarget, campaignName) {
    if (csCreature.type === 'player') {
        return Number(getRuntimeValue(applyTarget, 'currentHitPoints', campaignName) ?? 0);
    }
    return Number(csCreature.currentHp ?? 0);
}

async function applyHpThresholdKill({ context, campaignName, attackerName, applyTarget, damageType, characters }) {
    const threshold = Number(context?.hpThresholdKill);
    if (!Number.isFinite(threshold) || threshold <= 0) return false;
    const combatSummary = await loadCombatSummary(campaignName);
    const csCreature = combatSummary?.creatures?.find(c => c.name === applyTarget);
    if (!csCreature) return false;
    const currentHp = resolveThresholdVictimHp(csCreature, applyTarget, campaignName);
    if (!(currentHp > 0) || currentHp > threshold) return false;
    const actionName = context?.actionName || context?.autoDamageName || context?.name || 'the action';
    await applyDamageToTarget(combatSummary, applyTarget, currentHp, [damageType], { campaignName, characters: characters, ignoreResistance: true, attackerName: attackerName, suppressHpLog: false, ...{ isSpellDamage: true } });
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'hp_threshold_kill',
        characterName: applyTarget,
        sourceName: attackerName,
        abilityName: actionName,
        description: `${applyTarget} failed ${attackerName}'s ${actionName} save at ${currentHp} Hit Points (${currentHp} ≤ ${threshold}) — ${applyTarget} drops to 0 Hit Points (HP threshold kill; no damage rolled).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveProcessing:hp-threshold-kill]', e); });
    return true;
}

function buildThresholdKillPopupData({ context, damageType, applyTarget, effectiveD20ForSave, saveTotal, saveDc, saveType, newHp }) {
    return {
        type: 'save-damage',
        name: context?.actionName || context.name,
        formula: '',
        rolls: [],
        total: 0,
        bonus: 0,
        modifier: 0,
        damageType: damageType,
        targetName: applyTarget,
        targetCurrentHp: newHp,
        targetMaxHp: undefined,
        saveDc,
        saveType,
        dcSuccess: context?.dcSuccess,
        saveResult: { roll: effectiveD20ForSave, total: saveTotal, bonus: context?._saveResultData?.saveBonus ?? 0, success: false },
        finalDamage: 0,
        damageApplied: false,
        thresholdKill: true,
        thresholdNote: `Drops to 0 Hit Points — HP threshold kill (${context?.hpThresholdKill} HP or fewer).`,
    };
}

// MA-0352 damage-skip wrapper: the threshold leg is consulted BEFORE the
// normal damage roll; a completed kill short-circuits the leg and owns its
// own popup. All other rows fall through to applySaveDamage unchanged.
async function maybeApplyThresholdKillLeg({ context, characterName, campaignName, attackerName, targetName, saveSuccess, effectiveD20ForSave, saveTotal, saveType, saveDc, setPopupHtml, characters }) {
    if (saveSuccess !== false || context?.hpThresholdKill == null) return false;
    const damageType = context.autoDamageDamageType || 'Psychic';
    const applyTarget = targetName || characterName;
    const killed = await applyHpThresholdKill({ context, campaignName, attackerName, applyTarget, damageType, characters });
    if (!killed) return false;
    setPopupHtml(buildThresholdKillPopupData({ context, damageType, applyTarget, effectiveD20ForSave, saveTotal, saveDc, saveType, newHp: 0 }));
    return true;
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

    // MA-0427: authored secondary damage on a SAVE row (Brazen Gorgon Smelting
    // Charge "Failure: 2d8 + 4 Piercing damage plus 3d8 Fire damage") rolls as a
    // SECOND save-damage leg with its own half-on-success pass — dc_success
    // semantics apply to both legs identically via computeDamageAfterEvasion,
    // each leg floor-halved independently. Byte-inert null for every row without
    // damage_dice_secondary (all existing single-damage suites byte-identical).
    const secondaryOutcome = await applySecondarySaveDamageLeg({ context, combatSummary: combatSummaryForSave, attackerName, applyTarget, saveSuccess, hasEvasion, characters, campaignName, logEntry });

    setPopupHtml({
        ...buildSaveDamagePopupData({ context, damageFormula, damageResult, finalDamage, damageType, applyTarget, applyResult, targetName, effectiveD20ForSave, saveTotal, saveSuccess, saveDc, saveType }),
        // MA-0427: dual-damage rows surface BOTH legs honestly in the popup
        // (DiceRollResult SecondaryDamageSection); single-damage popups byte-identical.
        ...buildSecondarySaveDamagePopupFields({ secondaryOutcome, effectiveD20ForSave, saveTotal, saveSuccess }),
    });

    applyFailedSaveConditions({ saveConditions, saveSuccess, targetChar, applyTarget, attackerName, context, campaignName });
    maybeLogMemoryGainAtZeroHp({ context, combatSummary: combatSummaryForSave, applyTarget, attackerName, applyResult, saveSuccess, campaignName });
    maybeNoteEyeRayZeroHp({ context, applyResult, applyTarget, attackerName, campaignName });
}

// MA-0374: Disintegration/Death Ray — "Failure or Success: the target dies
// / disintegrates into dust if this damage reduces it to 0 Hit Points."
// No 0-HP instakill subsystem app-wide (§7), so the clause lands as a
// named advisory record the moment the ray's damage actually zeroes the
// target — on EITHER save outcome. Byte-inert without zero_hp_clause.
function maybeNoteEyeRayZeroHp({ context, applyResult, applyTarget, attackerName, campaignName }) {
    const clause = context?.eyeRay?.zero_hp_clause;
    if (!clause || !applyResult || !(Number(applyResult.newHp) <= 0)) return;
    const actionName = context?.actionName || context?.autoDamageName || context?.name || 'Eye Rays';
    addEntry(campaignName, {
        type: 'automation',
        automationType: 'eye_ray_zero_hp_advisory',
        characterName: applyTarget,
        sourceName: attackerName,
        abilityName: actionName,
        description: `${applyTarget} was reduced to 0 Hit Points by ${attackerName}'s ${actionName} — ${applyTarget} ${clause} (GM-enforced; no 0-HP instakill consumer in this engine).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[saveProcessing:eye-ray-zero-hp]', e); });
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
