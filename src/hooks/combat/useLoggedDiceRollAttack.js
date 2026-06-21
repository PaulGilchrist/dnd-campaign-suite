import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import storage from '../../services/ui/storage.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import {
  applyDamageToTarget,
} from '../../services/rules/combat/applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { clearAllExpirationEffects } from '../../services/rules/effects/expirations.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import {
    isUnbreakableMajestyActive,
    getUnbreakableMajestySaveDc,
    hasAttackerTriggeredMajesty,
    markAttackerTriggeredMajesty,
} from '../../services/combat/auras/unbreakableMajesty.js';
import { hasEmpoweredEvocation, getEmpoweredEvocationIntModifier } from '../../services/rules/spells/postCastRiderService.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import {
    dispatchUnbreakableMajestySave,
    hasPotentCantrip,
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    applyMinDamageAdjustment,
} from './useLoggedDiceRollUtils.js';

export function createLogAndShow(deps) {
    const { characterName, campaignName, characters, setPopupHtml, logEntry } = deps;

    return async function logAndShow(name, bonus, rollType, context) {
        const r1 = rollD20();
        const r2 = rollD20();

        const effectiveD20 = (context?.d20Floor10 && r1 <= 9) ? 10 : r1;

        const combatSummary = await loadCombatSummary(campaignName);

        const target = combatSummary ? getTargetFromAttacker(combatSummary, utils.getName(characterName)) : null;

        let isAutoMiss = context?.isAutoMiss === true;

        const coverAcBonus = context?.coverAcBonus || 0;

        let targetAc;
        if (target?.type === 'player') {
            const playerChar = (characters || []).find(c => c.name === target.name);
            const playerComputed = playerChar?.computedStats || playerChar;
            targetAc = playerComputed?.armorClass;
        } else {
            targetAc = target?.ac;
        }

        if (target && typeof targetAc !== 'number') {
            throw new Error(`[AC] Target "${target.name}" has no AC defined.`);
        }

        const effectiveAc = target ? targetAc + coverAcBonus + (context?.gloriousDefenseBonus || 0) + (context?.defensiveDuelistBonus || 0) + getShieldAcBonus(target.name, campaignName) + getShieldOfFaithAcBonus(target.name, campaignName) : undefined;
        let hit = isAutoMiss ? false : (target ? (effectiveD20 + bonus >= effectiveAc) : undefined);
        const targetName = target?.name || context?.targetName;
        const attackerName = context?.attackerName || characterName;

        if (!hit && !isAutoMiss && rollType === 'attack' && context?.isWeaponAttack) {
            const livingLegendActive = getRuntimeValue(characterName, 'livingLegendActive', campaignName);
            if (livingLegendActive) {
                const unerringStrikeUsed = getRuntimeValue(characterName, 'unerringStrikeUsed', campaignName);
                if (!unerringStrikeUsed) {
                    hit = true;
                    isAutoMiss = false;
                    await setRuntimeValue(characterName, 'unerringStrikeUsed', true, campaignName);
                }
            }
        }

        if (hit && target) {
            const majActive = isUnbreakableMajestyActive(target.name, campaignName);
            if (majActive && !hasAttackerTriggeredMajesty(target.name, attackerName, campaignName)) {
                const majSaveDc = getUnbreakableMajestySaveDc(target.name, campaignName);
                const promptId = `majesty-${utils.guid()}`;
                markAttackerTriggeredMajesty(target.name, attackerName, campaignName);
                dispatchUnbreakableMajestySave(campaignName, target.name, attackerName, majSaveDc, promptId);
                logEntry({
                    type: 'ability_use',
                    characterName: target.name,
                    abilityName: 'Unbreakable Majesty',
                    description: `${target.name}'s Unbreakable Majesty — ${attackerName} must make a CHA save (DC ${majSaveDc}) or the attack misses.`,
                });
                let saveResolved = false;
                await new Promise((resolve) => {
                    const handler = (event) => {
                        if (event.detail.promptId !== promptId) return;
                        window.removeEventListener('save-result', handler);
                        saveResolved = true;
                        if (!event.detail.success) {
                            hit = false;
                            isAutoMiss = true;
                            logEntry({
                                type: 'ability_use',
                                characterName: target.name,
                                abilityName: 'Unbreakable Majesty',
                                description: `${attackerName} failed the CHA save — attack misses due to Unbreakable Majesty!`,
                            });
                        } else {
                            logEntry({
                                type: 'ability_use',
                                characterName: target.name,
                                abilityName: 'Unbreakable Majesty',
                                description: `${attackerName} succeeded on the CHA save — attack hits.`,
                            });
                        }
                        resolve();
                    };
                    window.addEventListener('save-result', handler);
                    setTimeout(() => {
                        if (!saveResolved) {
                            window.removeEventListener('save-result', handler);
                            resolve();
                        }
                    }, 30000);
                });
            }
        }

        if (hit && target && rollType === 'attack') {
            const riderName = getRuntimeValue(target.name, 'mountedBy', campaignName);
            if (riderName) {
                const veerActive = getRuntimeValue(riderName, 'veerActive', campaignName);
                if (veerActive) {
                    const mountCreature = combatSummary?.creatures?.find(c => c.name === target.name);
                    const mountNotIncapacitated = mountCreature ? !mountCreature.conditions?.some(c => {
                        const cStr = typeof c === 'object' ? String(c.key || '') : String(c);
                        return ['incapacitated'].includes(cStr.toLowerCase());
                    }) : true;
                    const riderNotIncapacitated = !getRuntimeValue(riderName, 'activeConditions', campaignName)?.some(c => {
                        const cStr = typeof c === 'object' ? String(c.key || '') : String(c);
                        return ['incapacitated'].includes(cStr.toLowerCase());
                    });
                    if (mountNotIncapacitated && riderNotIncapacitated) {
                        logEntry({
                            type: 'ability_use',
                            characterName: riderName,
                            abilityName: 'Veer',
                            description: `${riderName} uses Veer to redirect the attack from ${target.name} to themselves.`,
                        });
                        await setRuntimeValue(riderName, 'veerActive', null, campaignName);
                        hit = false;
                        isAutoMiss = true;
                        let veerResultResolved = false;
                        const redirectResult = await new Promise((resolve) => {
                            const handler = (event) => {
                                if (event.detail.promptId !== `veer-${target.name}`) return;
                                window.removeEventListener('veer-confirm', handler);
                                veerResultResolved = true;
                                resolve(event.detail.confirm);
                            };
                            window.addEventListener('veer-confirm', handler);
                            setTimeout(() => {
                                if (!veerResultResolved) {
                                    window.removeEventListener('veer-confirm', handler);
                                    resolve(true);
                                }
                            }, 15000);
                        });
                        if (redirectResult) {
                            hit = true;
                            isAutoMiss = false;
                            logEntry({
                                type: 'ability_use',
                                characterName: riderName,
                                abilityName: 'Veer',
                                description: `${riderName} redirects the attack — it now hits ${riderName} instead of ${target.name}.`,
                            });
                        } else {
                            logEntry({
                                type: 'ability_use',
                                characterName: riderName,
                                abilityName: 'Veer',
                                description: `${riderName} declined to use Veer. Attack hits ${target.name}.`,
                            });
                        }
                    }
                }
            }
        }

        const criticalRange = context?.criticalRange;
        let rollsInCriticalRange = false;
        if (criticalRange) {
            const match = criticalRange.match(/^(\d+)-(\d+)$/);
            if (match) {
                const low = parseInt(match[1], 10);
                const high = parseInt(match[2], 10);
                rollsInCriticalRange = effectiveD20 >= low && effectiveD20 <= high;
            }
        }
        const isCrit = !isAutoMiss && (r1 === 20 || context?.isAutoCrit || rollsInCriticalRange) && hit;

        const autoDamage = hit && context?.autoDamageFormula ? {
            name: context.autoDamageName || name,
            formula: context.autoDamageFormula,
            autoDamageSchool: context.autoDamageSchool,
            damageType: context.damageType,
            targetName: targetName,
            attackerName: context.attackerName || characterName,
            saveDc: context.saveDc,
            saveType: context.saveType,
            dcSuccess: context.dcSuccess,
            metamagicTwinTarget: context.metamagicTwinTarget,
            metamagicHeighten: context.metamagicHeighten,
            isCantrip: context.isCantrip,
            overchannelActive: context.overchannelActive,
            overchannelUseCount: context.overchannelUseCount,
            overchannelSpellLevel: context.overchannelSpellLevel,
            secondaryFormula: context.autoDamageSecondaryFormula,
            secondaryDamageType: context.autoDamageSecondaryDamageType,
        } : undefined;

        logEntry({
            type: 'roll',
            characterName,
            rollType,
            name,
            rolls: [r1, r2],
            mode: 'normal',
            total: r1,
            bonus,
            isNatural20: r1 === 20,
            isNatural1: r1 === 1,
            targetName,
            targetAc,
            damageType: context?.damageType,
            hit,
            isAutoMiss,
            rangeReason: context?.rangeReason,
            resistanceNotice: context?.resistanceNotice,
            hunterLoreNotice: context?.hunterLoreNotice,
            coverLevel: context?.coverLevel,
            coverAcBonus: context?.coverAcBonus,
            coverReason: context?.coverReason,
        });
        setPopupHtml({
            type: 'd20',
            rollType,
            name,
            rolls: [r1, r2],
            bonus,
            targetName,
            targetAc,
            hit,
            isAutoMiss,
            rangeReason: context?.rangeReason,
            resistanceNotice: context?.resistanceNotice,
            hunterLoreNotice: context?.hunterLoreNotice,
            coverLevel: context?.coverLevel,
            coverAcBonus: context?.coverAcBonus,
            coverReason: context?.coverReason,
            forcedMode: context?.forcedMode,
            isAutoCrit: context?.isAutoCrit,
            isCrit,
            isNatural20: r1 === 20,
            isNatural1: r1 === 1,
            autoDamage,
            autoReroll: context?.autoReroll,
            autoRerollBonus: context?.autoRerollBonus,
            strSaveReplace: context?.strSaveReplace,
            strScore: context?.strScore,
            strCheckReplace: context?.strCheckReplace,
            reliableTalent: context?.reliableTalent,
            wisCheckReplace: context?.wisCheckReplace,
            wisCheckMinBonus: context?.wisCheckMinBonus,
            gloriousDefenseBonus: context?.gloriousDefenseBonus || 0,
            defensiveDuelistBonus: context?.defensiveDuelistBonus || 0,
            d20Floor10: context?.d20Floor10,
        });

        if (rollType === 'attack') {
            setRuntimeValue(characterName, 'lastAttackRoll', {
                d20: effectiveD20,
                bonus,
                targetName,
                targetAc,
                hit,
                isCrit,
                effectiveAc,
                coverAcBonus,
                timestamp: Date.now(),
            }, campaignName);

            setRuntimeValue(characterName, '_lastRollContext', {
                type: 'attack',
                attackName: name,
                damageFormula: context?.autoDamageFormula || null,
                damageType: context?.damageType || null,
                targetName,
                oldTotal: effectiveD20 + bonus,
                oldHit: hit,
                timestamp: Date.now(),
            }, campaignName);

            const ps = context?.playerStats;
            const isSoulknife = ps?.class?.name === 'Rogue' && ps?.class?.major?.name === 'Soulknife';
            const hasSoulBlades = isSoulknife && ps?.level >= 9;
            const isPsychicBlade = context?.isPsychicBlade === true;
            if (hasSoulBlades && isPsychicBlade && hit === false && !isAutoMiss) {
                const classLevel = ps?.class?.class_levels?.find(cl => cl.level === ps?.level);
                const psionicDieSize = classLevel?.energy?.energy_die || 6;
                const psionicBonus = Math.floor(Math.random() * psionicDieSize) + 1;
                const newTotal = effectiveD20 + bonus + psionicBonus;
                const newHit = targetAc ? (newTotal >= targetAc) : null;
                if (newHit === true) {
                    setRuntimeValue(characterName, 'lastAttackRoll', {
                        d20: effectiveD20,
                        bonus: bonus + psionicBonus,
                        targetName,
                        targetAc,
                        hit: true,
                        isCrit: false,
                        effectiveAc,
                        coverAcBonus,
                        timestamp: Date.now(),
                        homingStrikesBonus: psionicBonus,
                    }, campaignName);
                }
            }

            if (context?.grazeDamage && !hit && !isAutoMiss && targetName) {
                const grazeAbilityMod = context?.grazeAbilityMod || 0;
                const grazeDamageAmount = Math.max(0, grazeAbilityMod);
                const grazeDamageType = context?.damageType || 'same_as_weapon';
                const grazeFormula = grazeDamageAmount > 0 ? `${grazeDamageAmount}[Graze]` : '0[Graze]';
                if (grazeDamageAmount > 0) {
                    const combatSummary2 = await loadCombatSummary(campaignName);
                    const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, grazeDamageType)) || false;
                    const applyResult = applyDamageToTarget(combatSummary2, targetName, grazeDamageAmount, [grazeDamageType], campaignName, characters, ignoreResistance, characterName);
                    const grazeTargetMaxHp = target?.type === 'player'
                        ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
                        : target?.maxHp ?? 0;
                    logEntry({
                        type: 'roll',
                        characterName,
                        rollType: 'graze-damage',
                        name,
                        formula: grazeFormula,
                        rolls: [grazeDamageAmount],
                        total: grazeDamageAmount,
                        modifier: 0,
                        damageType: grazeDamageType,
                        targetName: targetName,
                        finalDamage: applyResult?.finalDamage,
                        note: 'Graze: ability modifier damage on miss',
                    });
                    setPopupHtml({
                        type: 'graze-damage',
                        name: `${name} (Graze)`,
                        formula: grazeFormula,
                        rolls: [grazeDamageAmount],
                        bonus: 0,
                        modifier: 0,
                        damageType: grazeDamageType,
                        targetName: targetName,
                        total: grazeDamageAmount,
                        targetCurrentHp: applyResult?.newHp,
                        targetMaxHp: grazeTargetMaxHp,
                        damageApplied: true,
                        finalDamage: applyResult?.finalDamage,
                        damageReduced: applyResult?.damageReduced,
                    });
                }
                const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const filteredEffects = storedEffects.filter(te => !(te.effect === 'graze' && te.target === targetName));
                setRuntimeValue(campaignName, 'targetEffects', filteredEffects, campaignName);
            }

            if (targetName) {
                const allEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const vexEffects = allEffects.filter(te => te.effect === 'next_attack_advantage' && te.target === characterName);
                if (vexEffects.length > 0) {
                    const clearedEffects = allEffects.filter(te => !(te.effect === 'next_attack_advantage' && te.target === characterName));
                    setRuntimeValue(campaignName, 'targetEffects', clearedEffects, campaignName);
                }
            }
        }

        const potentPlayerStats = context?.playerStats;
        const hasPotentCantripFlag = hasPotentCantrip(potentPlayerStats);
        if (hasPotentCantripFlag && !hit && context?.autoDamageFormula) {
            const potentFormula = context.autoDamageFormula;
            const storedDamageResult = context?.autoDamageRollResult;
            if (!isAutoMiss) {
                const hasEmpoweredEvoc = hasEmpoweredEvocation(potentPlayerStats);
                const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(potentPlayerStats) : 0;
                const spellSchool = (context?.autoDamageSchool || '').toLowerCase();
                const isEvocation = spellSchool === 'evocation';
                const shouldApplyEmpoweredEvoc = hasEmpoweredEvoc && isEvocation && empEvocIntMod > 0;
                let finalFormula = potentFormula;
                if (shouldApplyEmpoweredEvoc) {
                    finalFormula = `${potentFormula} + ${empEvocIntMod} [Empowered Evocation]`;
                }
                let damageResult;
                if (storedDamageResult) {
                    const adjustedStoredTotal = applyMinDamageAdjustment(storedDamageResult.total, storedDamageResult.rolls, context?.playerStats, context?.damageType);
                    const halfDamage = Math.floor(adjustedStoredTotal / 2);
                    const combatSummary2 = await loadCombatSummary(campaignName);
                    const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, context?.damageType)) || false;
                    const applyResult = applyDamageToTarget(combatSummary2, targetName, halfDamage, [context?.damageType], campaignName, characters, ignoreResistance, context.attackerName || characterName);
                    console.log('[PotentCantrip] stored rawTotal=', storedDamageResult.total, 'adjustedPotentTotal=', adjustedStoredTotal, 'halfDamage=', halfDamage, 'finalDamage=', applyResult?.finalDamage, 'damageReduced=', applyResult?.damageReduced, 'damageReducedByFeature=', applyResult?.damageReducedByFeature, 'wardAbsorbed=', applyResult?.wardAbsorbed);
                    const missTargetMaxHp = target?.type === 'player'
                        ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
                        : target?.maxHp ?? 0;
                    logEntry({
                        type: 'roll',
                        characterName,
                        rollType: 'cantrip-miss-half-damage',
                        name,
                        formula: finalFormula,
                        rolls: storedDamageResult.rolls,
                        total: halfDamage,
                        modifier: storedDamageResult.modifier,
                        damageType: context?.damageType,
                        targetName: targetName,
                        isPotentCantrip: true,
                    });
                    setPopupHtml({
                        type: 'save-damage',
                        name,
                        formula: finalFormula,
                        rolls: storedDamageResult.rolls,
                        bonus: storedDamageResult.modifier,
                        modifier: storedDamageResult.modifier,
                        damageType: context?.damageType,
                        targetName: targetName,
                        targetCurrentHp: applyResult?.newHp,
                        targetMaxHp: missTargetMaxHp,
                        saveDc: context?.saveDc,
                        saveType: context?.saveType,
                        dcSuccess: 'half',
                        finalDamage: applyResult?.finalDamage,
                        damageApplied: true,
                        damageReduced: applyResult?.damageReduced,
                        isPotentCantrip: true,
                    });
                }
                else {
                    damageResult = rollExpression(finalFormula);
                    if (damageResult) {
                        const rawTotal = damageResult.total;
                        const adjustedPotentTotal = applyMinDamageAdjustment(rawTotal, damageResult.rolls, context?.playerStats, context?.damageType);
                        const halfDamage = Math.floor(adjustedPotentTotal / 2);
                        const combatSummary2 = await loadCombatSummary(campaignName);
                        const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, context?.damageType)) || false;
                        const applyResult = applyDamageToTarget(combatSummary2, targetName, halfDamage, [context?.damageType], campaignName, characters, ignoreResistance, context.attackerName || characterName);
                        const missTargetMaxHp = target?.type === 'player'
                            ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
                            : target?.maxHp ?? 0;
                        logEntry({
                            type: 'roll',
                            characterName,
                            rollType: 'cantrip-miss-half-damage',
                            name,
                            formula: finalFormula,
                            rolls: damageResult.rolls,
                            total: halfDamage,
                            modifier: damageResult.modifier,
                            damageType: context?.damageType,
                            targetName: targetName,
                            isPotentCantrip: true,
                        });
                        setPopupHtml({
                            type: 'save-damage',
                            name,
                            formula: finalFormula,
                            rolls: damageResult.rolls,
                            bonus: damageResult.modifier,
                            modifier: damageResult.modifier,
                            damageType: context?.damageType,
                            targetName: targetName,
                            targetCurrentHp: applyResult?.newHp,
                            targetMaxHp: missTargetMaxHp,
                            saveDc: context?.saveDc,
                            saveType: context?.saveType,
                            dcSuccess: 'half',
                            finalDamage: applyResult?.finalDamage,
                            damageApplied: true,
                            damageReduced: applyResult?.damageReduced,
                            isPotentCantrip: true,
                        });
                    }
                    else {
                        console.log('[PotentCantrip] rollExpression returned null for formula=', finalFormula);
                    }
                }
            }
            else if (isAutoMiss && context?.saveDc) {
                const hasEmpoweredEvoc = hasEmpoweredEvocation(potentPlayerStats);
                const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(potentPlayerStats) : 0;
                const spellSchool = (context?.autoDamageSchool || '').toLowerCase();
                const isEvocation = spellSchool === 'evocation';
                const shouldApplyEmpoweredEvoc = hasEmpoweredEvoc && isEvocation && empEvocIntMod > 0;
                let finalFormula = potentFormula;
                if (shouldApplyEmpoweredEvoc) {
                    finalFormula = `${potentFormula} + ${empEvocIntMod} [Empowered Evocation]`;
                }
                const damageResult = rollExpression(finalFormula);
                if (damageResult) {
                    const adjustedPotentTotal = applyMinDamageAdjustment(damageResult.total, damageResult.rolls, context?.playerStats, context?.damageType);
                    const halfDamage = Math.floor(adjustedPotentTotal / 2);
                    const combatSummary2 = await loadCombatSummary(campaignName);
                    const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, context?.damageType)) || false;
                    const applyResult = applyDamageToTarget(combatSummary2, targetName, halfDamage, [context?.damageType], campaignName, characters, ignoreResistance, context.attackerName || characterName);
                    const missTargetMaxHp = target?.type === 'player'
                        ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
                        : target?.maxHp ?? 0;
                    logEntry({
                        type: 'roll',
                        characterName,
                        rollType: 'cantrip-miss-half-damage',
                        name,
                        formula: finalFormula,
                        rolls: damageResult.rolls,
                        total: halfDamage,
                        modifier: damageResult.modifier,
                        damageType: context?.damageType,
                        targetName: targetName,
                        isPotentCantrip: true,
                    });
                    setPopupHtml({
                        type: 'save-damage',
                        name,
                        formula: finalFormula,
                        rolls: damageResult.rolls,
                        bonus: damageResult.modifier,
                        modifier: damageResult.modifier,
                        damageType: context?.damageType,
                        targetName: targetName,
                        targetCurrentHp: applyResult?.newHp,
                        targetMaxHp: missTargetMaxHp,
                        saveDc: context?.saveDc,
                        saveType: context?.saveType,
                        dcSuccess: 'half',
                        finalDamage: applyResult?.finalDamage,
                        damageApplied: true,
                        damageReduced: applyResult?.damageReduced,
                        isPotentCantrip: true,
                    });
                }
                else {
                    console.log('[PotentCantrip] rollExpression returned null for auto-miss formula=', finalFormula);
                }
            }
            else {
                console.log('[PotentCantrip] isAutoMiss but no saveDc, skipping');
            }
        }
        else {
            console.log('[PotentCantrip] condition not met');
        }

        if (rollType === 'check' || rollType === 'skill') {
            const effectiveD20 = context?.reliableTalent && r1 <= 9 ? 10 : r1;
            setRuntimeValue(characterName, 'lastAbilityCheck', {
                d20: effectiveD20,
                bonus,
                checkName: name,
                targetName,
                timestamp: Date.now(),
            }, campaignName);

            setRuntimeValue(characterName, '_lastRollContext', {
                type: 'check',
                checkName: name,
                oldTotal: effectiveD20 + bonus,
                timestamp: Date.now(),
            }, campaignName);
        }

        if (rollType === 'save') {
            setRuntimeValue(characterName, 'lastSaveRoll', {
                d20: effectiveD20,
                bonus,
                saveType: context?.saveType || null,
                targetName,
                timestamp: Date.now(),
            }, campaignName);

            setRuntimeValue(characterName, '_lastRollContext', {
                type: 'save',
                saveType: context?.saveType || null,
                saveDc: context?.saveDc || null,
                actionName: context?.actionName || name,
                targetName,
                oldTotal: effectiveD20 + bonus,
                oldSuccess: context?.saveDc != null ? (effectiveD20 + bonus >= context.saveDc) : null,
                timestamp: Date.now(),
            }, campaignName);

            const saveDc = context?.saveDc;
            const saveType = context?.saveType;
            const attackerName = context?.attackerName || characterName;
            const actionName = context?.actionName || name;
            if (saveDc != null) {
                const saveTotal = effectiveD20 + bonus;
                const saveSuccess = saveTotal >= saveDc;
                logEntry({
                    type: 'roll',
                    characterName: targetName || characterName,
                    rollType: 'save',
                    name: actionName,
                    rolls: [effectiveD20],
                    mode: 'normal',
                    total: saveTotal,
                    bonus,
                    isNatural20: effectiveD20 === 20,
                    isNatural1: effectiveD20 === 1,
                    targetName: targetName,
                    saveType: saveType,
                    saveDc: saveDc,
                    saveResult: saveSuccess ? 'success' : 'failure',
                    attackerName: attackerName,
                    dcSuccess: context?.dcSuccess,
                    timestamp: Date.now(),
                    id: utils.guid(),
                });
            }
        }

        if (rollType === 'initiative') {
            const firstName = utils.getName(characterName);
            const tandemFtBonus = Number(getRuntimeValue(firstName, 'tandemFootworkBonus', campaignName) ?? 0);
            if (tandemFtBonus > 0) {
                setRuntimeValue(firstName, 'tandemFootworkBonus', 0, campaignName);
            }
            const totalBonus = bonus + tandemFtBonus;
            const combatSummary = await loadCombatSummary(campaignName);
            if (combatSummary) {
                const creature = combatSummary.creatures.find(
                    c => c.type === 'player' && c.name === firstName
                );
                if (creature) {
                    creature.initiative = String(r1 + totalBonus);
                    combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
                    storage.set('combatSummary', combatSummary, campaignName);
                }
            }
            clearAllExpirationEffects(characterName, campaignName);
            setRuntimeValue(characterName, 'uncannyMetabolismUsed', false, campaignName);
            window.dispatchEvent(new CustomEvent('initiative-rolled', { detail: { characterName: firstName, roll: r1 + totalBonus } }));
        }
    };
}
