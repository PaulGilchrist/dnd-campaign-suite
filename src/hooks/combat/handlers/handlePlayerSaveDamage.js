import { computeDamageAfterSave, applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { getAllyList } from '../../useAllySelection.js';
import { hasIgnoreResistance, evaluateAutoExpression } from '../../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../../services/rules/features/invisibilityService.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { isDeathWardActive } from '../../../services/automation/handlers/buffs/deathWardHandler.js';
import { hasBuffEffect } from '../../../services/automation/common/buffToggle.js';
import { registerPendingSavePrompt } from '../../../services/combat/auras/pendingSaveRegistry.js';
import { registerPendingPopupSetter } from '../../../services/combat/auras/pendingPopupRegistry.js';
import utils from '../../../services/ui/utils.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { getHolyAuraTargets } from '../../../services/automation/handlers/buffs/holyAuraHandler.js';
import { handleOverchannelSelfDamage } from './handleOverchannelSelfDamage.js';

function computeIndomitableMax(level) {
    return level >= 17 ? 3 : level >= 13 ? 2 : 1;
}

function resolveAutoRerolls({ targetConditionEffects, targetChar, fanaticalFocusUsed, indomitableUses, indomitableMax }) {
    let autoRerollForSaves = targetConditionEffects.autoRerollForSaves;
    // Never disable the Halfling Lucky trait (roll_equals_1 is unlimited/passive;
    // these kill-switches belong to the once-per-rest reroll features).
    const isHalflingLuckyReroll = targetConditionEffects.autoRerollCondition === 'roll_equals_1';
    if (fanaticalFocusUsed && autoRerollForSaves && !isHalflingLuckyReroll) {
        autoRerollForSaves = false;
    }
    if (indomitableUses >= indomitableMax && autoRerollForSaves && !isHalflingLuckyReroll) {
        autoRerollForSaves = false;
    }
    let autoRerollBonus = targetConditionEffects.autoRerollBonus;
    if (autoRerollBonus && targetChar?.computedStats) {
        autoRerollBonus = evaluateAutoExpression(autoRerollBonus, targetChar.computedStats);
    }
    return { autoRerollForSaves, autoRerollBonus };
}

// Shared auto-success save leg for Careful Spell and Contact Patron: the save is
// forced to succeed, damage reduced per dcSuccess, and a popup is shown without
// prompting the player.
async function applyForcedSuccessSave({ context, combatSummary, target, characters, campaignName, characterName, name, formula, modifier, adjustedTotal, displayRolls, saveDc, saveType, dcSuccess, damageType, targetMaxHp, gwfBaseRolls, gwfDisplayRolls, setPopupHtml, logEntry, note, popupFlag }) {
    const autoSuccessDamage = computeDamageAfterSave(adjustedTotal, true, dcSuccess);
    const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

    logEntry({
        type: 'roll',
        characterName,
        rollType: 'save-damage',
        name,
        formula,
        rolls: displayRolls,
        total: adjustedTotal,
        modifier,
        damageType,
        targetName: target.name,
        saveType,
        saveDc,
        saveResult: 'success',
        saveRoll: 20,
        saveBonus: 0,
        finalDamage: null,
        note,
        gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
        gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
        gwfDisplayRolls: gwfDisplayRolls,
    });

    const applyResult = await applyDamageToTarget(combatSummary, target.name, autoSuccessDamage, [damageType], campaignName, characters, ignoreResistance, characterName, false, { isSpellDamage: true });

    if (applyResult && applyResult.finalDamage > 0) {
        endInvisibilityOnHostileAction(characterName, campaignName);
    }
    setPopupHtml({
        type: 'save-damage',
        name,
        formula,
        rolls: displayRolls,
        total: autoSuccessDamage,
        bonus: 0,
        modifier,
        damageType,
        targetName: target.name,
        targetCurrentHp: applyResult?.newHp,
        targetMaxHp,
        saveDc,
        saveType,
        dcSuccess,
        saveResult: { success: true, roll: 20, total: saveDc, bonus: 0 },
        finalDamage: autoSuccessDamage,
        damageApplied: true,
        damageReduced: false,
        [popupFlag]: true,
        gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
        gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
    });
    return true;
}

async function resolvePlayerSaveDisadvantage({ context, target, campaignName, characterName, targetEffects, restoreBalance }) {
    const coronaDisadvantage = getCoronaSaveDisadvantage({
        targetName: target.name,
        campaignName,
        damageType: context?.damageType,
        skipRangeCheck: true,
    }).disadvantage || false;
    const elderChampionDisadvantage = await getElderChampionSaveDisadvantage({
        attackerName: characterName,
        attackerStats: context?.playerStats,
        targetName: target.name,
    });
    const hasRiderSaveDisadvantage = targetEffects.some(te => te.effect === 'disadvantage_on_next_save');
    let saveDisadvantage = (context?.metamagicHeighten || false) || coronaDisadvantage || elderChampionDisadvantage.disadvantage || hasRiderSaveDisadvantage;
    if (restoreBalance && saveDisadvantage) {
        const disadvantageSources = [context?.metamagicHeighten, coronaDisadvantage, elderChampionDisadvantage.disadvantage].filter(Boolean).length;
        saveDisadvantage = disadvantageSources > 1;
    }
    return saveDisadvantage;
}

function computePlayerSaveAdvantage({ targetConditionEffects, saveType, target, campaignName }) {
    // CLA-394: Zealous Presence buff (advantage_attacks_and_saves) grants blanket save advantage.
    return !!(targetConditionEffects.saveAdvantageCount > 0 ||
        (targetConditionEffects.saveAdvantageAbilities && targetConditionEffects.saveAdvantageAbilities.includes((saveType || '').substring(0, 3).toUpperCase())) ||
        isCircleOfPowerActive(target.name, campaignName) ||
        isDeathWardActive(target.name, campaignName) ||
        hasBuffEffect(target.name, 'advantage_attacks_and_saves', campaignName));
}

function buildPendingData({ context, target, campaignName, characterName, setPopupHtml, name, formula, modifier, rolls, adjustedTotal, saveDc, saveType, dcSuccess, damageType, saveDisadvantage, saveAdvantage }) {
    const { attackerName, isCantrip, overchannelActive, overchannelUseCount, overchannelSpellLevel, statusEffects, playerStats, viciousMockerySpell, viciousMockeryMapName, autoDamageSecondaryFormula, autoDamageSecondaryName, autoDamageSecondaryDamageType } = context || {};
    return {
        targetName: target.name, rawDamage: adjustedTotal, saveDc, saveType, dcSuccess,
        damageType, attackerName: attackerName || characterName, name, formula, modifier, rolls, campaignName, setPopupHtml,
        metamagicHeighten: saveDisadvantage,
        saveAdvantage,
        isCantrip: isCantrip || false,
        overchannelActive: overchannelActive || false,
        overchannelUseCount: overchannelUseCount || 0,
        overchannelSpellLevel: overchannelSpellLevel || 1,
        statusEffects: statusEffects || [],
        playerStats,
        // CLA-377: Vicious Mockery disadvantage gated on the resolved save outcome.
        viciousMockerySpell: viciousMockerySpell || null,
        viciousMockeryMapName: viciousMockeryMapName || null,
        autoDamageSecondaryFormula: autoDamageSecondaryFormula || null,
        autoDamageSecondaryName: autoDamageSecondaryName || null,
        autoDamageSecondaryDamageType: autoDamageSecondaryDamageType || null,
        // CLA-324: this seam is player-cast save-spell damage — spell-origin.
        isSpellDamage: true,
    };
}

// Gather all target-side condition/buff/reroll state for a player save, in the
// original read order (runtime-store reads must stay in sequence).
function resolveTargetSaveContext({ charactersRef, campaignName, target, attackerName, characterName }) {
    const targetChar = (charactersRef.current || []).find(c => c.name === target.name);
    const targetConditions = getRuntimeValue(target.name, 'activeConditions', campaignName) || [];
    const targetSaveModifiers = targetChar?.computedStats?.saveModifiers || [];
    const targetEffects = (getRuntimeValue('campaign', 'targetEffects') || []).filter(te => te.target === target.name);
    const targetBuffs = getRuntimeValue(target.name, 'activeBuffs', campaignName) || [];
    const isRaging = Array.isArray(targetBuffs) && targetBuffs.some(b => b.damageBonusExpression);
    const shapeShiftActive = Array.isArray(targetBuffs) && targetBuffs.some(b => b.effect === 'shape_shift');
    const seeInvisibilityActive = Array.isArray(targetBuffs) && targetBuffs.some(b => b.effect === 'see_invisibility');
    const isLivingLegendActive = getRuntimeValue(target.name, 'livingLegendActive', campaignName) === true;
    const isElderChampionActive = getRuntimeValue(target.name, 'elderChampionActive', campaignName) === true;
    const effectiveAttackerName = attackerName || characterName;
    const isElderChampionAttackerActive = effectiveAttackerName !== target.name && getRuntimeValue(effectiveAttackerName, 'elderChampionActive', campaignName) === true;
    const holyAuraTargets = getHolyAuraTargets(target.name, campaignName);
    const isProtectionFromPoisonActive = Array.isArray(targetBuffs) && targetBuffs.some(b => b.name === 'Protection from Poison' && b.effect === 'protection_from_poison');
    const combatContext = getCombatSummary(campaignName);
    const targetConditionEffects = computeConditionEffects(targetConditions, targetSaveModifiers, targetEffects, isRaging, shapeShiftActive, false, false, combatContext, seeInvisibilityActive, target.name, isLivingLegendActive, isElderChampionActive, isElderChampionAttackerActive, holyAuraTargets, isProtectionFromPoisonActive, false);
    const fanaticalFocusUsed = getRuntimeValue(target.name, 'fanaticalFocusUsed', campaignName);
    const indomitableUses = Number(getRuntimeValue(target.name, 'indomitableUses', campaignName) ?? 0);
    const indomitableMax = computeIndomitableMax(targetChar?.computedStats?.level || 0);
    const { autoRerollForSaves, autoRerollBonus } = resolveAutoRerolls({ targetConditionEffects, targetChar, fanaticalFocusUsed, indomitableUses, indomitableMax });
    return { targetEffects, targetConditionEffects, autoRerollForSaves, autoRerollBonus };
}

export function createPlayerSaveDamageHandler(deps) {
    const { characterName, campaignName, characters, charactersRef, setPopupHtml, logEntry, pendingSaves } = deps;

    return async function handlePlayerSaveDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls) {
        const { saveDc, saveType, dcSuccess, damageType, attackerName } = context || {};
        const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
        if (!target || target.type !== 'player') return;
        const targetMaxHp = getRuntimeValue(target.name, 'hitPoints') ?? 0;

        const { targetEffects, targetConditionEffects, autoRerollForSaves, autoRerollBonus } = resolveTargetSaveContext({ charactersRef, campaignName, target, attackerName, characterName });
        const restoreBalance = targetConditionEffects.restoreBalance;

        if (context?.metamagicCareful) {
            const allyList = getAllyList(characterName);
            if (!allyList.includes(target.name)) return;
            return await applyForcedSuccessSave({ context, combatSummary, target, characters, campaignName, characterName, name, formula, modifier, adjustedTotal, displayRolls, saveDc, saveType, dcSuccess, damageType, targetMaxHp, gwfBaseRolls, gwfDisplayRolls, setPopupHtml, logEntry, note: 'careful_spell_damage_roll_before_apply', popupFlag: 'carefulSpell' });
        }

        const hasContactPatron = (context?.playerStats?.automation?.passives || []).some(
            p => p.type === 'passive_rule' && p.effect === 'contact_patron_auto_save'
        );
        if (hasContactPatron && name === 'Contact Other Plane' && target.name === characterName) {
            return await applyForcedSuccessSave({ context, combatSummary, target, characters: null, campaignName, characterName, name, formula, modifier, adjustedTotal, displayRolls, saveDc, saveType, dcSuccess, damageType, targetMaxHp, gwfBaseRolls, gwfDisplayRolls, setPopupHtml, logEntry, note: 'contact_patron_damage_roll_before_apply', popupFlag: 'contactPatron' });
        }

        const promptId = utils.guid();
        const saveDisadvantage = await resolvePlayerSaveDisadvantage({ context, target, campaignName, characterName, targetEffects, restoreBalance });
        const saveAdvantage = computePlayerSaveAdvantage({ targetConditionEffects, saveType, target, campaignName });

        const pendingData = buildPendingData({ context, target, campaignName, characterName, setPopupHtml, name, formula, modifier, rolls, adjustedTotal, saveDc, saveType, dcSuccess, damageType, saveDisadvantage, saveAdvantage });
        pendingSaves[promptId] = pendingData;
        registerPendingSavePrompt(promptId, pendingData);
        registerPendingPopupSetter(promptId, setPopupHtml);

        sendSavePrompt(campaignName, {
            promptId,
            targetName: target.name,
            saveType,
            saveDc,
            dcSuccess,
            damageFormula: formula,
            damageType,
            sourceName: name,
            sourceAttackerName: attackerName || characterName,
            rawDamage: adjustedTotal,
            disadvantage: saveDisadvantage,
            advantage: saveAdvantage,
            // CLA-324: player-cast save spell — spell-origin marker.
            isSpellDamage: true,
        });

        logEntry({
            type: 'roll',
            characterName,
            rollType: 'save-prompt',
            name,
            formula,
            rolls: displayRolls,
            total: adjustedTotal,
            modifier,
            bonus: modifier,
            damageType,
            targetName: target.name,
            saveType,
            saveDc,
            dcSuccess,
            forcedMode: context?.metamagicHeighten ? 'disadvantage' : 'normal',
            gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
            gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
        });

        setPopupHtml({
            type: 'save-damage',
            name,
            formula,
            rolls,
            total: adjustedTotal,
            bonus: 0,
            modifier,
            damageType,
            targetName: target.name,
            saveDc,
            saveType,
            dcSuccess,
            waitingForPlayerSave: true,
            promptId,
            rawDamage: adjustedTotal,
            attackerName: attackerName || characterName,
            gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
            gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
            autoReroll: autoRerollForSaves,
            autoRerollBonus: autoRerollBonus,
            autoRerollCondition: targetConditionEffects.autoRerollCondition,
        });

        handleOverchannelSelfDamage(characterName, campaignName, context, logEntry, characters);

        return true;
    };
}
