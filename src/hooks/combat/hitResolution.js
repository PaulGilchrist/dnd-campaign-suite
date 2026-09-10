import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import utils from '../../services/ui/utils.js';
import { isUnbreakableMajestyActive, hasAttackerTriggeredMajesty, markAttackerTriggeredMajesty, getUnbreakableMajestySaveDc } from '../../services/combat/auras/unbreakableMajesty.js';
import { dispatchUnbreakableMajestySave } from './loggedDiceRollUtils.js';
import { hasBardicInspirationDefense } from '../../services/combat/auras/bardicInspirationState.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { addEntry } from '../../services/ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { evaluateAutoExpression } from '../../services/combat/automation/automationExpressions.js';

export async function resolveHit(characterName, campaignName, context, bonus, effectiveD20Roll, target, combatSummary, characters, logEntry, _setPopupHtml) {
    let { hit, isAutoMiss } = context;
    const attackerName = context?.attackerName || characterName;
    const targetName = (context?.rollType === 'attack' || context?.rollType === 'save') ? (target?.name || context?.targetName) : undefined;

    // AC computation
    let targetAc;
    if (context?.rollType === 'attack') {
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

    const coverAcBonus = context?.coverAcBonus || 0;
    // SP-109: Slow imposes a -2 AC penalty on the target while it is slowed.
    // SP-125: Warding Bond grants the warded target +1 AC (from activeBuffs acBonus).
    const effectiveAc = target ? targetAc + coverAcBonus + (context?.defensiveDuelistBonus || 0) + (context?.baitAndSwitchBonus || 0) + (context._shieldAcBonus || 0) + (context._shieldOfFaithAcBonus || 0) + (context._wardingBondAcBonus || 0) - (context._slowAcPenalty || 0) : undefined;
    hit = isAutoMiss ? false : (target ? (effectiveD20Roll + context.effectiveBonus >= effectiveAc) : undefined);

    // Unbreakable Majesty on hit
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
                        console.error('[unbreakableMajesty] CHA save prompt timed out after 30s — attack stands unresolved (fail-open).');
                        logEntry({
                            type: 'ability_use',
                            characterName: target.name,
                            abilityName: 'Unbreakable Majesty',
                            description: `${attackerName}'s Unbreakable Majesty CHA save (DC ${majSaveDc}) was not resolved within 30 seconds — attack stands (save-window timeout).`,
                        });
                        resolve();
                    }
                }, 30000);
            });
        }
    }

    // Combat Inspiration - Defense
    if (hit && target) {
        const biUsesRaw = getRuntimeValue(target.name, 'bardicInspirationUses', campaignName);
        const biUsesNum = (typeof biUsesRaw === 'object' && biUsesRaw !== null) ? biUsesRaw.current : (biUsesRaw != null ? Number(biUsesRaw) : (characters.find(c => c.name === target.name)?.computedStats?._trackedResources?.bardicInspirationUses?.current ?? 0));
        context.bardicInspirationDefense = hasBardicInspirationDefense(target.name, campaignName) && context._biDieSize && biUsesNum > 0;
        context.bardicInspirationDefenseDieSize = context._biDieSize;
        context.bardicInspirationDefenseTargetName = target.name;
        context.bardicInspirationDefenseAttackRoll = hit ? effectiveD20Roll : null;
        context.bardicInspirationDefenseBonus = hit ? context.effectiveBonus : null;
        context.bardicInspirationDefenseEffectiveAc = hit ? effectiveAc : null;
    }

    // Veer — mount redirect
    if (hit && target && context?.rollType === 'attack') {
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

    // Soul Blades (Soulknife level 9) — Homing Strikes
    const ps = context?.playerStats;
    const isSoulknife = ps?.class?.name === 'Rogue' && ps?.class?.major?.name === 'Soulknife';
    const hasSoulBlades = isSoulknife && ps?.level >= 9;
    const isPsychicBlade = context?.isPsychicBlade === true;
    let homingStrikesUsed = false;
    let homingStrikesBonus = 0;
    let homingStrikesAttempted = false;
    const homingAc = effectiveAc != null ? effectiveAc : targetAc;
    if (hasSoulBlades && isPsychicBlade && hit === false && !isAutoMiss && effectiveD20Roll === 1) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName,
            abilityName: 'Soul Blades',
            description: `${characterName} rolled a natural 1 with the Psychic Blade — an attack roll of 1 always misses; Homing Strikes was not attempted.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[homingStrikes] Log error:', e); });
    } else if (hasSoulBlades && isPsychicBlade && hit === false && !isAutoMiss) {
        const psionicDieSize = Number(evaluateAutoExpression('psionic_energy_die', ps)) || 6;
        const psionicBonus = Math.floor(Math.random() * psionicDieSize) + 1;
        homingStrikesAttempted = true;
        const newTotal = effectiveD20Roll + context.bonus + psionicBonus;
        const newHit = homingAc != null ? (newTotal >= homingAc) : null;
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
                    description: `${characterName} used Soul Blades (Homing Strikes) to turn a miss into a hit (total: ${newTotal} vs AC: ${homingAc}), consuming 1 Psionic Energy. Psionic Energy: ${currentEnergy - 1}/${defaultMax}.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error('[homingStrikes] Log error:', e); });
            }
        } else if (newHit !== null) {
            addEntry(campaignName, {
                type: 'ability_use',
                characterName,
                abilityName: 'Soul Blades',
                description: `${characterName} tried Soul Blades (Homing Strikes) but even with the psionic die roll of ${psionicBonus}, the attack still missed (total: ${newTotal} vs AC: ${homingAc}).`,
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

    // Critical range check
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
    const isCrit = !isAutoMiss && (utils.DEBUG_FORCE_CRIT || effectiveD20Roll === 20 || context?.isAutoCrit || rollsInCriticalRange) && (hit || rollsInCriticalRange);

    // Unerring Strike (Living Legend)
    let unerringStrikeApplied = false;
    if (!hit && !isAutoMiss && context?.rollType === 'attack' && context?.isWeaponAttack) {
        const livingLegendActive = getRuntimeValue(characterName, 'livingLegendActive', campaignName);
        if (livingLegendActive) {
            const unerringStrikeUsed = getRuntimeValue(characterName, 'unerringStrikeUsed', campaignName);
            if (!unerringStrikeUsed) {
                hit = true;
                isAutoMiss = false;
                unerringStrikeApplied = true;
                await setRuntimeValue(characterName, 'unerringStrikeUsed', true, campaignName);
                addEntry(campaignName, {
                    type: 'ability_use',
                    characterName,
                    abilityName: 'Living Legend',
                    description: `${characterName} used Unerring Strike on ${context.name} against ${targetName}: missed roll of ${effectiveD20Roll} + ${context.bonus} = ${effectiveD20Roll + context.bonus} vs AC ${targetAc} → turned into a hit.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error('[unerringStrike] Log error:', e); });
            }
        }
    }

    // Death Strike (Assassin level 17)
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
                    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
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
                    setRuntimeValue('campaign', 'targetEffects', updatedEffects, campaignName);
                }
            }
        }
    }

    return { hit, isAutoMiss, isCrit, unerringStrikeApplied, homingStrikesUsed, homingStrikesBonus, homingStrikesAttempted, targetAc, effectiveAc, effectiveD20Roll };
}
