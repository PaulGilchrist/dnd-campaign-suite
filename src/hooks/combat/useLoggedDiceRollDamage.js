import { rollExpression, rollExpressionDoubled, formatDamageFormula } from '../../services/dice/diceRoller.js';
import { postLogEntry } from '../../services/shared/logPoster.js';
import utils from '../../services/ui/utils.js';
import {
    computeDamageAfterSave,
    rollSaveForCreature,
    applyDamageToTarget,
    clearReTriggeredSequence,
} from '../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { getAffectedCreatures, processAoeNpcs, sendAoePlayerSaves } from '../../services/rules/combat/aoeService.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary, getCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance, playerIsImmuneToCondition, hasGreatWeaponFighting, applyGreatWeaponFightingToDamage, evaluateAutoExpression } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import {
    readAoeContext,
    hasPotentCantrip,
    isMagicMissileImmune,
    hasSoulstitchProtection,
    applyMinDamageAdjustment,
} from './loggedDiceRollUtils.js';
import { getCoronaSaveDisadvantage } from '../../services/combat/auras/coronaAuraUtils.js';

function handleOverchannelSelfDamage(characterName, campaignName, context, logEntry, characters) {
    if (context?.overchannelActive) {
        if (context?.overchannelUseCount > 1) {
            const overchannelSpellLevel = context?.overchannelSpellLevel || 1;
            const dicePerLevel = 2 + (context.overchannelUseCount - 1);
            const totalDice = dicePerLevel * overchannelSpellLevel;
            const necroticFormula = `${totalDice}d12`;
            const necroticResult = rollExpression(necroticFormula);
            if (necroticResult) {
                const casterCombatSummary = getCombatSummary(campaignName);
                const casterApplyResult = applyDamageToTarget(casterCombatSummary, characterName, necroticResult.total, ['Necrotic'], campaignName, characters, true, characterName);
                logEntry({
                    type: 'roll',
                    characterName,
                    rollType: 'overchannel-damage',
                    name: 'Overchannel',
                    formula: necroticFormula,
                    rolls: necroticResult.rolls,
                    total: necroticResult.total,
                    modifier: necroticResult.modifier,
                    damageType: 'Necrotic',
                    targetName: characterName,
                    finalDamage: casterApplyResult?.finalDamage ?? necroticResult.total,
                    note: 'Overchannel self-damage (ignores resistance/immunity)',
                });
            }
        }
    }
}

export function createLogDamageAndShow(deps) {
    const { characterName, campaignName, characters, setPopupHtml, logEntry, pendingSaves } = deps;

    async function applyMagicMissileShieldImmunity(name, formula, total, rolls, modifier, context) {
        const combatSummary = await loadCombatSummary(campaignName);
        const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
        const targetMaxHp = target?.type === 'player'
            ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
            : target?.maxHp ?? 0;
        const isCrit = context?.isAutoCrit || false;
        const displayFormula = isCrit ? formatDamageFormula(formula, rolls, true) : formula;
        logEntry({
            type: 'roll',
            characterName,
            rollType: 'damage',
            name,
            formula: displayFormula,
            rolls,
            total,
            modifier,
            damageType: context?.damageType,
            targetName: context?.targetName,
            finalDamage: 0,
            note: 'Shield: Immune to Magic Missile',
            isCrit,
        });
        setPopupHtml({
            type: 'damage',
            name,
            formula,
            rolls,
            bonus: 0,
            modifier,
            damageType: context?.damageType,
            targetName: context?.targetName,
            total,
            adjustedTotal: 0,
            targetCurrentHp: target?.type === 'player' ? (getRuntimeValue(target.name, 'hitPoints') ?? 0) : (target?.currentHp ?? target?.maxHp),
            targetMaxHp,
            damageApplied: true,
            finalDamage: 0,
            damageReduced: true,
            note: 'Shield: Immune to Magic Missile',
        });
    }

    async function handleAutoMiss(name, formula, total, rolls, modifier, context) {
        const isCantripFlag = context?.isCantrip || false;
        const hasPotentFlag = hasPotentCantrip(context?.playerStats);

        if (hasPotentFlag && isCantripFlag) {
            const damageResult = rollExpression(formula);
            if (damageResult) {
                const adjustedPotentTotal = applyMinDamageAdjustment(damageResult.total, damageResult.rolls, context?.playerStats, context?.damageType);
                const halfDamage = Math.floor(adjustedPotentTotal / 2);
                const combatSummary2 = await loadCombatSummary(campaignName);
                const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, context?.damageType)) || false;
                const applyResult = applyDamageToTarget(combatSummary2, context?.targetName, halfDamage, [context?.damageType], campaignName, characters, ignoreResistance, characterName);
                const target = combatSummary2?.creatures?.find(c => c.name === context?.targetName) || null;
                const targetMaxHp = target?.type === 'player'
                    ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
                    : target?.maxHp ?? 0;
                const isCrit = context?.isAutoCrit || false;
                const displayFormula = isCrit ? formatDamageFormula(formula, damageResult.rolls, true) : formula;
                logEntry({
                    type: 'roll',
                    characterName,
                    rollType: 'cantrip-miss-half-damage',
                    name,
                    formula: displayFormula,
                    rolls: damageResult.rolls,
                    total: halfDamage,
                    modifier: damageResult.modifier,
                    damageType: context?.damageType,
                    targetName: context?.targetName,
                    isPotentCantrip: true,
                    isCrit,
                });
                setPopupHtml({
                    type: 'save-damage',
                    name,
                    formula,
                    rolls: damageResult.rolls,
                    bonus: damageResult.modifier,
                    modifier: damageResult.modifier,
                    damageType: context?.damageType,
                    targetName: context?.targetName,
                    targetCurrentHp: applyResult?.newHp,
                    targetMaxHp: targetMaxHp,
                    saveDc: context?.saveDc,
                    saveType: context?.saveType,
                    dcSuccess: 'half',
                    total: applyResult?.finalDamage,
                    finalDamage: applyResult?.finalDamage,
                    damageApplied: true,
                    damageReduced: applyResult?.damageReduced,
                    isPotentCantrip: true,
                    isCrit,
                });
                return;
            }
        }

        const isCrit = context?.isAutoCrit || false;
        const displayFormula = isCrit ? formatDamageFormula(formula, rolls, true) : formula;
        logEntry({
            type: 'roll',
            characterName,
            rollType: 'auto-miss-damage',
            name,
            formula: displayFormula,
            rolls,
            total,
            modifier,
            damageType: context?.damageType,
            targetName: context?.targetName,
            rangeReason: context?.rangeReason,
            isCrit,
        });
        setPopupHtml({
            type: 'auto-miss',
            name,
            formula,
            rolls,
            bonus: 0,
            modifier,
            damageType: context?.damageType,
            targetName: context?.targetName,
            rangeReason: context?.rangeReason,
        });
    }

    async function handleAoeDamage(name, formula, total, rolls, modifier, context, adjustedTotal, displayRolls, gwfBaseRolls, gwfDisplayRolls) {
        const { saveDc, saveType, dcSuccess, damageType, attackerName } = context || {};
        const overlayId = context?.targetName?.startsWith('overlay-') ? context.targetName.slice('overlay-'.length) : null;
        const aoeCtx = overlayId ? await readAoeContext(campaignName, overlayId) : null;
        const combatSummary = await loadCombatSummary(campaignName);
        if (!aoeCtx || !combatSummary) return;

        const { overlay, players, npcs } = aoeCtx;
        const affected = getAffectedCreatures(overlay, players, npcs, combatSummary);
        const npcResults = saveDc && saveType
            ? processAoeNpcs(combatSummary, affected, adjustedTotal, damageType, saveDc, saveType, dcSuccess, campaignName, attackerName || characterName, characters)
            : affected.map(({ creature }) => {
                const applyResult = applyDamageToTarget(combatSummary, creature.name, adjustedTotal, [damageType], campaignName, characters, false, attackerName || characterName);
                if (applyResult && applyResult.finalDamage > 0) {
                    endInvisibilityOnHostileAction(attackerName || characterName, campaignName);
                }
                return { creatureName: creature.name, finalDamage: applyResult?.finalDamage, newHp: applyResult?.newHp, damageReduced: applyResult?.damageReduced, saveSuccess: null };
            });
        const playerAffected = affected.filter(a => a.creature.type === 'player');
        const casterName = attackerName || characterName;
        const playersNeedingSave = playerAffected.filter(a => !hasSoulstitchProtection(a.creature.name, casterName, campaignName));
        const soulstitchProtectedPlayers = playerAffected.filter(a => hasSoulstitchProtection(a.creature.name, casterName, campaignName));

        for (const pp of soulstitchProtectedPlayers) {
            const creature = pp.creature;
            const applyResult = applyDamageToTarget(combatSummary, creature.name, 0, [damageType], campaignName, characters, false, casterName);
            npcResults.push({
                creatureName: creature.name,
                saveSuccess: true,
                saveRoll: null,
                saveBonus: null,
                finalDamage: 0,
                newHp: applyResult?.newHp,
                damageReduced: true,
                soulstitchProtected: true,
            });
        }

        if (playersNeedingSave.length && saveDc && saveType) {
            const playerPrompts = sendAoePlayerSaves(playersNeedingSave, adjustedTotal, damageType, saveDc, saveType, dcSuccess, campaignName, name, casterName, rolls, formula);
            for (const pp of playerPrompts) {
                pendingSaves[pp.promptId] = {
                    targetName: pp.targetName, rawDamage: adjustedTotal, saveDc, saveType, dcSuccess,
                    damageType, attackerName: attackerName || characterName,
                    name, formula, modifier, rolls, campaignName, setPopupHtml, isAoe: true,
                    isCantrip: context?.isCantrip || false,
                    overchannelActive: context?.overchannelActive || false,
                    overchannelUseCount: context?.overchannelUseCount || 0,
                    overchannelSpellLevel: context?.overchannelSpellLevel || 1,
                    playerStats: context?.playerStats,
                };
            }
        }
        const overlayLabel = overlay.label || overlay.shape || 'AoE';
        const npcResultRows = npcResults.map(r => {
            const soulstitchNote = r.soulstitchProtected ? ' <em>(Soulstitch)</em>' : '';
            const saveInfo = r.saveSuccess === null ? '' : (r.saveSuccess
                ? `<span class="aoe-save-success">SAVE ${r.saveRoll !== null ? r.saveRoll + '+' + r.saveBonus : 'auto'} PASS</span>`
                : `<span class="aoe-save-fail">SAVE ${r.saveRoll}+${r.saveBonus} FAIL</span>`);
            const reduced = r.damageReduced ? ' <em>(reduced)</em>' : '';
            return `<div class="aoe-result-row"><strong>${r.creatureName}</strong>: ${r.finalDamage} dmg${reduced} → ${r.newHp !== undefined ? `HP ${r.newHp}` : ''} ${saveInfo}${soulstitchNote}</div>`;
        }).join('');
        const pendingList = playersNeedingSave.length
            ? `<div class="aoe-pending"><i class="fa-solid fa-spinner fa-spin"></i> Waiting for saves: ${playersNeedingSave.map(a => a.creature.name).join(', ')}</div>`
            : '';
        const displayTotal = adjustedTotal !== total ? `${total} (+${adjustedTotal - total} Elemental Adept)` : String(total);
        const html = `<div class="aoe-summary"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> ${overlayLabel} — ${name}</h3><div class="aoe-damage-info">${formula}: <strong>${displayTotal}</strong> ${damageType || 'untyped'}${saveDc ? ` — ${saveType ? saveType.toUpperCase() : ''} save DC ${saveDc}` : ''}</div><div class="aoe-results">${npcResultRows || '<em>No creatures affected</em>'}</div>${pendingList}</div>`;
        logEntry({
            type: 'aoe-damage',
            characterName,
            rollType: 'aoe-damage',
            name,
            formula, rolls: displayRolls, total: adjustedTotal, modifier, damageType,
            targetName: overlayLabel,
            affectedCount: affected.length,
            npcResults: npcResults.map(r => r.creatureName),
            saveType, saveDc, dcSuccess,
            gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
            gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
            gwfDisplayRolls: gwfDisplayRolls,
        });
        setPopupHtml(html);

        handleOverchannelSelfDamage(characterName, campaignName, context, logEntry, characters);
    }

    async function handleNpcSaveDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls) {
        const { saveDc, saveType, dcSuccess, damageType } = context || {};
        const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
        if (!target) return;
        const targetMaxHp = target?.type === 'player'
            ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
            : target?.maxHp ?? 0;

        let disadvantage = context?.metamagicHeighten || false;
        if (!disadvantage) {
            const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
            const riderEffectIdx = targetEffects.findIndex(te => te.target === target.name && te.effect === 'disadvantage_on_next_save');
            if (riderEffectIdx !== -1) {
                disadvantage = true;
                targetEffects.splice(riderEffectIdx, 1);
                setRuntimeValue(campaignName, 'targetEffects', targetEffects, campaignName);
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
        const isSoulstitchProtected = hasSoulstitchProtection(target.name, characterName, campaignName);
        const targetCharacter = (characters || []).find(c => utils.getName(c.name) === target.name);
        const targetSaveModifiers = targetCharacter?.saveModifiers || targetCharacter?.computedStats?.saveModifiers || [];
        const advantage = targetSaveModifiers.some(mod => mod.target === 'saving_throw' && mod.effect === 'advantage' && mod.condition === 'against_spell');
        const saveResult = rollSaveForCreature(target, saveType, saveDc, disadvantage, advantage);
        let finalDamage = isSoulstitchProtected ? 0 : computeDamageAfterSave(adjustedTotal, saveResult.success, dcSuccess);
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
                    secondarySaveResult = rollSaveForCreature(target, context.saveType, context.saveDc, secondaryDisadvantage, advantage);
                }
                let secondaryRawDamage = isSoulstitchProtected ? 0 : computeDamageAfterSave(secondaryTotal, secondarySaveResult.success, context.dcSuccess);
                if (!isSoulstitchProtected && hasPotentFlag && isCantripFlag && secondarySaveResult.success && context.dcSuccess === 'none') {
                    secondaryRawDamage = Math.floor(secondaryTotal / 2);
                }
                const secondaryIgnoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, secondaryDamageType)) || false;
                const secondaryApplyResult = applyDamageToTarget(combatSummary, target.name, secondaryRawDamage, [secondaryDamageType], campaignName, characters, secondaryIgnoreResistance, characterName, true);
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
                    saveResult: isSoulstitchProtected ? 'soulstitch_auto_success' : (secondarySaveResult.success ? 'success' : 'failure'),
                    saveRoll: secondarySaveResult.roll,
                    saveBonus: secondarySaveResult.bonus,
                    saveRawRolls: secondarySaveResult.rawRolls,
                    dcSuccess: context.dcSuccess,
                };
            }
        }

        const primaryApplyResult = applyDamageToTarget(combatSummary, target.name, finalDamage, [damageType], campaignName, characters, ignoreResistance, characterName, true);

        if (primaryApplyResult && primaryApplyResult.finalDamage > 0) {
            endInvisibilityOnHostileAction(characterName, campaignName);
        }

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
            mode: disadvantage ? 'disadvantage' : 'normal',
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

        await new Promise(resolve => setTimeout(resolve, 500));

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

        const hpEntry = {
            type: 'hp_change',
            targetName: target.name,
            delta: -(totalDamageDealt),
            currentHp: newHp,
            maxHp,
            isHealing: false,
            isUnconscious: isDead,
        };
        if (threshold) hpEntry.threshold = threshold;
        postLogEntry(campaignName, hpEntry);

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
                const targetCharacter = (characters || []).find(c => utils.getName(c.name) === target.name);
                const targetStats = targetCharacter?.computedStats || targetCharacter;
                const attackerCreature = combatSummary?.creatures?.find(c => c.name === characterName);
                if (targetStats && playerIsImmuneToCondition({
                    conditionKey: condKey,
                    playerStats: targetStats,
                    getRuntimeValue: getRuntimeValue,
                    campaignName: campaignName,
                    sourceCreatureType: attackerCreature?.type,
                })) {
                    continue;
                }
                if (target.type === 'player') {
                    const conditions = getRuntimeValue(target.name, 'activeConditions') || [];
                    const filtered = conditions.filter(c => String(c).toLowerCase() !== condKey);
                    setRuntimeValue(target.name, 'activeConditions', [...filtered, condKey], campaignName);
                } else {
                    const conditions = getRuntimeValue(target.name, 'activeConditions') || [];
                    const filtered = conditions.filter(c => String(c).toLowerCase() !== condKey);
                    setRuntimeValue(target.name, 'activeConditions', [...filtered, condKey], campaignName);
                }
            }
        }

        const popupData = {
            type: 'save-damage',
            name,
            formula,
            rolls,
            total: primaryApplyResult?.finalDamage ?? finalDamage,
            bonus: 0,
            modifier,
            damageType,
            targetName: target.name,
            targetCurrentHp: newHp,
            targetMaxHp,
            saveDc,
            saveType,
            dcSuccess,
            saveResult: isSoulstitchProtected ? { success: true, roll: 1, total: 0, bonus: 0 } : saveResult,
            finalDamage: primaryApplyResult?.finalDamage ?? finalDamage,
            damageApplied: true,
            damageReduced: primaryApplyResult?.damageReduced,
            isCrit,
            mode: disadvantage ? 'disadvantage' : (advantage ? 'advantage' : 'normal'),
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

        setPopupHtml(popupData);

        handleOverchannelSelfDamage(characterName, campaignName, context, logEntry, characters);


        if (context?.metamagicTwinTarget) {
            const twinTarget = combatSummary?.creatures?.find(c => c.name === context.metamagicTwinTarget);
            if (twinTarget && twinTarget.name !== target.name) {
                let twinDisadvantage = context?.metamagicHeighten || false;
                if (!twinDisadvantage) {
                    const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
                    const riderEffectIdx = targetEffects.findIndex(te => te.target === twinTarget.name && te.effect === 'disadvantage_on_next_save');
                    if (riderEffectIdx !== -1) {
                        twinDisadvantage = true;
                        targetEffects.splice(riderEffectIdx, 1);
                        setRuntimeValue(campaignName, 'targetEffects', targetEffects, campaignName);
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
                const twinCharacter = (characters || []).find(c => utils.getName(c.name) === twinTarget.name);
                const twinSaveModifiers = twinCharacter?.saveModifiers || twinCharacter?.computedStats?.saveModifiers || [];
                const twinAdvantage = twinSaveModifiers.some(mod => mod.target === 'saving_throw' && mod.effect === 'advantage' && mod.condition === 'against_spell');
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
                    mode: twinDisadvantage ? 'disadvantage' : 'normal',
                    finalDamage: null,
                    note: 'twin_save_damage_roll_before_apply',
                    isCrit,
                    gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
                    gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
                    gwfDisplayRolls: displayRolls,
                });

                await new Promise(resolve => setTimeout(resolve, 500));

                const twinApplyResult = applyDamageToTarget(combatSummary, twinTarget.name, twinFinalDamage, [damageType], campaignName, null, ignoreResistance, characterName);

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
                    const multiAdvantage = multiSaveModifiers.some(mod => mod.target === 'saving_throw' && mod.effect === 'advantage' && mod.condition === 'against_spell');
                    const multiSaveResult = rollSaveForCreature(multiTarget, saveType, saveDc, false, multiAdvantage);
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

                    await new Promise(resolve => setTimeout(resolve, 500));

                    const multiApplyResult = applyDamageToTarget(combatSummary, multiTarget.name, multiFinalDamage, [damageType], campaignName, null);

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

                    await new Promise(resolve => setTimeout(resolve, 500));

                    const multiApplyResult = applyDamageToTarget(combatSummary, multiTarget.name, total, [damageType], campaignName, null, ignoreResistance, characterName);

                    if (multiApplyResult && multiApplyResult.finalDamage > 0) {
                        endInvisibilityOnHostileAction(characterName, campaignName);
                    }
                }
            }
        }
    }

    async function handlePlayerSaveDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls) {
        const { saveDc, saveType, dcSuccess, damageType, attackerName } = context || {};
        const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
        if (!target || target.type !== 'player') return;
        const targetMaxHp = getRuntimeValue(target.name, 'hitPoints') ?? 0;

        const isCarefulAlly = context?.metamagicCareful || false;
        if (isCarefulAlly) {
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

            await new Promise(resolve => setTimeout(resolve, 500));

            const applyResult = applyDamageToTarget(combatSummary, target.name, carefulDamage, [damageType], campaignName, null, ignoreResistance, characterName);

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

            await new Promise(resolve => setTimeout(resolve, 500));

            const applyResult = applyDamageToTarget(combatSummary, target.name, successfulSave, [damageType], campaignName, null, ignoreResistance, characterName);

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
        const saveDisadvantage = (context?.metamagicHeighten || false) || coronaDisadvantage;

        pendingSaves[promptId] = {
            targetName: target.name, rawDamage: adjustedTotal, saveDc, saveType, dcSuccess,
            damageType, attackerName: attackerName || characterName, name, formula, modifier, rolls, campaignName, setPopupHtml,
            metamagicHeighten: saveDisadvantage,
            isCantrip: context?.isCantrip || false,
            overchannelActive: context?.overchannelActive || false,
            overchannelUseCount: context?.overchannelUseCount || 0,
            overchannelSpellLevel: context?.overchannelSpellLevel || 1,
            statusEffects: context?.statusEffects || [],
            playerStats: context?.playerStats,
            autoDamageSecondaryFormula: context?.autoDamageSecondaryFormula || null,
            autoDamageSecondaryName: context?.autoDamageSecondaryName || null,
            autoDamageSecondaryDamageType: context?.autoDamageSecondaryDamageType || null,
        };

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
            mode: context?.metamagicHeighten ? 'disadvantage' : 'normal',
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
        });

        handleOverchannelSelfDamage(characterName, campaignName, context, logEntry, characters);

        return true;
    }

    async function handlePlainDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls) {
        const { damageType, attackerName } = context || {};
        const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
        const targetMaxHp = target?.type === 'player'
            ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
            : target?.maxHp ?? 0;

        let applyResult = null;
        let secondaryResult = null;
        let secondaryFinalDamage = 0;
        let reducedTotal = 0;

        if (target) {
            const lastAttack = combatSummary?.lastAttack || null;
            const attackHit = context?.isOpportunityAttack && lastAttack?.hit === true && lastAttack?.attackerName === characterName;
            if (attackHit) {
                const playerCharacter = (characters || []).find(c => c.name === characterName || c.name.startsWith(characterName + ' '));
                const computed = playerCharacter?.computedStats || playerCharacter;
                const allFeatures = computed?.characterAdvancement || [];
                const hasSentinel = allFeatures.some(f => f.name === 'Sentinel');
                if (hasSentinel) {
                    const sentinelStoredEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                    const newEffect = {
                        target: target.name,
                        source: 'Sentinel',
                        option: 'Halt',
                        effect: 'speed_zero',
                        value: null,
                        duration: 'end_of_turn',
                    };
                    const updatedEffects = [...sentinelStoredEffects, newEffect];
                    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
                }
            }
            let rayReduction = 0;
            const rayTargetEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const rayDebuffActive = rayTargetEffects.some(te => te.effect === 'ray_of_enfeeble_debuff' && te.source === (attackerName || characterName));
            if (rayDebuffActive) {
                const rayRoll = rollExpression('1d8');
                rayReduction = rayRoll?.total || 0;
            }
            reducedTotal = Math.max(0, adjustedTotal - rayReduction);
            const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

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
                    let secondaryRawDamage = secondaryTotal;
                    const secondaryIgnoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, secondaryDamageType)) || false;
                    const damageSequenceId = `seq_${Date.now()}_${Math.random()}`;
                    const multiAttackOptions = { damageSequenceId };
                    const secondaryApplyResult = applyDamageToTarget(combatSummary, target.name, secondaryRawDamage, [secondaryDamageType], campaignName, characters, secondaryIgnoreResistance, characterName, true, multiAttackOptions);
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
                    };

                    const primaryApplyResult = applyDamageToTarget(combatSummary, target.name, reducedTotal, [damageType], campaignName, characters, ignoreResistance, characterName, true, multiAttackOptions);
                    applyResult = rayReduction > 0 ? { ...primaryApplyResult, rayOfEnfeebleReduction: rayReduction } : primaryApplyResult;
                    clearReTriggeredSequence(damageSequenceId);
                }
            } else {
                const primaryApplyResult = applyDamageToTarget(combatSummary, target.name, reducedTotal, [damageType], campaignName, characters, ignoreResistance, characterName, true);
                applyResult = rayReduction > 0 ? { ...primaryApplyResult, rayOfEnfeebleReduction: rayReduction } : primaryApplyResult;
            }
        }

        if (applyResult && applyResult.finalDamage > 0) {
            endInvisibilityOnHostileAction(characterName, campaignName);
        }

        const totalDamageDealt = (applyResult?.finalDamage ?? 0) + secondaryFinalDamage;
        const newHp = applyResult?.newHp ?? (target ? (target.type === 'player' ? getRuntimeValue(target.name, 'currentHitPoints') ?? target.currentHp : target.currentHp) : 0);
        const oldHp = newHp + totalDamageDealt;
        const isDead = newHp <= 0;
        const maxHp = target?.type === 'player'
            ? (getRuntimeValue(target.name, 'hitPoints') ?? newHp)
            : target?.maxHp;
        const wasAlive = oldHp > 0;
        const wasBloodied = oldHp > 0 && oldHp <= Math.floor(maxHp / 2);
        const isBloodied = newHp > 0 && newHp <= Math.floor(maxHp / 2);
        let threshold;
        if (!wasAlive && isDead) threshold = 'dead';
        else if (!wasBloodied && isBloodied) threshold = 'bloodied';
        else if (wasBloodied && !isBloodied && newHp > 0) threshold = 'recovering';

        const isCrit = context?.isAutoCrit || false;
        const displayFormula = isCrit ? formatDamageFormula(formula, rolls, true) : formula;

        const logEntryData = {
            type: 'roll',
            characterName,
            rollType: 'damage',
            name,
            formula: displayFormula,
            rolls: displayRolls,
            total: adjustedTotal,
            modifier,
            damageType,
            targetName: target?.name,
            finalDamage: applyResult?.finalDamage ?? reducedTotal,
            note: 'combined_damage_roll',
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
        }
        logEntry(logEntryData);

        await new Promise(resolve => setTimeout(resolve, 500));

        const hpEntry = {
            type: 'hp_change',
            targetName: target?.name,
            delta: -(totalDamageDealt),
            currentHp: newHp,
            maxHp,
            isHealing: false,
            isUnconscious: isDead,
        };
        if (threshold) hpEntry.threshold = threshold;
        postLogEntry(campaignName, hpEntry);

        if (target?.type === 'player') {
            setRuntimeValue(target.name, 'currentHitPoints', newHp, campaignName);
            if (oldHp > 0 && isDead) {
                setRuntimeValue(target.name, 'deathSaves', [false, false, false], campaignName);
                setRuntimeValue(target.name, 'deathFailures', [false, false, false], campaignName);
            }
        }

        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
        const deathStrikeEffect = storedEffects.find(te => te.effect === 'death_strike' && te.target === target?.name);
        console.log('[DeathStrike damage] characterName:', characterName, 'target:', target?.name, 'targetEffects:', JSON.stringify(storedEffects.map(e => ({effect: e.effect, target: e.target}))), 'deathStrikeEffect found:', !!deathStrikeEffect);
        if (deathStrikeEffect && target) {
            const dsSaveDc = deathStrikeEffect.saveDc;
            const dsSaveType = deathStrikeEffect.saveType;
            if (dsSaveDc && dsSaveType) {
                const dsCharacter = (characters || []).find(c => utils.getName(c.name) === target.name);
                const dsSaveModifiers = dsCharacter?.saveModifiers || dsCharacter?.computedStats?.saveModifiers || [];
                const dsAdvantage = dsSaveModifiers.some(mod => mod.target === 'saving_throw' && mod.effect === 'advantage' && mod.condition === 'against_spell');
                const dsSaveResult = rollSaveForCreature(target, dsSaveType, dsSaveDc, false, dsAdvantage);
                if (!dsSaveResult.success) {
                    const doubledTotal = adjustedTotal * 2;
                    const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

                    logEntry({
                        type: 'roll',
                        characterName,
                        rollType: 'save-damage',
                        name: 'Death Strike',
                        formula: `2× ${formula}`,
                        rolls,
                        total: doubledTotal,
                        modifier,
                        damageType,
                        targetName: target.name,
                        saveType: dsSaveType,
                        saveDc: dsSaveDc,
                        saveResult: 'failure',
                        saveRoll: dsSaveResult.roll,
                        saveBonus: dsSaveResult.bonus,
                        saveRawRolls: dsSaveResult.rawRolls,
                        finalDamage: null,
                        note: 'death_strike_damage_roll_before_apply',
                    });

                    await new Promise(resolve => setTimeout(resolve, 500));

                    const dsApplyResult = applyDamageToTarget(combatSummary, target.name, doubledTotal, [damageType], campaignName, null, ignoreResistance || false, characterName);

                    if (!applyResult) {
                        applyResult = dsApplyResult;
                    }
                    setPopupHtml(prev => ({
                        ...prev,
                        deathStrikeDoubled: true,
                        deathStrikeSaveRoll: dsSaveResult.roll,
                        deathStrikeSaveBonus: dsSaveResult.bonus,
                        deathStrikeSaveDc: dsSaveDc,
                        deathStrikeFinalDamage: dsApplyResult?.finalDamage,
                    }));
                }
            }
            const cleanedEffects = storedEffects.filter(te => te.effect !== 'death_strike' || te.target !== target.name);
            setRuntimeValue(campaignName, 'targetEffects', cleanedEffects, campaignName);
        }

        if (target?.type === 'player' && applyResult && applyResult.finalDamage > 0) {
            const attackerNameResolved = attackerName || characterName;
            const defensiveChoice = getRuntimeValue(target.name, '_Defensive_Tactics_choice', campaignName);
            if (defensiveChoice === 'Multiattack Defense') {
                const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const newEffect = {
                    target: target.name,
                    source: 'Defensive Tactics',
                    option: 'Multiattack Defense',
                    effect: 'multiattack_defense',
                    attacker: attackerNameResolved,
                    duration: 'until_end_of_current_turn',
                };
                const updatedEffects = [...storedEffects, newEffect];
                setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
            }
        }

        if (context?.ramActive && context?.isMelee && target && applyResult) {
            const isLargeOrSmaller = !target.size || ['Tiny', 'Small', 'Medium', 'Large'].includes(target.size);
            if (isLargeOrSmaller) {
                if (target.type === 'player') {
                    const conditions = getRuntimeValue(target.name, 'activeConditions', campaignName) || [];
                    if (Array.isArray(conditions) && !conditions.some(c => String(c).toLowerCase() === 'prone')) {
                        setRuntimeValue(target.name, 'activeConditions', [...conditions, 'Prone'], campaignName);
                    }
                } else {
                    const conditions = getRuntimeValue(target.name, 'activeConditions') || [];
                    if (!conditions.some(c => String(c).toLowerCase() === 'prone')) {
                        setRuntimeValue(target.name, 'activeConditions', [...conditions, 'Prone'], campaignName);
                    }
                }
                logEntry({
                    type: 'condition',
                    action: 'applied',
                    characterName: target.name,
                    condition: 'Prone',
                    reason: 'Power of the Wilds (Ram)',
                    timestamp: Date.now(),
                });
                window.dispatchEvent(new CustomEvent('combat-summary-updated'));
            }
        }

        handleOverchannelSelfDamage(characterName, campaignName, context, logEntry, characters);

        const popupData = {
            type: 'damage',
            name,
            formula,
            rolls,
            bonus: 0,
            modifier,
            dc: context?.dc,
            dcType: context?.dcType,
            dcSuccess: context?.dcSuccess,
            damageType,
            targetName: target?.name,
            total: adjustedTotal,
            adjustedTotal: adjustedTotal,
            elementalAdeptBonus: adjustedTotal > total ? adjustedTotal - total : 0,
            isCrit,
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

        if (applyResult) {
            popupData.targetCurrentHp = applyResult.newHp;
            popupData.targetMaxHp = targetMaxHp;
            popupData.damageApplied = true;
            popupData.finalDamage = applyResult.finalDamage;
            popupData.damageReduced = applyResult.damageReduced;
        }

        setPopupHtml(popupData);

        if (context?.metamagicTwinTarget && target) {
            const twinTarget = combatSummary?.creatures?.find(c => c.name === context.metamagicTwinTarget);
            if (twinTarget && twinTarget.name !== target.name) {
                logEntry({
                    type: 'roll',
                    characterName,
                    rollType: 'damage',
                    name: `${name} (Twinned)`,
                    formula,
                    rolls: displayRolls,
                    total: adjustedTotal,
                    modifier,
                    damageType,
                    targetName: twinTarget.name,
                    finalDamage: null,
                    note: 'twin_damage_roll_before_apply',
                    gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
                    gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
                    gwfDisplayRolls: gwfDisplayRolls,
                });

                await new Promise(resolve => setTimeout(resolve, 500));

                const twinApplyResult = applyDamageToTarget(combatSummary, twinTarget.name, adjustedTotal, [damageType], campaignName, null, false, characterName);

                if (twinApplyResult && twinApplyResult.finalDamage > 0) {
                    endInvisibilityOnHostileAction(characterName, campaignName);
                }
                setPopupHtml(prev => ({
                    ...prev,
                    twinTargetName: twinTarget.name,
                    twinFinalDamage: twinApplyResult?.finalDamage,
                    twinTargetCurrentHp: twinApplyResult?.newHp,
                    twinTargetMaxHp: twinTarget.type === 'player'
                        ? (getRuntimeValue(twinTarget.name, 'hitPoints') ?? 0)
                        : twinTarget.maxHp,
                }));
            }
        }

        if (context?.multiTarget && target) {
            const multiTarget = combatSummary?.creatures?.find(c => c.name === context.multiTarget);
            if (multiTarget && multiTarget.name !== target.name) {
                logEntry({
                    type: 'roll',
                    characterName,
                    rollType: 'damage',
                    name: `${name} (Words of Creation)`,
                    formula,
                    rolls: displayRolls,
                    total: adjustedTotal,
                    modifier,
                    damageType,
                    targetName: multiTarget.name,
                    finalDamage: null,
                    note: 'multi_damage_roll_before_apply',
                    gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
                    gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
                    gwfDisplayRolls: gwfDisplayRolls,
                });

                await new Promise(resolve => setTimeout(resolve, 500));

                const multiApplyResult = applyDamageToTarget(combatSummary, multiTarget.name, adjustedTotal, [damageType], campaignName, null, false, characterName);

                setPopupHtml(prev => ({
                    ...prev,
                    twinTargetName: multiTarget.name,
                    twinFinalDamage: multiApplyResult?.finalDamage,
                    twinTargetCurrentHp: multiApplyResult?.newHp,
                    twinTargetMaxHp: multiTarget.type === 'player'
                        ? (getRuntimeValue(multiTarget.name, 'hitPoints') ?? 0)
                        : multiTarget.maxHp,
                }));
            }
        }

    }

    return async function logDamageAndShow(name, formula, total, rolls, modifier, context) {
        // Apply Feinting Attack superiority die damage bonus
        const feintDieValue = getRuntimeValue(characterName, 'feintingAttackDieValue');
        if (feintDieValue && Number(feintDieValue) > 0) {
            const feintVal = Number(feintDieValue);
            const dmgType = context?.damageType || 'same_as_weapon';
            formula += ` + ${feintVal} [${dmgType}]`;
            total += feintVal;
            rolls = [...rolls, feintVal];
            setRuntimeValue(characterName, 'feintingAttackDieValue', null, campaignName);
        }

        // Apply Commander's Strike superiority die damage bonus (from ally)
        const csBonus = getRuntimeValue(characterName, 'commanderStrikeBonus');
        if (csBonus && Number(csBonus) > 0) {
            const csVal = Number(csBonus);
            const dmgType = context?.damageType || 'same_as_weapon';
            formula += ` + ${csVal} [${dmgType}]`;
            total += csVal;
            rolls = [...rolls, csVal];
            setRuntimeValue(characterName, 'commanderStrikeBonus', null, campaignName);
            setRuntimeValue(characterName, 'commanderStrikeActive', null, campaignName);
            setRuntimeValue(characterName, 'commanderStrikeSource', null, campaignName);
        }

        // Apply Lunging Attack superiority die damage bonus (melee hit only)
        const lungingDieValue = getRuntimeValue(characterName, 'lungingAttackDieValue');
        if (lungingDieValue && Number(lungingDieValue) > 0) {
            const lungingVal = Number(lungingDieValue);
            const dmgType = context?.damageType || 'same_as_weapon';
            formula += ` + ${lungingVal} [${dmgType}]`;
            total += lungingVal;
            rolls = [...rolls, lungingVal];
            setRuntimeValue(characterName, 'lungingAttackDieValue', null, campaignName);
        }

        const { saveDc, saveType, damageType, isAutoMiss } = context || {};
        const isCrit = context?.isAutoCrit || false;
        const gwfBaseRolls = isCrit && context?.doubledRolls ? context.doubledRolls.slice(0, context.doubledRolls.length / 2) : rolls;
        const rollsForMin = isCrit && context?.doubledRolls ? context.doubledRolls : rolls;
        let adjustedTotal = applyMinDamageAdjustment(total, rollsForMin, context?.playerStats, damageType);
        let displayRolls = isCrit && context?.doubledRolls ? context.doubledRolls : rolls;
        let gwfDisplayRolls = gwfBaseRolls;
        if (hasGreatWeaponFighting(context?.playerStats)) {
            const gwfRolls = applyGreatWeaponFightingToDamage(gwfBaseRolls, context?.playerStats);
            const hasChanges = gwfRolls.some((r, i) => r !== gwfBaseRolls[i]);
            if (hasChanges) {
                const gwfTotal = (isCrit ? gwfRolls.reduce((sum, r) => sum + r, 0) * 2 : gwfRolls.reduce((sum, r) => sum + r, 0)) + modifier;
                adjustedTotal = applyMinDamageAdjustment(gwfTotal, gwfRolls, context?.playerStats, damageType);
                displayRolls = isCrit ? gwfRolls.concat(gwfRolls) : gwfRolls;
                gwfDisplayRolls = gwfRolls;
            }
        }

        if (isMagicMissileImmune(characterName, campaignName) && name && name.toLowerCase() === 'magic missile') {
            await applyMagicMissileShieldImmunity(name, formula, total, rolls, modifier, context);
            return;
        }

        const combatSummary = await loadCombatSummary(campaignName);

        if (isAutoMiss) {
            await handleAutoMiss(name, formula, total, rolls, modifier, context);
            return;
        }

        const targetTargetName = context?.targetName;
        if (targetTargetName && targetTargetName.startsWith('overlay-')) {
            await handleAoeDamage(name, formula, total, rolls, modifier, context, adjustedTotal, displayRolls, gwfBaseRolls, gwfDisplayRolls);
            return;
        }

        const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;

        if (saveDc && saveType && target) {
            if (target.type === 'npc') {
                await handleNpcSaveDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls);
                return;
            }

            if (target.type === 'player') {
                const handled = await handlePlayerSaveDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls);
                if (handled) return;
            }
        }

        await handlePlainDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls);
    };
}
