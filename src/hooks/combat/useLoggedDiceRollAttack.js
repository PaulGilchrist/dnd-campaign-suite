import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import storage from '../../services/ui/storage.js';
import { getTargetFromAttacker, findCreatureByName, getCombatContext } from '../../services/rules/combat/damageUtils.js';
import {
    applyDamageToTarget,
    computeDamageAfterEvasion,
    normalizeSaveType,
} from '../../services/rules/combat/applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { clearAllExpirationEffects } from '../../services/rules/effects/expirations.js';
import { loadCombatSummary, getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { clearHuntersMarkConcentration } from '../../services/rules/effects/restRules.js';
import {
    isUnbreakableMajestyActive,
    getUnbreakableMajestySaveDc,
    hasAttackerTriggeredMajesty,
    markAttackerTriggeredMajesty,
} from '../../services/combat/auras/unbreakableMajesty.js';
import { hasBardicInspirationDefense, hasBardicInspirationOffense, getBardicInspirationDieSize, getBardicInspirationDieSizeFromClass } from '../../services/combat/auras/bardicInspirationState.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../services/rules/spells/postCastRiderService.js';
import { hasIgnoreResistance, playerIsImmuneToCondition } from '../../services/combat/automation/automationService.js';
import { addEntry } from '../../services/ui/logService.js';
import {
    dispatchUnbreakableMajestySave,
    hasPotentCantrip,
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    applyMinDamageAdjustment,
} from './loggedDiceRollUtils.js';
import { loadManeuvers } from '../../services/ui/dataLoader.js';
import { getManeuversForRules } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { createSaveListener } from '../../services/automation/common/savePrompt.js';

const SELECTION_KEY = 'BattleMasterManeuvers_selection';

function getKnownManeuvers(characterName, campaignName) {
    const stored = getRuntimeValue(characterName, SELECTION_KEY, campaignName);
    return Array.isArray(stored) ? stored : [];
}

function getSuperiorityDice(characterName, campaignName) {
    const usesKey = 'superiorityDice';
    const defaultMax = 4;
    return Number(getRuntimeValue(characterName, usesKey, campaignName) ?? defaultMax);
}

export function createLogAndShow(deps) {
    const { characterName, campaignName, characters, setPopupHtml, logEntry, autoDamageSourceRef } = deps;

    return async function logAndShow(name, bonus, rollType, context) {
        const r1 = rollD20();
        const r2 = rollD20();

        const effectiveD20 = (context?.d20Floor10 && r1 <= 9) ? 10 : r1;

        const forcedMode = context?.forcedMode || 'normal';
        let effectiveD20Roll;
        if (forcedMode === 'advantage') {
            effectiveD20Roll = Math.max(r1, r2);
        } else if (forcedMode === 'disadvantage') {
            effectiveD20Roll = Math.min(r1, r2);
        } else {
            effectiveD20Roll = effectiveD20;
        }

        // Halfling Lucky: automatic reroll on natural 1
        let luckyRerolled = false;
        let luckyRerollValue = null;
        const isLuckyReroll = context?.autoReroll && context?.autoRerollCondition === 'roll_equals_1' && effectiveD20Roll === 1;
        if (isLuckyReroll) {
            luckyRerollValue = rollD20();
            effectiveD20Roll = luckyRerollValue;
            luckyRerolled = true;
        }

        // Cosmic Omen: apply global pending bonus to next d20 roll
        let cosmicOmenAppliedBonus = 0;
        const cosmicOmenPendingRaw = getRuntimeValue(campaignName, 'cosmicOmenPendingBonus', campaignName);
        if (cosmicOmenPendingRaw) {
            try {
                const pending = JSON.parse(cosmicOmenPendingRaw);
                if (pending && typeof pending.value === 'number' && pending.value > 0) {
                    const isWeal = pending.type === 'Weal';
                    effectiveD20Roll += isWeal ? pending.value : -pending.value;
                    cosmicOmenAppliedBonus = isWeal ? pending.value : -pending.value;
                    setRuntimeValue(campaignName, 'cosmicOmenPendingBonus', null, campaignName, true);
                }
            } catch (_e) { /* ignore */ }
        }

        const combatSummary = await loadCombatSummary(campaignName);

        // Pre-load maneuver cache for skill check / initiative superiority buttons
        if (rollType === 'check' || rollType === 'skill' || rollType === 'initiative') {
            await getManeuversForRules('2024');
        }

        const explicitTargetName = context?.targetName;

        // Compute available superiority maneuvers for skill/initiative checks
        let availableSuperiorityManeuvers = null;
        if (rollType === 'check' || rollType === 'skill' || rollType === 'initiative') {
            const knownNames = getKnownManeuvers(characterName, campaignName);
            const superiorityDice = getSuperiorityDice(characterName, campaignName);
            if (knownNames.length > 0 && superiorityDice > 0) {
                const allManeuvers = await loadManeuvers('2024');
                const isInitiative = rollType === 'initiative';
                const skillName = isInitiative ? 'Initiative' : name;
                availableSuperiorityManeuvers = allManeuvers.filter(m => {
                    if (!knownNames.includes(m.name)) return false;
                    if (m.actionType !== 'skill_check') return false;
                    if (m.initiativeBonus && isInitiative) return true;
                    if (m.skills && m.skills.length > 0) {
                        const skillLower = skillName?.toLowerCase() || '';
                        return m.skills.some(s => s.toLowerCase().includes(skillLower) || skillLower.includes(s.toLowerCase()));
                    }
                    return false;
                }).map(m => ({
                    name: m.name,
                    dieExpression: m.dieExpression || 'superiority_die',
                    skills: m.skills || [],
                    isInitiative: !!m.initiativeBonus,
                }));
            }
        }
        let target;
        if (explicitTargetName) {
            const explicitTarget = findCreatureByName(combatSummary, explicitTargetName);
            if (explicitTarget) {
                target = explicitTarget;
            } else {
                target = combatSummary ? getTargetFromAttacker(combatSummary, utils.getName(characterName)) : null;
            }
        } else {
            target = combatSummary ? getTargetFromAttacker(combatSummary, utils.getName(characterName)) : null;
        }

        let isAutoMiss = context?.isAutoMiss === true;

        const coverAcBonus = context?.coverAcBonus || 0;

        let targetAc;
        if (rollType === 'attack') {
            if (target?.type === 'player') {
                const playerChar = (characters || []).find(c => c.name === target.name);
                const playerComputed = playerChar?.computedStats || playerChar;
                targetAc = playerComputed?.armorClass ?? playerChar?.armorClass;
            } else {
                targetAc = target?.ac;
            }

            if (target && typeof targetAc !== 'number') {
                throw new Error(`[AC] Target "${target.name}" has no AC defined.`);
            }
        }

        const effectiveAc = target ? targetAc + coverAcBonus + (context?.gloriousDefenseBonus || 0) + (context?.defensiveDuelistBonus || 0) + (context?.baitAndSwitchBonus || 0) + getShieldAcBonus(target.name, campaignName) + getShieldOfFaithAcBonus(target.name, campaignName) : undefined;
        let hit = isAutoMiss ? false : (target ? (effectiveD20Roll + bonus >= effectiveAc) : undefined);
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

        // Combat Inspiration - Defense
        if (hit && target) {
            const targetName = target.name;
            const targetPlayerStats = (characters || []).find(c => c.name === targetName);
            const computedTarget = targetPlayerStats?.computedStats;
            const hasDefense = hasBardicInspirationDefense(targetName, campaignName, computedTarget);
            const dieSize = getBardicInspirationDieSize(targetName, campaignName) || getBardicInspirationDieSizeFromClass(computedTarget);
            const biUsesRaw = getRuntimeValue(targetName, 'bardicInspirationUses', campaignName);
            const biUsesNum = (typeof biUsesRaw === 'object' && biUsesRaw !== null) ? biUsesRaw.current : (biUsesRaw != null ? Number(biUsesRaw) : (computedTarget?._trackedResources?.bardicInspirationUses?.current ?? 0));
            context.bardicInspirationDefense = hasDefense && dieSize && biUsesNum > 0;
            context.bardicInspirationDefenseDieSize = dieSize;
            context.bardicInspirationDefenseTargetName = targetName;
            context.bardicInspirationDefenseAttackRoll = hit ? effectiveD20Roll : null;
            context.bardicInspirationDefenseBonus = hit ? bonus : null;
            context.bardicInspirationDefenseEffectiveAc = hit ? effectiveAc : null;
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

        // Soul Blades (Soulknife level 9) — Homing Strikes: reroll miss with psionic energy die
        const ps = context?.playerStats;
        const isSoulknife = ps?.class?.name === 'Rogue' && ps?.class?.major?.name === 'Soulknife';
        const hasSoulBlades = isSoulknife && ps?.level >= 9;
        const isPsychicBlade = context?.isPsychicBlade === true;
        let homingStrikesUsed = false;
        let homingStrikesBonus = 0;
        if (hasSoulBlades && isPsychicBlade && hit === false && !isAutoMiss) {
            const classLevel = ps?.class?.class_levels?.find(cl => cl.level === ps?.level);
            const psionicDieSize = classLevel?.energy?.energy_die || 6;
            const psionicBonus = Math.floor(Math.random() * psionicDieSize) + 1;
            const newTotal = effectiveD20 + bonus + psionicBonus;
            const newHit = targetAc ? (newTotal >= targetAc) : null;
            if (newHit === true) {
                const defaultMax = ps?._trackedResources?.psionicEnergy?.max || 0;
                const currentEnergy = Number(getRuntimeValue(characterName, 'psionicEnergy', campaignName) ?? defaultMax);
                if (currentEnergy > 0) {
                    setRuntimeValue(characterName, 'psionicEnergy', currentEnergy - 1, campaignName);
                    hit = true;
                    homingStrikesUsed = true;
                    homingStrikesBonus = psionicBonus;
                    addEntry(campaignName, {
                        type: 'ability_use',
                        characterName,
                        abilityName: 'Soul Blades',
                        description: `${characterName} used Soul Blades (Homing Strikes) to turn a miss into a hit, consuming 1 Psionic Energy. Psionic Energy: ${currentEnergy - 1}/${defaultMax}.`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[homingStrikes] Log error:', e); });
                }
            } else if (newHit !== null) {
                addEntry(campaignName, {
                    type: 'ability_use',
                    characterName,
                    abilityName: 'Soul Blades',
                    description: `${characterName} tried Soul Blades (Homing Strikes) but even with the psionic die roll of ${psionicBonus}, the attack still missed (total: ${newTotal} vs AC: ${targetAc}).`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error('[homingStrikes] Log error:', e); });
            }
        } else if (isPsychicBlade && hit === false && !isAutoMiss) {
            addEntry(campaignName, {
                type: 'ability_use',
                characterName,
                abilityName: 'Soul Blades',
                description: `Soul Blades (Homing Strikes) check: isSoulknife=${isSoulknife}, hasSoulBlades=${hasSoulBlades}, isPsychicBlade=${isPsychicBlade}, hit=${hit}. ps.class=${ps?.class?.name}, ps.major=${ps?.class?.major?.name}, level=${ps?.level}.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[homingStrikes] Log error:', e); });
        }

        const criticalRange = context?.criticalRange;
        let rollsInCriticalRange = false;
        if (criticalRange) {
            const match = criticalRange.match(/^(\d+)-(\d+)$/);
            if (match) {
                const low = parseInt(match[1], 10);
                const high = parseInt(match[2], 10);
                rollsInCriticalRange = effectiveD20Roll >= low && effectiveD20Roll <= high;
            }
        }
        const isCrit = !isAutoMiss && (effectiveD20Roll === 20 || context?.isAutoCrit || rollsInCriticalRange) && (hit || rollsInCriticalRange);

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
            ripostePopup: context.ripostePopup,
            source: autoDamageSourceRef?.current || characterName,
            isAutoCrit: isCrit,
            sneakAttackDice: context?.sneakAttackDice || 0,
        } : undefined;

        // Apply Death Strike attack_rider (Rogue Assassin level 17) — forces CON save, doubles damage on fail
        if (hit && context?.sneakAttackDice && context?.sneakAttackDice > 0) {
            const cs2 = await getCombatContext(campaignName);
            const currentRound2 = getCurrentCombatRound(campaignName);
            if (cs2 && currentRound2 === 1) {
                const playerCreature2 = cs2.creatures?.find(c => c.name === characterName);
                if (!playerCreature2 || !playerCreature2.hasActed) {
                    const targetName2 = targetName || getTargetFromAttacker(cs2, characterName)?.name;
                    if (targetName2) {
                        const ps = context?.playerStats;
                        const prof = ps?.proficiency || 0;
                        const dexAbility = ps?.abilities?.find(a => a.name === 'Dexterity');
                        const dexMod = dexAbility?.bonus || 0;
                        const saveDc = 8 + dexMod + prof;
                        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                        const deathStrikeEffect = {
                            target: targetName2,
                            source: 'Death Strike',
                            effect: 'death_strike',
                            saveType: 'CON',
                            saveDc: saveDc,
                            saveAbility: 'DEX',
                            damageDoubled: true,
                        };
                        const updatedEffects = [...storedEffects, deathStrikeEffect];
                        setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
                    }
                }
            }
        }

        // Log Lucky reroll to campaign log
        if (luckyRerolled) {
            addEntry(campaignName, {
                type: 'ability_use',
                characterName,
                abilityName: 'Lucky (Halfling)',
                description: `${characterName} used Lucky (Halfling trait): rerolled natural 1 on ${name} ${rollType} → ${luckyRerollValue}`,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[Lucky] Log error:', e); });
        }

        logEntry({
            type: 'roll',
            characterName,
            rollType,
            name,
            rolls: [r1, r2],
            mode: context?.forcedMode || 'normal',
            total: effectiveD20Roll,
            bonus,
            isNatural20: effectiveD20Roll === 20,
            isNatural1: effectiveD20Roll === 1,
            targetName,
            targetAc,
            damageType: context?.damageType,
            hit,
            isAutoMiss,
            isCrit,
            rangeReason: context?.rangeReason,
            resistanceNotice: context?.resistanceNotice,
            hunterLoreNotice: context?.hunterLoreNotice,
            coverLevel: context?.coverLevel,
            coverAcBonus: context?.coverAcBonus,
            coverReason: context?.coverReason,
            advantageReason: context?.advantageReason,
        });

        const shouldSkipPopup = rollType === 'save' && target?.type === 'player';
        if (!shouldSkipPopup) {
            setPopupHtml({
                type: 'd20',
                rollType,
                name,
                rolls: luckyRerolled ? [luckyRerollValue] : [r1, r2],
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
                advantageReason: context?.advantageReason,
                isAutoCrit: context?.isAutoCrit,
                isCrit,
                isNatural20: effectiveD20Roll === 20,
                isNatural1: effectiveD20Roll === 1,
                autoDamage,
                autoReroll: context?.autoReroll,
                autoRerollBonus: context?.autoRerollBonus,
                autoRerollCondition: context?.autoRerollCondition,
                strSaveReplace: context?.strSaveReplace,
                strScore: context?.strScore,
                strCheckReplace: context?.strCheckReplace,
                reliableTalent: context?.reliableTalent,
                wisCheckReplace: context?.wisCheckReplace,
                wisCheckMinBonus: context?.wisCheckMinBonus,
                gloriousDefenseBonus: context?.gloriousDefenseBonus || 0,
                defensiveDuelistBonus: context?.defensiveDuelistBonus || 0,
                baitAndSwitchBonus: context?.baitAndSwitchBonus || 0,
                d20Floor10: context?.d20Floor10,
                tacticalMind: context?.tacticalMind,
                tacticalMindBonus: context?.tacticalMindBonus,
                strokeOfLuck: context?.strokeOfLuck,
                psiBolsteredKnack: context?.psiBolsteredKnack,
                psiBolsteredKnackDieSize: context?.psiBolsteredKnackDieSize,
                bardicInspiration: context?.bardicInspiration,
                bardicInspirationDie: context?.bardicInspirationDie,
                bardicInspirationDefense: context?.bardicInspirationDefense,
                bardicInspirationDefenseDieSize: context?.bardicInspirationDefenseDieSize,
                bardicInspirationDefenseTargetName: context?.bardicInspirationDefenseTargetName,
                bardicInspirationOffense: context?.bardicInspirationOffense || (context?.playerStats ? hasBardicInspirationOffense(context.playerStats, campaignName) : false),
                bardicInspirationOffenseDieSize: context?.bardicInspirationOffenseDieSize || getBardicInspirationDieSize(characterName, campaignName) || (context?.playerStats ? getBardicInspirationDieSizeFromClass(context.playerStats) : null),
                cosmicOmenAppliedBonus,
                luckyRerolled,
                luckyRerollValue,
                characterName,
                campaignName,
                availableSuperiorityManeuvers,
            });
        }

        if (rollType === 'attack') {
            setRuntimeValue(characterName, 'lastAttackRoll', {
                d20: effectiveD20,
                bonus: homingStrikesUsed ? (bonus + homingStrikesBonus) : bonus,
                targetName,
                targetAc,
                hit,
                isCrit,
                effectiveAc,
                coverAcBonus,
                homingStrikesBonus: homingStrikesUsed ? homingStrikesBonus : undefined,
                timestamp: Date.now(),
            }, campaignName);

            // Save unified last attack to combat summary for all reaction features
            if (combatSummary && targetName) {
                combatSummary.lastAttack = {
                    attackerName: characterName,
                    targetName,
                    d20: effectiveD20,
                    d20Rolls: [r1, r2],
                    bonus,
                    total: effectiveD20 + bonus,
                    targetAc,
                    effectiveAc,
                    hit,
                    isCrit,
                    weaponType: context?.isMelee != null
                        ? (context.isMelee ? 'melee' : 'ranged')
                        : (context?.damageType === 'ranged' ? 'ranged' : 'melee'),
                    isUnarmedStrike: context?.isUnarmedStrike || false,
                    isAutoMiss,
                    isNatural20: effectiveD20Roll === 20,
                    isNatural1: effectiveD20Roll === 1,
                    attackName: name,
                    rollType,
                    damageType: context?.damageType || null,
                    damageFormula: context?.autoDamageFormula || null,
                    damageName: context?.autoDamageName || null,
                    damageSchool: context?.autoDamageSchool || null,
                    saveDc: context?.saveDc || null,
                    saveType: context?.saveType || null,
                    dcSuccess: context?.dcSuccess || null,
                    metamagicTwinTarget: context?.metamagicTwinTarget || null,
                    metamagicHeighten: context?.metamagicHeighten || null,
                    isCantrip: context?.isCantrip || null,
                    overchannelActive: context?.overchannelActive || null,
                    overchannelUseCount: context?.overchannelUseCount || null,
                    overchannelSpellLevel: context?.overchannelSpellLevel || null,
                    secondaryFormula: context?.autoDamageSecondaryFormula || null,
                    secondaryDamageType: context?.autoDamageSecondaryDamageType || null,
                    rangeReason: context?.rangeReason || null,
                    coverLevel: context?.coverLevel || null,
                    coverAcBonus: context?.coverAcBonus || 0,
                    coverReason: context?.coverReason || null,
                    resistanceNotice: context?.resistanceNotice || null,
                    forcedMode: context?.forcedMode || null,
                    isAutoCrit: context?.isAutoCrit || false,
                    autoReroll: context?.autoReroll || null,
                    autoRerollBonus: context?.autoRerollBonus || null,
                    defensiveDuelistBonus: context?.defensiveDuelistBonus || 0,
                    gloriousDefenseBonus: context?.gloriousDefenseBonus || 0,
                    baitAndSwitchBonus: context?.baitAndSwitchBonus || 0,
                };
                storage.set('combatSummary', combatSummary, campaignName);
            }

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

            setRuntimeValue(characterName, 'pendingCombatSuperiorityPrompt', {
                rollType: 'attack',
                attackContext: {
                    hit: hit,
                    isCrit: isCrit,
                    weaponType: context?.damageType === 'ranged' ? 'ranged' : 'melee',
                    isUnarmedStrike: context?.isUnarmedStrike || false,
                    targetName: targetName,
                    saveDc: context?.saveDc || null,
                    saveType: context?.saveType || null,
                    timestamp: Date.now(),
                },
                timestamp: Date.now(),
            }, campaignName);

            if (!hit && !isAutoMiss && targetName && ps?.automation?.passives) {
                const missEffects = ps.automation.passives.filter(
                    p => p.type === 'auto_effect' && p.trigger === 'miss' && p.effect === 'next_attack_advantage'
                );
                if (missEffects.length > 0) {
                    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                    for (const effect of missEffects) {
                        const newEffect = {
                            target: characterName,
                            source: effect.name,
                            effect: 'next_attack_advantage',
                            vexTarget: targetName,
                            duration: effect.duration || 'until_start_of_next_turn',
                        };
                        storedEffects.push(newEffect);
                    }
                    setRuntimeValue(campaignName, 'targetEffects', storedEffects, campaignName);
                    for (const effect of missEffects) {
                        addEntry(campaignName, {
                            type: 'ability_use',
                            characterName: characterName,
                            abilityName: effect.name,
                            description: `${characterName}'s ${effect.name} grants advantage on the next attack roll against ${targetName}`,
                            targetName: targetName,
                        }).catch(() => { });
                    }
                }
            }

            if (context?.grazeDamage && targetName && !hit && !isAutoMiss) {
                const grazeAbilityMod = context?.grazeAbilityMod || 0;
                const grazeDamageAmount = Math.max(0, grazeAbilityMod);
                if (grazeDamageAmount > 0) {
                    const grazeDamageType = context?.damageType || 'Slashing';
                    const grazeFormula = `${grazeDamageAmount} [Graze]`;
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
                        bonus: 0,
                        modifier: 0,
                        damageType: grazeDamageType,
                        targetName: targetName,
                        finalDamage: applyResult?.finalDamage,
                        note: 'Graze: ability modifier damage on miss',
                    });
                    addEntry(campaignName, {
                        type: 'ability_use',
                        characterName: characterName,
                        abilityName: 'Graze',
                        description: `${characterName} used Graze on ${name} against ${targetName}`,
                        targetName: targetName,
                    }).catch(() => { });
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
            }

            if (targetName && hit) {
                const allEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const vexEffects = allEffects.filter(te => te.effect === 'next_attack_advantage' && te.target === characterName && te.vexTarget === targetName);
                if (vexEffects.length > 0) {
                    const clearedEffects = allEffects.filter(te => !(te.effect === 'next_attack_advantage' && te.target === characterName && te.vexTarget === targetName));
                    setRuntimeValue(campaignName, 'targetEffects', clearedEffects, campaignName);
                }
                const distractingEffects = allEffects.filter(te => te.effect === 'distracting_strike_advantage' && te.target === targetName && te.source !== characterName);
                if (distractingEffects.length > 0) {
                    const clearedEffects = allEffects.filter(te => !(te.effect === 'distracting_strike_advantage' && te.target === targetName && te.source !== characterName));
                    setRuntimeValue(campaignName, 'targetEffects', clearedEffects, campaignName);
                }
                const sapEffects = allEffects.filter(te => te.effect === 'disadvantage_next_attack' && te.target === characterName);
                if (sapEffects.length > 0) {
                    const clearedEffects = allEffects.filter(te => !(te.effect === 'disadvantage_next_attack' && te.target === characterName));
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
                const hasEmpoweredEvoc = getEmpoweredEvocationFeatures(potentPlayerStats).length > 0;
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
                        total: applyResult?.finalDamage,
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
                            total: applyResult?.finalDamage,
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
                }
            }
            else if (isAutoMiss && context?.saveDc) {
                const hasEmpoweredEvoc = getEmpoweredEvocationFeatures(potentPlayerStats).length > 0;
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
                        total: applyResult?.finalDamage,
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
            }
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

            // Save unified last attack to combat summary for all reaction features
            if (combatSummary) {
                combatSummary.lastAttack = {
                    attackerName: characterName,
                    targetName,
                    d20: effectiveD20,
                    d20Rolls: [r1, r2],
                    bonus,
                    total: effectiveD20 + bonus,
                    checkName: name,
                    rollType,
                    timestamp: Date.now(),
                };
                storage.set('combatSummary', combatSummary, campaignName);
            }

            setRuntimeValue(characterName, '_lastRollContext', {
                type: 'check',
                checkName: name,
                oldTotal: effectiveD20 + bonus,
                timestamp: Date.now(),
            }, campaignName);
        }

        if (rollType === 'save') {
            const saveDc = context?.saveDc;
            const saveType = context?.saveType;
            const attackerName = context?.attackerName || characterName;
            const actionName = context?.actionName || name;
            const targetIsPlayer = target?.type === 'player';
            let saveTotal;
            let saveSuccess;
            let effectiveD20ForSave;
            let saveResultData;

            if (targetIsPlayer && saveDc != null) {
                const { promise } = createSaveListener(campaignName, {
                    targetName,
                    saveType: saveType || 'CON',
                    saveDc,
                    dcSuccess: context?.dcSuccess || 'half',
                });

                const saveResult = await promise;
                saveSuccess = saveResult.success;
                effectiveD20ForSave = saveResult.roll;
                saveTotal = saveResult.total;
                saveResultData = saveResult;

                // Cosmic Omen: apply global pending bonus to save total
                const cosmicOmenPendingRawSave = getRuntimeValue(campaignName, 'cosmicOmenPendingBonus', campaignName);
                if (cosmicOmenPendingRawSave) {
                    try {
                        const pending = JSON.parse(cosmicOmenPendingRawSave);
                        if (pending && typeof pending.value === 'number' && pending.value > 0) {
                            const isWeal = pending.type === 'Weal';
                            saveTotal += isWeal ? pending.value : -pending.value;
                            cosmicOmenAppliedBonus = isWeal ? pending.value : -pending.value;
                            saveSuccess = saveTotal >= saveDc;
                            setRuntimeValue(campaignName, 'cosmicOmenPendingBonus', null, campaignName, true);
                        }
                    } catch (_e) { /* ignore */ }
                }

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

                if (combatSummary) {
                    combatSummary.lastAttack = {
                        attackerName,
                        targetName: characterName,
                        d20: effectiveD20ForSave,
                        d20Rolls: [saveResult.roll, ...(saveResult.rawRolls || [])],
                        bonus: saveResult.saveBonus,
                        total: saveResult.total,
                        saveType,
                        saveDc,
                        saveResult: saveSuccess ? 'success' : 'failure',
                        isNatural20: saveResult.roll === 20,
                        isNatural1: saveResult.roll === 1,
                        actionName,
                        rollType: 'save',
                        saveConditions: context?.saveConditions || [],
                        timestamp: Date.now(),
                    };
                    storage.set('combatSummary', combatSummary, campaignName);
                }

                logEntry({
                    type: 'roll',
                    characterName: targetName || characterName,
                    rollType: 'save',
                    name: actionName,
                    rolls: [effectiveD20ForSave],
                    mode: saveResult.mode || 'normal',
                    total: saveResult.total,
                    bonus: saveResult.saveBonus,
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
                });
            } else {
                // Cosmic Omen: apply global pending bonus to effectiveD20
                let effectiveD20ForSave = effectiveD20;
                const cosmicOmenPendingRawSave2 = getRuntimeValue(campaignName, 'cosmicOmenPendingBonus', campaignName);
                if (cosmicOmenPendingRawSave2) {
                    try {
                        const pending = JSON.parse(cosmicOmenPendingRawSave2);
                        if (pending && typeof pending.value === 'number' && pending.value > 0) {
                            const isWeal = pending.type === 'Weal';
                            effectiveD20ForSave += isWeal ? pending.value : -pending.value;
                            cosmicOmenAppliedBonus = isWeal ? pending.value : -pending.value;
                            setRuntimeValue(campaignName, 'cosmicOmenPendingBonus', null, campaignName, true);
                        }
                    } catch (_e) { /* ignore */ }
                }

                saveTotal = effectiveD20ForSave + bonus;
                saveSuccess = saveDc != null ? (saveTotal >= saveDc) : null;

                setRuntimeValue(characterName, 'lastSaveRoll', {
                    d20: effectiveD20ForSave,
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

                if (saveDc != null && combatSummary) {
                    combatSummary.lastAttack = {
                        attackerName,
                        targetName: characterName,
                        d20: effectiveD20ForSave,
                        d20Rolls: [r1, r2],
                        bonus,
                        total: saveTotal,
                        saveType,
                        saveDc,
                        saveResult: saveSuccess ? 'success' : 'failure',
                        isNatural20: r1 === 20,
                        isNatural1: r1 === 1,
                        actionName,
                        rollType: 'save',
                        saveConditions: context?.saveConditions || [],
                        timestamp: Date.now(),
                    };
                    storage.set('combatSummary', combatSummary, campaignName);
                }

                logEntry({
                    type: 'roll',
                    characterName: targetName || characterName,
                    rollType: 'save',
                    name: actionName,
                    rolls: [effectiveD20ForSave],
                    mode: 'normal',
                    total: saveTotal,
                    bonus,
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
                });
            }

            if (context?.autoDamageFormula && saveDc != null) {
                const damageFormula = context.autoDamageFormula;
                const damageType = context?.autoDamageDamageType || 'Slashing';
                const saveConditions = context?.saveConditions || [];
                const damageResult = rollExpression(damageFormula);
                if (damageResult) {
                    const applyTarget = targetName || characterName;
                    const normalizedSaveType = normalizeSaveType(saveType);
                    const targetChar = (characters || []).find(c => c.name === applyTarget);
                    const targetConditions = getRuntimeValue(applyTarget, 'activeConditions', campaignName) || [];
                    const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');
                    const ownEvasion = targetChar?.computedStats?.evasionEffects;
                    const hasOwnEvasion = !isIncapacitated && context?.dcSuccess === 'half' && ownEvasion?.some(ef => ef.saveType === normalizedSaveType);
                    const hasSharedEvasion = !hasOwnEvasion && !isIncapacitated && context?.dcSuccess === 'half' &&
                        (characters || []).some(c => {
                            if (c.name === applyTarget) return false;
                            const ev = c?.computedStats?.evasionEffects;
                            return ev?.some(ef => ef.saveType === normalizedSaveType && ef.shareable && ef.shareRange >= 5);
                        });
                    const hasEvasion = hasOwnEvasion || hasSharedEvasion;
                    if (hasEvasion) {
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
                    let finalDamage = computeDamageAfterEvasion(damageResult.total, saveSuccess, context?.dcSuccess, hasEvasion);

                    const attackerChar = (characters || []).find(c => c.name === attackerName);
                    const ignoreResistance = (attackerChar?.computedStats && hasIgnoreResistance(attackerChar.computedStats, damageType)) || false;
                    const combatSummaryForSave = await loadCombatSummary(campaignName);
                    const applyResult = applyDamageToTarget(combatSummaryForSave, applyTarget, finalDamage, [damageType], campaignName, characters, ignoreResistance, attackerName);

                    logEntry({
                        type: 'roll',
                        characterName: attackerName,
                        rollType: 'save-damage',
                        name: actionName,
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
                    });

                    setPopupHtml({
                        type: 'save-damage',
                        name: actionName,
                        formula: damageFormula,
                        rolls: damageResult.rolls,
                        total: applyResult?.finalDamage,
                        bonus: 0,
                        modifier: damageResult.modifier,
                        damageType: damageType,
                        targetName: applyTarget,
                        targetCurrentHp: applyResult?.newHp,
                        targetMaxHp: targetName ? (target?.type === 'player' ? (getRuntimeValue(targetName, 'hitPoints') ?? 0) : target?.maxHp ?? 0) : undefined,
                        saveDc,
                        saveType,
                        dcSuccess: context?.dcSuccess,
                        saveResult: { roll: effectiveD20ForSave, total: saveTotal, bonus: saveResultData?.saveBonus ?? bonus, success: saveSuccess },
                        finalDamage: applyResult?.finalDamage,
                        damageApplied: true,
                        damageReduced: applyResult?.damageReduced,
                    });

                    if (saveConditions.length > 0 && !saveSuccess) {
                        const targetChar = (characters || []).find(c => c.name === applyTarget);
                        const targetStats = targetChar?.computedStats || targetChar;
                        const isImmune = targetStats && playerIsImmuneToCondition({
                            conditionKey: saveConditions[0],
                            playerStats: targetStats,
                            getRuntimeValue,
                            campaignName,
                        });
                        if (!isImmune) {
                            const currentConditions = getRuntimeValue(applyTarget, 'activeConditions') || [];
                            const newConditions = [...currentConditions];
                            for (const cond of saveConditions) {
                                if (!newConditions.some(c => String(c).toLowerCase() === cond)) {
                                    newConditions.push(cond);
                                }
                            }
                            setRuntimeValue(applyTarget, 'activeConditions', newConditions, campaignName);
                            const conditionNames = saveConditions.map(c => c.charAt(0).toUpperCase() + c.slice(1));
                            addEntry(campaignName, {
                                type: 'condition',
                                action: 'applied',
                                characterName: applyTarget,
                                condition: conditionNames.join(', '),
                                sourceName: attackerName,
                                sourceAbility: actionName,
                                timestamp: Date.now(),
                            }).catch(() => { });
                        }
                    }
                }
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
                    creature.initiative = String(effectiveD20Roll + totalBonus);
                    combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
                    storage.set('combatSummary', combatSummary, campaignName);
                }
            }
            clearAllExpirationEffects(characterName, campaignName);
            setRuntimeValue(characterName, 'uncannyMetabolismUsed', false, campaignName);

            setPopupHtml({
                type: 'd20',
                rollType: 'initiative',
                name: 'Initiative',
                rolls: [r1, r2],
                bonus: totalBonus,
                characterName,
                campaignName,
                availableSuperiorityManeuvers,
                forcedMode: context?.forcedMode,
                strokeOfLuck: context?.strokeOfLuck,
                bardicInspiration: context?.bardicInspiration,
                bardicInspirationDie: context?.bardicInspirationDie,
                cosmicOmenAppliedBonus,
            });
            window.dispatchEvent(new CustomEvent('initiative-rolled', { detail: { characterName: firstName, roll: effectiveD20Roll + totalBonus } }));
            clearHuntersMarkConcentration(firstName, campaignName);
        }
    };
}
