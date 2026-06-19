import { rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import {
  computeDamageAfterSave,
  rollSaveForCreature,
  applyDamageToTarget,
} from '../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { getAffectedCreatures, processAoeNpcs, sendAoePlayerSaves } from '../../services/rules/combat/aoeService.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary, getCombatSummary } from '../../services/encounters/combatData.js';
import { saveLastDamageEvent } from './useMetamagic.js';
import { hasIgnoreResistance, playerIsImmuneToCondition } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import {
    readAoeContext,
    hasPotentCantrip,
    isMagicMissileImmune,
    hasSoulstitchProtection,
    applyMinDamageAdjustment,
} from './useLoggedDiceRollUtils.js';

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
    const { characterName, campaignName, characters, setPopupHtml, logEntry, pendingSaves, pendingSecondaryDamageRef } = deps;

    async function applyMagicMissileShieldImmunity(name, formula, total, rolls, modifier, context) {
        const combatSummary = await loadCombatSummary(campaignName);
        const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
        const targetMaxHp = target?.type === 'player'
            ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
            : target?.maxHp ?? 0;
        logEntry({
            type: 'roll',
            characterName,
            rollType: 'damage',
            name,
            formula,
            rolls,
            total,
            modifier,
            damageType: context?.damageType,
            targetName: context?.targetName,
            finalDamage: 0,
            note: 'Shield: Immune to Magic Missile',
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
        logEntry({
            type: 'roll',
            characterName,
            rollType: 'auto-miss-damage',
            name,
            formula,
            rolls,
            total,
            modifier,
            damageType: context?.damageType,
            targetName: context?.targetName,
            rangeReason: context?.rangeReason,
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

    async function handleAoeDamage(name, formula, total, rolls, modifier, context, adjustedTotal) {
        const { saveDc, saveType, dcSuccess, damageType, attackerName } = context || {};
        const aoeCtx = readAoeContext(campaignName);
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
            const applyResult = applyDamageToTarget(combatSummary, creature.name, 0, [damageType], campaignName, null, false, casterName);
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
            formula, rolls, total, modifier, damageType,
            targetName: overlayLabel,
            affectedCount: affected.length,
            npcResults: npcResults.map(r => r.creatureName),
            saveType, saveDc, dcSuccess,
        });
        setPopupHtml(html);

        handleOverchannelSelfDamage(characterName, campaignName, context, logEntry, characters);
    }

    async function handleNpcSaveDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary) {
        const { saveDc, saveType, dcSuccess, damageType } = context || {};
        const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
        if (!target) return;
        const targetMaxHp = target?.type === 'player'
            ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
            : target?.maxHp ?? 0;

        const disadvantage = context?.metamagicHeighten || false;
        const isSoulstitchProtected = hasSoulstitchProtection(target.name, characterName, campaignName);
        const saveResult = rollSaveForCreature(target, saveType, saveDc, disadvantage);
        let finalDamage = isSoulstitchProtected ? 0 : computeDamageAfterSave(adjustedTotal, saveResult.success, dcSuccess);
        const isCantripFlag = context?.isCantrip || false;
        const hasPotentFlag = hasPotentCantrip(context?.playerStats);
        if (!isSoulstitchProtected && hasPotentFlag && isCantripFlag && saveResult.success && dcSuccess === 'none') {
            finalDamage = Math.floor(adjustedTotal / 2);
        }
        const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;
        logEntry({
            type: 'roll',
            characterName,
            rollType: 'save-damage',
            name,
            formula,
            rolls,
            total,
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
            finalDamage: null,
            note: 'save_damage_roll_before_apply',
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        const applyResult = applyDamageToTarget(combatSummary, target.name, finalDamage, [damageType], campaignName, null, ignoreResistance, characterName);

        if (applyResult && applyResult.finalDamage > 0) {
            endInvisibilityOnHostileAction(characterName, campaignName);
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
                    target.conditions = (target.conditions || []).filter(c => c.key !== condKey);
                    target.conditions.push({
                        id: utils.guid(),
                        key: condKey,
                        label: effect.charAt(0).toUpperCase() + effect.slice(1),
                        dc: saveDc,
                        ability: saveType.toLowerCase(),
                        endsOnDamage: true,
                    });
                }
            }
        }

        setPopupHtml({
            type: 'save-damage',
            name,
            formula,
            rolls,
            bonus: 0,
            modifier,
            damageType,
            targetName: target.name,
            targetCurrentHp: applyResult?.newHp,
            targetMaxHp,
            saveDc,
            saveType,
            dcSuccess,
            saveResult: isSoulstitchProtected ? { success: true, roll: 1, total: 0, bonus: 0 } : saveResult,
            finalDamage: applyResult?.finalDamage,
            damageApplied: true,
            damageReduced: applyResult?.damageReduced,
        });

        if (context?.autoDamageSecondaryFormula) {
            pendingSecondaryDamageRef.current = {
                name: context.autoDamageSecondaryName || name,
                formula: context.autoDamageSecondaryFormula,
                damageType: context.autoDamageSecondaryDamageType,
                targetName: target.name,
                attackerName: context.attackerName || characterName,
                saveDc: context.saveDc,
                saveType: context.saveType,
                dcSuccess: context.dcSuccess,
                isCritSecondary: context?.isAutoCrit || false,
            };
        }

        handleOverchannelSelfDamage(characterName, campaignName, context, logEntry, characters);

        if (context?.metamagicHeighten || context?.metamagicCareful || context?.metamagicTwinTarget) {
            saveLastDamageEvent(characterName, {
                targetName: target.name,
                spellName: name,
                damageFormula: formula,
                rawDamage: adjustedTotal,
                damageType,
                saveDc,
                saveType,
                saveResult: saveResult.success ? 'success' : 'failure',
                context,
                rolls,
                modifier,
                timestamp: Date.now(),
            }, campaignName);
        }

        if (context?.metamagicTwinTarget) {
            const twinTarget = combatSummary?.creatures?.find(c => c.name === context.metamagicTwinTarget);
            if (twinTarget && twinTarget.name !== target.name) {
                const twinDisadvantage = context?.metamagicHeighten || false;
                const twinSaveResult = rollSaveForCreature(twinTarget, saveType, saveDc, twinDisadvantage);
                let twinFinalDamage = computeDamageAfterSave(total, twinSaveResult.success, dcSuccess);
                if (hasPotentFlag && isCantripFlag && twinSaveResult.success && dcSuccess === 'none') {
                    twinFinalDamage = Math.floor(total / 2);
                }
                const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

                logEntry({
                    type: 'roll',
                    characterName,
                    rollType: 'save-damage',
                    name: `${name} (Twinned)`,
                    formula,
                    rolls,
                    total,
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
                    const multiSaveResult = rollSaveForCreature(multiTarget, saveType, saveDc, false);
                    let multiFinalDamage = computeDamageAfterSave(total, multiSaveResult.success, dcSuccess);
                    if (hasPotentFlag && isCantripFlag && multiSaveResult.success && dcSuccess === 'none') {
                        multiFinalDamage = Math.floor(total / 2);
                    }
                    logEntry({
                        type: 'roll',
                        characterName,
                        rollType: 'save-damage',
                        name: `${name} (Words of Creation)`,
                        formula,
                        rolls,
                        total,
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

                    logEntry({
                        type: 'roll',
                        characterName,
                        rollType: 'save-damage',
                        name: `${name} (Words of Creation)`,
                        formula,
                        rolls,
                        total,
                        modifier,
                        damageType,
                        targetName: multiTarget.name,
                        finalDamage: null,
                        note: 'multi_plain_damage_roll_before_apply',
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

    async function handlePlayerSaveDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary) {
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
                rolls,
                total,
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
            });

            await new Promise(resolve => setTimeout(resolve, 500));

            const applyResult = applyDamageToTarget(combatSummary, target.name, carefulDamage, [damageType], campaignName, null, ignoreResistance, characterName);

            if (applyResult && applyResult.finalDamage > 0) {
                endInvisibilityOnHostileAction(characterName, campaignName);
            }
            saveLastDamageEvent(characterName, {
                targetName: target.name,
                spellName: name,
                damageFormula: formula,
                rawDamage: adjustedTotal,
                damageType,
                saveDc,
                saveType,
                saveResult: 'success',
                carefulSpell: true,
                context,
                rolls,
                modifier,
                timestamp: Date.now(),
            }, campaignName);
            setPopupHtml({
                type: 'save-damage',
                name,
                formula,
                rolls,
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
                rolls,
                total,
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
                rolls,
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
            });
            return true;
        }

        const promptId = utils.guid();
        pendingSaves[promptId] = {
            targetName: target.name, rawDamage: adjustedTotal, saveDc, saveType, dcSuccess,
            damageType, attackerName: attackerName || characterName, name, formula, modifier, rolls, campaignName, setPopupHtml,
            metamagicHeighten: context?.metamagicHeighten || false,
            isCantrip: context?.isCantrip || false,
            overchannelActive: context?.overchannelActive || false,
            overchannelUseCount: context?.overchannelUseCount || 0,
            overchannelSpellLevel: context?.overchannelSpellLevel || 1,
            statusEffects: context?.statusEffects || [],
            playerStats: context?.playerStats,
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
            disadvantage: context?.metamagicHeighten || false,
        });

        logEntry({
            type: 'roll',
            characterName,
            rollType: 'save-prompt',
            name,
            formula,
            rolls,
            total,
            modifier,
            bonus: modifier,
            damageType,
            targetName: target.name,
            saveType,
            saveDc,
            dcSuccess,
            mode: context?.metamagicHeighten ? 'disadvantage' : 'normal',
        });

        setPopupHtml({
            type: 'save-damage',
            name,
            formula,
            rolls,
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
        });

        handleOverchannelSelfDamage(characterName, campaignName, context, logEntry, characters);

        return true;
    }

    async function handlePlainDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary) {
        const { damageType, attackerName } = context || {};
        const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
        const targetMaxHp = target?.type === 'player'
            ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
            : target?.maxHp ?? 0;

        let applyResult = null;
        if (target) {
            const lastAttack = getRuntimeValue(characterName, 'lastAttackRoll', campaignName);
            const attackHit = context?.isOpportunityAttack && lastAttack?.hit === true;
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
            const reducedTotal = Math.max(0, adjustedTotal - rayReduction);
            const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

            logEntry({
                type: 'roll',
                characterName,
                rollType: 'damage',
                name,
                formula,
                rolls,
                total,
                modifier,
                damageType,
                targetName: target?.name,
                finalDamage: null,
                note: 'plain_damage_roll_before_apply',
            });

            await new Promise(resolve => setTimeout(resolve, 500));

            applyResult = applyDamageToTarget(combatSummary, target.name, reducedTotal, [damageType], campaignName, characters, ignoreResistance, characterName);
            if (rayReduction > 0) {
                applyResult = { ...applyResult, rayOfEnfeebleReduction: rayReduction };
            }
        }

        if (applyResult && applyResult.finalDamage > 0) {
            endInvisibilityOnHostileAction(characterName, campaignName);
        }

        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
        const deathStrikeEffect = storedEffects.find(te => te.effect === 'death_strike' && te.target === target?.name);
        if (deathStrikeEffect && target) {
            const dsSaveDc = deathStrikeEffect.saveDc;
            const dsSaveType = deathStrikeEffect.saveType;
            if (dsSaveDc && dsSaveType) {
                const dsSaveResult = rollSaveForCreature(target, dsSaveType, dsSaveDc, false);
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
                    target.conditions = target.conditions || [];
                    if (!target.conditions.some(c => String(c.key).toLowerCase() === 'prone')) {
                        target.conditions.push({ key: 'prone' });
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
            total,
            adjustedTotal: adjustedTotal,
            elementalAdeptBonus: adjustedTotal > total ? adjustedTotal - total : 0,
        };

        if (context?.autoDamageSecondaryFormula) {
            pendingSecondaryDamageRef.current = {
                name: context.autoDamageSecondaryName || name,
                formula: context.autoDamageSecondaryFormula,
                damageType: context.autoDamageSecondaryDamageType,
                targetName: target?.name,
                attackerName: context.attackerName || characterName,
                saveDc: context.saveDc,
                saveType: context.saveType,
                dcSuccess: context.dcSuccess,
                isCritSecondary: context?.isAutoCrit || false,
            };
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
                    rolls,
                    total,
                    modifier,
                    damageType,
                    targetName: twinTarget.name,
                    finalDamage: null,
                    note: 'twin_damage_roll_before_apply',
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
                    rolls,
                    total,
                    modifier,
                    damageType,
                    targetName: multiTarget.name,
                    finalDamage: null,
                    note: 'multi_damage_roll_before_apply',
                });

                await new Promise(resolve => setTimeout(resolve, 500));

                const multiApplyResult = applyDamageToTarget(combatSummary, multiTarget.name, total, [damageType], campaignName, null, false, characterName);

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

        saveLastDamageEvent(characterName, {
            targetName: target?.name,
            spellName: name,
            damageFormula: formula,
            rawDamage: total,
            damageType,
            twinTarget: context?.metamagicTwinTarget || null,
            context,
            rolls,
            modifier,
            timestamp: Date.now(),
        }, campaignName);
    }

    return async function logDamageAndShow(name, formula, total, rolls, modifier, context) {
        const { saveDc, saveType, damageType, isAutoMiss } = context || {};
        const adjustedTotal = applyMinDamageAdjustment(total, rolls, context?.playerStats, damageType);

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
            await handleAoeDamage(name, formula, total, rolls, modifier, context, adjustedTotal);
            return;
        }

        const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;

        if (saveDc && saveType && target) {
            if (target.type === 'npc') {
                await handleNpcSaveDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary);
                return;
            }

            if (target.type === 'player') {
                const handled = await handlePlayerSaveDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary);
                if (handled) return;
            }
        }

        await handlePlainDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary);
    };
}
