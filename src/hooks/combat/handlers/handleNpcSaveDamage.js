import { rollExpression, rollExpressionDoubled, formatDamageFormula } from '../../../services/dice/diceRoller.js';
import { addEntry } from '../../../services/ui/logService.js';
import utils from '../../../services/ui/utils.js';
import {
    computeDamageAfterSave,
    computeDamageAfterEvasion,
    rollSaveForCreature,
    applyDamageToTarget,
    normalizeSaveType,
} from '../../../services/rules/combat/applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { hasIgnoreResistance, playerIsImmuneToCondition, hasGreatWeaponFighting, applyGreatWeaponFightingToDamage, evaluateAutoExpression } from '../../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../../services/rules/features/invisibilityService.js';
import { hasPotentCantrip, hasSoulstitchProtection, applyMinDamageAdjustment, clearSoulstitchStamp } from '../loggedDiceRollUtils.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { resolveCreatureType } from '../../../services/combat/creatureTypeResolver.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { handleOverchannelSelfDamage } from './handleOverchannelSelfDamage.js';

// CLA-279: consume Radiant Soul once-per-turn when the save-damage roll carries the
// execution-owned " + N [Radiant Soul]" adder (single-target save spells).
function consumeRadiantSoulOncePerTurn(characterName, formula, appliedDamage, campaignName) {
    if (appliedDamage > 0 && String(formula || '').includes('[Radiant Soul]')) {
        const radiantSoulFlagKey = `_radiantSoul_${characterName.replace(/\s+/g, '_')}_oncePerTurn`;
        setRuntimeValue(characterName, radiantSoulFlagKey, true, campaignName);
    }
}

function applyPostSaveDamageEffects(primaryApplyResult, characterName, campaignName, formula) {
    if (primaryApplyResult && primaryApplyResult.finalDamage > 0) {
        endInvisibilityOnHostileAction(characterName, campaignName);
        consumeRadiantSoulOncePerTurn(characterName, formula, primaryApplyResult.finalDamage, campaignName);
    }
}

// CLA-324: against_spell advantage only on saves against spells — spell-origin is
// identifiable from cast-spell context (school/cantrip/flag) or lastAttack stamps.
function hasSpellOrigin(saveModifiers, context, campaignName) {
    if (!saveModifiers.some(mod => mod.target === 'saving_throw' && mod.effect === 'advantage' && mod.condition === 'against_spell')) return false;
    if (context?.isSpellDamage === true || context?.isCantrip === true || !!context?.autoDamageSchool) return true;
    const lastAttackOrigin = getRuntimeValue('campaign', 'lastAttack', campaignName) || {};
    return lastAttackOrigin.rollType === 'spell-save' || lastAttackOrigin.isSpellDamage === true;
}

export function createNpcSaveDamageHandler(deps) {
    const { characterName, campaignName, characters, setPopupHtml, logEntry } = deps;

    return async function handleNpcSaveDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls) {
        const { saveDc, saveType, dcSuccess, damageType } = context || {};
        const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
        if (!target) return;
        const targetMaxHp = target?.type === 'player'
            ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
            : target?.maxHp ?? 0;

        let disadvantage = context?.metamagicHeighten || false;
        if (!disadvantage) {
            const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
            const idx = targetEffects.findIndex(te => te.target === target.name && te.effect === 'disadvantage_on_next_save');
            if (idx !== -1) {
                disadvantage = true;
                targetEffects.splice(idx, 1);
                setRuntimeValue('campaign', 'targetEffects', [...targetEffects], campaignName);
            }
        }
        if (!disadvantage) {
            const coronaResult = getCoronaSaveDisadvantage({
                targetName: target.name,
                campaignName,
                damageType,
                skipRangeCheck: true,
            });
            if (coronaResult.disadvantage) {
                disadvantage = true;
            }
        }
        if (!disadvantage) {
            const elderChampionResult = await getElderChampionSaveDisadvantage({
                attackerName: characterName,
                attackerStats: context?.playerStats,
                targetName: target.name,
            });
            if (elderChampionResult.disadvantage) {
                disadvantage = true;
            }
        }
        const isSoulstitchProtected = hasSoulstitchProtection(target.name, characterName, campaignName);
        const targetCharacter = (characters || []).find(c => utils.getName(c.name) === target.name);
        const targetSaveModifiers = targetCharacter?.saveModifiers || targetCharacter?.computedStats?.saveModifiers || [];
        const advantage = hasSpellOrigin(targetSaveModifiers, context, campaignName) || isCircleOfPowerActive(target.name, campaignName);
        const saveResult = rollSaveForCreature(target, saveType, saveDc, disadvantage, advantage);
        const normalizedSaveType = normalizeSaveType(saveType);
        const targetConditions = getRuntimeValue(target.name, 'activeConditions', campaignName) || [];
        const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');
        const ownEvasion = targetCharacter?.computedStats?.evasionEffects;
        const hasOwnEvasion = !isIncapacitated && dcSuccess === 'half' && ownEvasion?.some(ef => ef.saveType === normalizedSaveType);
        const hasSharedEvasion = !hasOwnEvasion && !isIncapacitated && dcSuccess === 'half' &&
            (characters || []).some(c => {
                if (c.name === target.name) return false;
                const ev = c?.computedStats?.evasionEffects;
                return ev?.some(ef => ef.saveType === normalizedSaveType && ef.shareable && ef.shareRange >= 5);
            });
        const hasEvasion = hasOwnEvasion || hasSharedEvasion || isCircleOfPowerActive(target.name, campaignName);
        let finalDamage = isSoulstitchProtected ? 0 : computeDamageAfterEvasion(adjustedTotal, saveResult.success, dcSuccess, hasEvasion);

        if (hasEvasion) {
            logEntry({
                type: 'roll',
                characterName: target.name,
                rollType: 'evasion',
                name: hasOwnEvasion ? 'Evasion' : 'Leading Evasion',
                targetName: target.name,
                saveType,
                saveDc,
                saveResult: saveResult.success ? 'success' : 'failure',
                dcSuccess,
                timestamp: Date.now(),
                id: utils.guid(),
            });
        }

        const isCantripFlag = context?.isCantrip || false;
        const hasPotentFlag = hasPotentCantrip(context?.playerStats);
        const hasBlessedStrikesOptions = context?.playerStats?.automation?.actions?.some(
            a => a.type === 'damage_bonus' && a.options?.length > 0 && a.options.includes('Potent Spellcasting')
        ) || false;
        if (!isSoulstitchProtected && hasPotentFlag && isCantripFlag && saveResult.success && dcSuccess === 'none') {
            finalDamage = Math.floor(adjustedTotal / 2);
        }
        if (!isSoulstitchProtected && hasBlessedStrikesOptions && isCantripFlag && !saveResult.success && dcSuccess === 'none') {
            const playerStats = context?.playerStats;
            if (playerStats?.automation?.actions) {
                const allAutomation = [
                    ...(playerStats.automation.actions || []),
                    ...(playerStats.automation.passives || []),
                ];
                const cantripBonuses = playerStats.automation.actions.filter(
                    a => a.type === 'damage_bonus' && a.options?.length > 0 && a.tempHpExpression
                );
                const upgradedNames = new Set(allAutomation.filter(b => b.upgrades).map(b => b.upgrades));
                const filteredBonuses = cantripBonuses.filter(b => !upgradedNames.has(b.name));
                for (const bonus of filteredBonuses) {
                    const tempHp = evaluateAutoExpression(bonus.tempHpExpression, playerStats);
                    if (tempHp && !isNaN(tempHp) && tempHp > 0) {
                        const allies = combatSummary?.creatures?.filter(c =>
                            c.type === 'player' || c.type === 'npc' || c.type === 'monster'
                        ) || [];
                        if (allies.length > 0) {
                            const targets = allies.map(c => ({
                                name: c.name,
                                currentHp: c.currentHp,
                                maxHp: c.maxHp,
                                size: c.size,
                                type: c.type,
                            }));
                            window.dispatchEvent(new CustomEvent('potent-spellcasting-temp-hp', {
                                detail: {
                                    title: 'Improved Blessed Strikes — Potent Spellcasting',
                                    targets,
                                    tempHp,
                                    campaignName,
                                    attackerName: characterName,
                                    confirmLabel: 'Grant Temp HP',
                                },
                                bubbles: true,
                            }));
                        }
                    }
                }
            }
        }
        const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

        let secondaryResult = null;
        let secondaryFinalDamage = 0;
        if (context?.autoDamageSecondaryFormula) {
            const secondaryFormula = context.autoDamageSecondaryFormula;
            const secondaryName = context.autoDamageSecondaryName || name;
            const secondaryDamageType = context.autoDamageSecondaryDamageType;
            const secondaryRollResult = context?.isAutoCrit ? rollExpressionDoubled(secondaryFormula) : rollExpression(secondaryFormula);
            if (secondaryRollResult) {
                let secondaryTotal = applyMinDamageAdjustment(secondaryRollResult.total, secondaryRollResult.rolls, context?.playerStats, secondaryDamageType);
                if (hasGreatWeaponFighting(context?.playerStats)) {
                    const gwfSecondaryRolls = applyGreatWeaponFightingToDamage(secondaryRollResult.rolls, context?.playerStats);
                    const hasSecondaryChanges = gwfSecondaryRolls.some((r, i) => r !== secondaryRollResult.rolls[i]);
                    if (hasSecondaryChanges) {
                        const gwfSecondaryTotal = gwfSecondaryRolls.reduce((sum, r) => sum + r, 0) + secondaryRollResult.modifier;
                        secondaryTotal = applyMinDamageAdjustment(gwfSecondaryTotal, gwfSecondaryRolls, context?.playerStats, secondaryDamageType);
                    }
                }
                let secondarySaveResult = saveResult;
                if (context.saveDc && context.saveType) {
                    let secondaryDisadvantage = context.metamagicHeighten || false;
                    if (!secondaryDisadvantage) {
                        const coronaResult = getCoronaSaveDisadvantage({
                            targetName: target.name,
                            campaignName,
                            damageType: secondaryDamageType,
                            skipRangeCheck: true,
                        });
                        if (coronaResult.disadvantage) {
                            secondaryDisadvantage = true;
                        }
                    }
                    if (!secondaryDisadvantage) {
                        const elderChampionResult = await getElderChampionSaveDisadvantage({
                            attackerName: characterName,
                            attackerStats: context?.playerStats,
                            targetName: target.name,
                        });
                        if (elderChampionResult.disadvantage) {
                            secondaryDisadvantage = true;
                        }
                    }
                    secondarySaveResult = rollSaveForCreature(target, context.saveType, context.saveDc, secondaryDisadvantage, advantage);
                }
                let secondaryRawDamage = isSoulstitchProtected ? 0 : computeDamageAfterSave(secondaryTotal, secondarySaveResult.success, context.dcSuccess);
                if (!isSoulstitchProtected && hasPotentFlag && isCantripFlag && secondarySaveResult.success && context.dcSuccess === 'none') {
                    secondaryRawDamage = Math.floor(secondaryTotal / 2);
                }
                const secondaryIgnoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, secondaryDamageType)) || false;
                const secondaryApplyResult = await applyDamageToTarget(combatSummary, target.name, secondaryRawDamage, [secondaryDamageType], campaignName, characters, secondaryIgnoreResistance, characterName, true, { skipConcentration: true });
                secondaryFinalDamage = secondaryApplyResult?.finalDamage ?? secondaryRawDamage;
                if (secondaryApplyResult && secondaryApplyResult.finalDamage > 0) {
                    endInvisibilityOnHostileAction(characterName, campaignName);
                }
                secondaryResult = {
                    name: secondaryName,
                    formula: secondaryFormula,
                    rolls: secondaryRollResult.rolls,
                    total: secondaryTotal,
                    modifier: secondaryRollResult.modifier,
                    damageType: secondaryDamageType,
                    finalDamage: secondaryFinalDamage,
                    resistanceDetails: secondaryApplyResult?.resistanceDetails || [],
                    saveResult: isSoulstitchProtected ? 'soulstitch_auto_success' : (secondarySaveResult.success ? 'success' : 'failure'),
                    saveRoll: secondarySaveResult.roll,
                    saveBonus: secondarySaveResult.bonus,
                    saveRawRolls: secondarySaveResult.rawRolls,
                    dcSuccess: context.dcSuccess,
                };
            }
        }

        const primaryApplyResult = secondaryFinalDamage > 0
          ? await applyDamageToTarget(combatSummary, target.name, finalDamage, [damageType], campaignName, characters, ignoreResistance, characterName, true, { concentrationTotalDamage: finalDamage + secondaryFinalDamage })
          : await applyDamageToTarget(combatSummary, target.name, finalDamage, [damageType], campaignName, characters, ignoreResistance, characterName, true);

        applyPostSaveDamageEffects(primaryApplyResult, characterName, campaignName, formula);

        const isCrit = context?.isAutoCrit || false;
        const displayFormula = isCrit ? formatDamageFormula(formula, displayRolls, true) : formula;

        const logEntryData = {
            type: 'roll',
            characterName,
            rollType: 'save-damage',
            name,
            formula: displayFormula,
            rolls: displayRolls,
            total: adjustedTotal,
            modifier,
            damageType,
            targetName: target.name,
            saveType,
            saveDc,
            saveResult: isSoulstitchProtected ? 'soulstitch_auto_success' : (saveResult.success ? 'success' : 'failure'),
            saveRoll: saveResult.roll,
            saveBonus: saveResult.bonus,
            saveRawRolls: saveResult.rawRolls,
            forcedMode: disadvantage ? 'disadvantage' : 'normal',
            finalDamage: primaryApplyResult?.finalDamage ?? finalDamage,
            note: 'combined_save_damage_roll',
            isCrit,
            gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
            gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
            gwfDisplayRolls: gwfDisplayRolls,
        };
        if (secondaryResult) {
            logEntryData.secondaryName = secondaryResult.name;
            logEntryData.secondaryFormula = secondaryResult.formula;
            logEntryData.secondaryRolls = secondaryResult.rolls;
            logEntryData.secondaryTotal = secondaryResult.total;
            logEntryData.secondaryModifier = secondaryResult.modifier;
            logEntryData.secondaryDamageType = secondaryResult.damageType;
            logEntryData.secondaryFinalDamage = secondaryResult.finalDamage;
            logEntryData.secondarySaveResult = secondaryResult.saveResult;
            logEntryData.secondarySaveRoll = secondaryResult.saveRoll;
            logEntryData.secondarySaveBonus = secondaryResult.saveBonus;
            logEntryData.secondarySaveRawRolls = secondaryResult.saveRawRolls;
            logEntryData.secondaryDcSuccess = secondaryResult.dcSuccess;
        }
        logEntry(logEntryData);

        const totalDamageDealt = (primaryApplyResult?.finalDamage ?? 0) + secondaryFinalDamage;
        const newHp = primaryApplyResult?.newHp ?? target.currentHp;
        const oldHp = newHp + totalDamageDealt;
        const isDead = newHp <= 0;
        const maxHp = target.type === 'player'
            ? (getRuntimeValue(target.name, 'hitPoints') ?? newHp)
            : target.maxHp;
        const wasAlive = oldHp > 0;
        const wasBloodied = oldHp > 0 && oldHp <= Math.floor(maxHp / 2);
        const isBloodied = newHp > 0 && newHp <= Math.floor(maxHp / 2);
        let threshold;
        if (!wasAlive && isDead) threshold = 'dead';
        else if (!wasBloodied && isBloodied) threshold = 'bloodied';
        else if (wasBloodied && !isBloodied && newHp > 0) threshold = 'recovering';

        const damageBreakdown = [{
            damageType,
            amount: primaryApplyResult?.finalDamage ?? finalDamage,
            resisted: primaryApplyResult?.resistanceDetails?.some(rd => rd.status === 'resistant') ?? false,
            status: primaryApplyResult?.resistanceDetails?.[0]?.status || null,
        }];
        if (secondaryResult) {
            damageBreakdown.push({
                damageType: secondaryResult.damageType,
                amount: secondaryResult.finalDamage,
                resisted: secondaryResult.resistanceDetails?.some(rd => rd.status === 'resistant') ?? false,
                status: secondaryResult.resistanceDetails?.[0]?.status || null,
            });
        }

        if (totalDamageDealt > 0) {
            const hpEntry = {
                type: 'hp_change',
                targetName: target.name,
                delta: -(totalDamageDealt),
                currentHp: newHp,
                maxHp,
                isHealing: false,
                isUnconscious: isDead,
                damageBreakdown,
            };
            if (threshold) hpEntry.threshold = threshold;
            addEntry(campaignName, hpEntry).catch((e) => { console.error("[useLoggedDiceRollDamage] Error:", e); });
        }

        if (target.type === 'player') {
            setRuntimeValue(target.name, 'currentHitPoints', newHp, campaignName);
            if (oldHp > 0 && isDead) {
                setRuntimeValue(target.name, 'deathSaves', [false, false, false], campaignName);
                setRuntimeValue(target.name, 'deathFailures', [false, false, false], campaignName);
            }
        }

        if (!saveResult.success && context?.statusEffects?.length > 0) {
            for (const effect of context.statusEffects) {
                const condKey = String(effect).toLowerCase();
                const targetStats = targetCharacter?.computedStats || targetCharacter;
                const attackerCreature = combatSummary?.creatures?.find(c => c.name === characterName);
                if (targetStats && playerIsImmuneToCondition({
                    conditionKey: condKey,
                    playerStats: targetStats,
                    getRuntimeValue: getRuntimeValue,
                    campaignName: campaignName,
                    sourceCreatureType: resolveCreatureType(attackerCreature),
                })) {
                    continue;
                }
                const conditions = getRuntimeValue(target.name, 'activeConditions') || [];
                const filtered = conditions.filter(c => String(c).toLowerCase() !== condKey);
                setRuntimeValue(target.name, 'activeConditions', [...filtered, condKey], campaignName);
            }
        }

        const popupData = {
            type: 'save-damage',
            name,
            formula,
            rolls,
            total: adjustedTotal,
            bonus: 0,
            modifier,
            damageType,
            targetName: target.name,
            targetCurrentHp: newHp,
            targetMaxHp,
            saveDc,
            saveType,
            dcSuccess,
            // CLA-321: popup displays the same roll the log records (success forced, damage 0).
            saveResult: isSoulstitchProtected ? { success: true, roll: saveResult.roll, total: saveResult.total, bonus: saveResult.bonus } : saveResult,
            finalDamage: primaryApplyResult?.finalDamage ?? finalDamage,
            damageApplied: (primaryApplyResult?.finalDamage ?? finalDamage) > 0,
            damageReduced: primaryApplyResult?.damageReduced,
            isCrit,
            forcedMode: disadvantage ? 'disadvantage' : (advantage ? 'advantage' : 'normal'),
            gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
            gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
            gwfDisplayRolls: gwfDisplayRolls,
        };
        if (secondaryResult) {
            popupData.secondaryName = secondaryResult.name;
            popupData.secondaryFormula = secondaryResult.formula;
            popupData.secondaryRolls = secondaryResult.rolls;
            popupData.secondaryTotal = secondaryResult.total;
            popupData.secondaryModifier = secondaryResult.modifier;
            popupData.secondaryDamageType = secondaryResult.damageType;
            popupData.secondaryFinalDamage = secondaryResult.finalDamage;
        }

        if (!context?.attackerName || !target?.name) {
            console.error('[useLoggedDiceRollDamage] lastAttack missing required fields:', { attackerName: context?.attackerName, targetName: target?.name, characterName });
        }
        const lastAttackData = {
            attackerName: context?.attackerName || null,
            targetName: target.name,
            d20: saveResult.roll,
            d20Rolls: saveResult.rawRolls || [saveResult.roll],
            bonus: saveResult.bonus,
            total: saveResult.total,
            rollType: 'attack',
            saveType: saveType || null,
            saveDc: saveDc,
            saveResult: isSoulstitchProtected ? 'success' : (saveResult.success ? 'success' : 'failure'),
            damageFormula: formula || null,
            damageName: name || null,
            damageType: damageType || null,
            rawDamage: adjustedTotal || 0,
            primaryDamage: adjustedTotal || 0,
            primaryDamageType: damageType || null,
            actualDamage: primaryApplyResult?.finalDamage ?? finalDamage,
            damageApplied: (primaryApplyResult?.finalDamage ?? finalDamage) > 0,
            statusEffects: context?.statusEffects || null,
            affectedTargets: context?.affectedTargets || [target.name],
            timestamp: Date.now(),
        };
        setRuntimeValue('campaign', 'lastAttack', lastAttackData, campaignName);

        setPopupHtml(popupData);

        handleOverchannelSelfDamage(characterName, campaignName, context, logEntry, characters);

        // CLA-321: Soulstitch protection lasts only for the cast that wrote the stamp.
        if (context?.soulstitchCast) {
            clearSoulstitchStamp(characterName, campaignName);
        }

        if (context?.metamagicTwinTarget) {
            const twinTarget = combatSummary?.creatures?.find(c => c.name === context.metamagicTwinTarget);
            if (twinTarget && twinTarget.name !== target.name) {
                let twinDisadvantage = context?.metamagicHeighten || false;
                if (!twinDisadvantage) {
                    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
                    const idx = targetEffects.findIndex(te => te.target === twinTarget.name && te.effect === 'disadvantage_on_next_save');
                    if (idx !== -1) {
                        twinDisadvantage = true;
                        targetEffects.splice(idx, 1);
                        setRuntimeValue('campaign', 'targetEffects', [...targetEffects], campaignName);
                    }
                }
                if (!twinDisadvantage) {
                    const coronaResult = getCoronaSaveDisadvantage({
                        targetName: twinTarget.name,
                        campaignName,
                        damageType,
                        skipRangeCheck: true,
                    });
                    if (coronaResult.disadvantage) {
                        twinDisadvantage = true;
                    }
                }
                if (!twinDisadvantage) {
                    const elderChampionResult = await getElderChampionSaveDisadvantage({
                        attackerName: characterName,
                        attackerStats: context?.playerStats,
                        targetName: twinTarget.name,
                    });
                    if (elderChampionResult.disadvantage) {
                        twinDisadvantage = true;
                    }
                }
                const twinCharacter = (characters || []).find(c => utils.getName(c.name) === twinTarget.name);
                const twinSaveModifiers = twinCharacter?.saveModifiers || twinCharacter?.computedStats?.saveModifiers || [];
                const twinAdvantage = hasSpellOrigin(twinSaveModifiers, context, campaignName);
                const twinSaveResult = rollSaveForCreature(twinTarget, saveType, saveDc, twinDisadvantage, twinAdvantage);
                let twinFinalDamage = computeDamageAfterSave(adjustedTotal, twinSaveResult.success, dcSuccess);
                if (hasPotentFlag && isCantripFlag && twinSaveResult.success && dcSuccess === 'none') {
                    twinFinalDamage = Math.floor(adjustedTotal / 2);
                }
                const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

                const isCrit = context?.isAutoCrit || false;
                const displayFormula = isCrit ? formatDamageFormula(formula, displayRolls, true) : formula;

                logEntry({
                    type: 'roll',
                    characterName,
                    rollType: 'save-damage',
                    name: `${name} (Twinned)`,
                    formula: displayFormula,
                    rolls: displayRolls,
                    total: adjustedTotal,
                    modifier,
                    damageType,
                    targetName: twinTarget.name,
                    saveType,
                    saveDc,
                    saveResult: twinSaveResult.success ? 'success' : 'failure',
                    saveRoll: twinSaveResult.roll,
                    saveBonus: twinSaveResult.bonus,
                    saveRawRolls: twinSaveResult.rawRolls,
                    forcedMode: twinDisadvantage ? 'disadvantage' : 'normal',
                    finalDamage: null,
                    note: 'twin_save_damage_roll_before_apply',
                    isCrit,
                    gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
                    gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
                    gwfDisplayRolls: displayRolls,
                });

                const twinApplyResult = await applyDamageToTarget(combatSummary, twinTarget.name, twinFinalDamage, [damageType], campaignName, characters, ignoreResistance, characterName);

                if (twinApplyResult && twinApplyResult.finalDamage > 0) {
                    endInvisibilityOnHostileAction(characterName, campaignName);
                }
                setPopupHtml(prev => ({
                    ...prev,
                    twinTargetName: twinTarget.name,
                    twinFinalDamage: twinApplyResult?.finalDamage,
                    twinTargetCurrentHp: twinApplyResult?.newHp,
                    twinTargetMaxHp: twinTarget.type === 'npc'
                        ? twinTarget.maxHp
                        : (getRuntimeValue(twinTarget.name, 'hitPoints') ?? 0),
                }));
            }
        }

        if (context?.multiTarget) {
            const multiTarget = combatSummary?.creatures?.find(c => c.name === context.multiTarget);
            if (multiTarget && multiTarget.name !== target.name) {
                if (saveType && saveDc) {
                    const multiCharacter = (characters || []).find(c => utils.getName(c.name) === multiTarget.name);
                    const multiSaveModifiers = multiCharacter?.saveModifiers || multiCharacter?.computedStats?.saveModifiers || [];
                    const multiAdvantage = hasSpellOrigin(multiSaveModifiers, context, campaignName);
                    let multiDisadvantage = false;
                    const multiTargetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
                    const multiIdx = multiTargetEffects.findIndex(te => te.target === multiTarget.name && te.effect === 'disadvantage_on_next_save');
                    if (multiIdx !== -1) {
                        multiDisadvantage = true;
                        multiTargetEffects.splice(multiIdx, 1);
                        setRuntimeValue('campaign', 'targetEffects', [...multiTargetEffects], campaignName);
                    }
                    const multiSaveResult = rollSaveForCreature(multiTarget, saveType, saveDc, multiDisadvantage, multiAdvantage);
                    let multiFinalDamage = computeDamageAfterSave(adjustedTotal, multiSaveResult.success, dcSuccess);
                    if (hasPotentFlag && isCantripFlag && multiSaveResult.success && dcSuccess === 'none') {
                        multiFinalDamage = Math.floor(adjustedTotal / 2);
                    }
                    const isCrit = context?.isAutoCrit || false;
                    const displayFormula = isCrit ? formatDamageFormula(formula, displayRolls, true) : formula;
                    logEntry({
                        type: 'roll',
                        characterName,
                        rollType: 'save-damage',
                        name: `${name} (Words of Creation)`,
                        formula: displayFormula,
                        rolls: displayRolls,
                        total: adjustedTotal,
                        modifier,
                        damageType,
                        targetName: multiTarget.name,
                        saveType,
                        saveDc,
                        saveResult: multiSaveResult.success ? 'success' : 'failure',
                        saveRoll: multiSaveResult.roll,
                        saveBonus: multiSaveResult.bonus,
                        saveRawRolls: multiSaveResult.rawRolls,
                        mode: 'normal',
                        finalDamage: null,
                        note: 'multi_save_damage_roll_before_apply',
                        isCrit,
                        gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
                        gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
                    });

                    const multiApplyResult = await applyDamageToTarget(combatSummary, multiTarget.name, multiFinalDamage, [damageType], campaignName, null);

                    setPopupHtml(prev => ({
                        ...prev,
                        twinTargetName: multiTarget.name,
                        twinFinalDamage: multiApplyResult?.finalDamage,
                        twinTargetCurrentHp: multiApplyResult?.newHp,
                        twinTargetMaxHp: multiTarget.type === 'npc'
                            ? multiTarget.maxHp
                            : (getRuntimeValue(multiTarget.name, 'hitPoints') ?? 0),
                    }));
                } else {
                    const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

                    const isCrit = context?.isAutoCrit || false;
                    const displayFormula = isCrit ? formatDamageFormula(formula, rolls, true) : formula;
                    logEntry({
                        type: 'roll',
                        characterName,
                        rollType: 'save-damage',
                        name: `${name} (Words of Creation)`,
                        formula: displayFormula,
                        rolls,
                        total,
                        modifier,
                        damageType,
                        targetName: multiTarget.name,
                        finalDamage: null,
                        note: 'multi_plain_damage_roll_before_apply',
                        isCrit,
                    });

                    const multiApplyResult = await applyDamageToTarget(combatSummary, multiTarget.name, total, [damageType], campaignName, null, ignoreResistance, characterName);

                    if (multiApplyResult && multiApplyResult.finalDamage > 0) {
                        endInvisibilityOnHostileAction(characterName, campaignName);
                    }

                    setPopupHtml(prev => ({
                        ...prev,
                        twinTargetName: multiTarget.name,
                        twinFinalDamage: multiApplyResult?.finalDamage,
                        twinTargetCurrentHp: multiApplyResult?.newHp,
                        twinTargetMaxHp: multiTarget.type === 'npc'
                            ? multiTarget.maxHp
                            : (getRuntimeValue(multiTarget.name, 'hitPoints') ?? 0),
                    }));
                }
            }
        }
    };
}
