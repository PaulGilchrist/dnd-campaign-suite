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
import { registerPendingSavePrompt } from '../../../services/combat/auras/pendingSaveRegistry.js';
import { registerPendingPopupSetter } from '../../../services/combat/auras/pendingPopupRegistry.js';
import utils from '../../../services/ui/utils.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { getHolyAuraTargets } from '../../../services/automation/handlers/buffs/holyAuraHandler.js';
import { handleOverchannelSelfDamage } from './handleOverchannelSelfDamage.js';

export function createPlayerSaveDamageHandler(deps) {
    const { characterName, campaignName, characters, charactersRef, setPopupHtml, logEntry, pendingSaves } = deps;

    return async function handlePlayerSaveDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls) {
        const { saveDc, saveType, dcSuccess, damageType, attackerName } = context || {};
        const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
        if (!target || target.type !== 'player') return;
        const targetMaxHp = getRuntimeValue(target.name, 'hitPoints') ?? 0;

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
        const restoreBalance = targetConditionEffects.restoreBalance;
        const fanaticalFocusUsed = getRuntimeValue(target.name, 'fanaticalFocusUsed', campaignName);
        const indomitableUses = Number(getRuntimeValue(target.name, 'indomitableUses', campaignName) ?? 0);
        const indomitableMax = (targetChar?.computedStats?.level || 0) >= 17 ? 3 : (targetChar?.computedStats?.level || 0) >= 13 ? 2 : 1;
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

        const isCarefulAlly = context?.metamagicCareful || false;
        if (isCarefulAlly) {
            const allyList = getAllyList(characterName);
            const isTargetProtected = allyList.includes(target.name);
            if (!isTargetProtected) return;
            const carefulDamage = computeDamageAfterSave(adjustedTotal, true, dcSuccess);
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
                note: 'careful_spell_damage_roll_before_apply',
                gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
                gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
                gwfDisplayRolls: gwfDisplayRolls,
            });

            const applyResult = await applyDamageToTarget(combatSummary, target.name, carefulDamage, [damageType], campaignName, characters, ignoreResistance, characterName, false, { isSpellDamage: true });

            if (applyResult && applyResult.finalDamage > 0) {
                endInvisibilityOnHostileAction(characterName, campaignName);
            }
            setPopupHtml({
                type: 'save-damage',
                name,
                formula,
                rolls: displayRolls,
                total: carefulDamage,
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
                finalDamage: carefulDamage,
                damageApplied: true,
                damageReduced: false,
                carefulSpell: true,
                gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
                gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
            });
            return true;
        }

        const hasContactPatron = (context?.playerStats?.automation?.passives || []).some(
            p => p.type === 'passive_rule' && p.effect === 'contact_patron_auto_save'
        );
        if (hasContactPatron && name === 'Contact Other Plane' && target.name === characterName) {
            const successfulSave = computeDamageAfterSave(adjustedTotal, true, dcSuccess);
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
                note: 'contact_patron_damage_roll_before_apply',
                gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
                gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
                gwfDisplayRolls: gwfDisplayRolls,
            });

            const applyResult = await applyDamageToTarget(combatSummary, target.name, successfulSave, [damageType], campaignName, null, ignoreResistance, characterName, false, { isSpellDamage: true });

            if (applyResult && applyResult.finalDamage > 0) {
                endInvisibilityOnHostileAction(characterName, campaignName);
            }
            setPopupHtml({
                type: 'save-damage',
                name,
                formula,
                rolls: displayRolls,
                total: successfulSave,
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
                finalDamage: successfulSave,
                damageApplied: true,
                damageReduced: false,
                contactPatron: true,
                gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
                gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
            });
            return true;
        }

        const promptId = utils.guid();
        const coronaDisadvantage = getCoronaSaveDisadvantage({
            targetName: target.name,
            campaignName,
            damageType,
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

        const saveAdvantage = !!(targetConditionEffects.saveAdvantageCount > 0 ||
            (targetConditionEffects.saveAdvantageAbilities && targetConditionEffects.saveAdvantageAbilities.includes((saveType || '').substring(0, 3).toUpperCase())) ||
            isCircleOfPowerActive(target.name, campaignName) ||
            isDeathWardActive(target.name, campaignName));

        const pendingData = {
            targetName: target.name, rawDamage: adjustedTotal, saveDc, saveType, dcSuccess,
            damageType, attackerName: attackerName || characterName, name, formula, modifier, rolls, campaignName, setPopupHtml,
            metamagicHeighten: saveDisadvantage,
            saveAdvantage,
            isCantrip: context?.isCantrip || false,
            overchannelActive: context?.overchannelActive || false,
            overchannelUseCount: context?.overchannelUseCount || 0,
            overchannelSpellLevel: context?.overchannelSpellLevel || 1,
            statusEffects: context?.statusEffects || [],
            playerStats: context?.playerStats,
            // CLA-377: Vicious Mockery disadvantage gated on the resolved save outcome.
            viciousMockerySpell: context?.viciousMockerySpell || null,
            viciousMockeryMapName: context?.viciousMockeryMapName || null,
            autoDamageSecondaryFormula: context?.autoDamageSecondaryFormula || null,
            autoDamageSecondaryName: context?.autoDamageSecondaryName || null,
            autoDamageSecondaryDamageType: context?.autoDamageSecondaryDamageType || null,
            // CLA-324: this seam is player-cast save-spell damage — spell-origin.
            isSpellDamage: true,
        };
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
