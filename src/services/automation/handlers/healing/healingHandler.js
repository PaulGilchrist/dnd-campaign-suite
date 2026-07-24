import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import { getClassFeatures } from '../../../character/classFeatures.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { applyHealingDirectly, logHealingToSSE } from '../../common/healingRoll.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximization, hasRerollHealingOnes, markFortifiedHealthUsed } from '../../../combat/automation/automationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getHitDieSize, computeHitDieRecovery } from '../../../rules/effects/restRules.js';
import { resolveDiceExpression, evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const isSelf = auto.type === 'self_healing';
    const slotLevel = auto.slotLevel || 1;

    const expression = auto.healExpression || '';
    const isMonkHealing = expression.includes('martial_arts_die') && expression.includes('WIS');

    if (isMonkHealing) {
        const monkFeatures = getClassFeatures(playerStats);
        const martialArtsDie = monkFeatures?.martialArtsDie || 4;
        const wisdom = playerStats.abilities?.find(a => a.name === 'Wisdom');
        const wisModifier = wisdom?.bonus || 0;

        const maximize = hasHealingMaximization(playerStats);
        const rerollOnes = hasRerollHealingOnes(playerStats);
        const rollResult = maximize ? rollExpressionMaximized(`1d${martialArtsDie}`) : rerollOnes ? rollExpression(`1d${martialArtsDie}`, { rerollOnes: true }) : rollExpression(`1d${martialArtsDie}`);
        if (!rollResult) {
            console.error(`[healingHandler] ${action.name}: monk rollExpression returned null for 1d${martialArtsDie}`);
            return null;
        }

        const baseHeal = rollResult.total + wisModifier;
        const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiencyBonus || 0, playerStats.level || 1, slotLevel, campaignName);
        const healAmount = baseHeal + bonusHeal;

        let targetName;
        if (isSelf) {
            targetName = playerStats.name;
           } else {
            const targetInfo = await resolveTarget(campaignName, playerStats.name);
            targetName = targetInfo?.target?.name || playerStats.name;
          }

        const { newHp, maxHp, actualHeal } = applyHealingDirectly(playerStats, isSelf ? playerStats.name : targetName, healAmount, campaignName);

        if (actualHeal > 0) {
            const hasFortifiedHealth = bonusDetails.some(d => d.name === 'Fortified Health');
            if (hasFortifiedHealth) {
                await markFortifiedHealthUsed(playerStats, campaignName);
            }
        }

        const rollDisplay = maximize ? 'maximized' : (rerollOnes ? 'rerolled ones' : rollResult.rolls.join(', '));
        const rollInfo = `1d${martialArtsDie}=${rollResult.total} (${rollDisplay})`;

        logHealingToSSE(campaignName, {
            targetName: isSelf ? playerStats.name : targetName,
            sourceName: action.name,
            actualHeal,
            newHp,
            maxHp,
            rollInfo,
            maximize,
            healingName: action.name,
            skipPopup: true,
            bonusDetails,
          });

        const hasPhysiciansTouch = playerStats.specialActions?.some(f => f.name === "Physician's Touch");

        return {
            type: 'modal',
            modalName: 'handOfHealing',
            payload: {
                healName: action.name,
                formula: `1d${martialArtsDie} + ${wisModifier}${bonusHeal ? ` + ${bonusHeal}` : ''}`,
                rolls: rollResult.rolls,
                bonus: wisModifier + bonusHeal,
                healAmount,
                monkName: playerStats.name,
                targetName: isSelf ? playerStats.name : targetName,
                targetCurrentHp: newHp,
                targetMaxHp: maxHp,
                hasPhysiciansTouch,
                rerollOnes: rerollOnes && !maximize,
                },
            };
      } else if (isSelf && auto.healExpression) {
        const hitDiceCost = auto.hitDiceCost || 0;
        const isHitDieRoll = auto.healExpression === 'hit_die_roll';

        if (isHitDieRoll && hitDiceCost > 0) {
            const storedHitDice = Number(getRuntimeValue(playerStats.name, 'shortRestHitDice', campaignName) ?? playerStats.level);
            if (storedHitDice < hitDiceCost) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        automationType: auto.type,
                        description: `${action.name} requires ${hitDiceCost} hit die(s) to use. You have ${storedHitDice} remaining.`,
                    },
                };
            }
        }

        const bloodiedOnly = !!auto.bloodiedOnly;
        if (bloodiedOnly) {
            const currentHp = playerStats.currentHitPoints ?? 0;
            const maxHp = playerStats.maxHitPoints ?? 0;
            const isBloodied = currentHp > 0 && currentHp <= Math.floor(maxHp / 2);
            if (!isBloodied) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        automationType: auto.type,
                        description: `${action.name} can only be used when Bloodied (at half HP or less).`,
                    },
                };
            }
        }

        let usesKey;
        let maxUses = 1;
        let currentUses = 1;
        if (!(isHitDieRoll && isSelf)) {
            usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
            const maxFromTracked = playerStats?._trackedResources?.[usesKey]?.max;
            maxUses = maxFromTracked ?? auto.usesMax ?? auto.uses ?? 1;
            currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? maxUses);

            if (currentUses <= 0) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        automationType: auto.type,
                        description: `${action.name} has no uses remaining. Recharges on a ${auto.recharge === 'long_rest' ? 'Long Rest' : 'Short Rest'}.`,
                    },
                };
            }
        }

        let resolvedExpression = resolveDiceExpression(auto.healExpression, playerStats, slotLevel)
            .replace(/\bfighter level\b/gi, String(playerStats.level || 1));

        if (isHitDieRoll) {
            const hitDieSize = getHitDieSize(playerStats);
            resolvedExpression = `1d${hitDieSize}`;
        }

        const maximize = hasHealingMaximization(playerStats);
        const rerollOnes = hasRerollHealingOnes(playerStats);
        const evaluated = evaluateAutoExpression(resolvedExpression, playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel);
        let rollResult;
        if (typeof evaluated === 'number') {
            rollResult = { total: evaluated, rolls: [evaluated], formula: resolvedExpression };
        } else {
            rollResult = maximize ? rollExpressionMaximized(resolvedExpression) : rerollOnes ? rollExpression(resolvedExpression, { rerollOnes: true }) : rollExpression(resolvedExpression);
        }
        if (!rollResult) {
            console.error(`[healingHandler] ${action.name}: rollExpression returned null for resolved expression "${resolvedExpression}" (original: "${auto.healExpression}")`);
            return null;
        }

        let healAmount;
        let bonusDetails;
        if (isHitDieRoll) {
            const conBonus = playerStats.abilities?.find(a => a.name === 'Constitution')?.bonus || 0;
            healAmount = computeHitDieRecovery(rollResult.total, conBonus);
        } else {
            ({ totalBonus: healAmount, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiencyBonus || 0, playerStats.level || 1, slotLevel, campaignName));
        }

        const { newHp, maxHp, actualHeal } = applyHealingDirectly(playerStats, playerStats.name, healAmount, campaignName);

        if (actualHeal > 0) {
            const hasFortifiedHealth = bonusDetails?.some(d => d.name === 'Fortified Health');
            if (hasFortifiedHealth) {
                await markFortifiedHealthUsed(playerStats, campaignName);
            }
        }

        let remainingHitDice;
        if (isHitDieRoll && hitDiceCost > 0) {
            const currentHitDice = Number(getRuntimeValue(playerStats.name, 'shortRestHitDice', campaignName) ?? playerStats.level);
            remainingHitDice = Math.max(0, currentHitDice - hitDiceCost);
            await setRuntimeValue(playerStats.name, 'shortRestHitDice', remainingHitDice, campaignName, true);
        }

        if (!(isHitDieRoll && isSelf)) {
            await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName, true);
        }

        const rollDisplay = maximize ? 'maximized' : (rerollOnes ? 'rerolled ones' : rollResult.rolls.join(', '));
        const rollInfo = `${resolvedExpression}=${rollResult.total} (${rollDisplay})`;

        logHealingToSSE(campaignName, {
            targetName: playerStats.name,
            sourceName: action.name,
            actualHeal,
            newHp,
            maxHp,
            rollInfo,
            maximize,
            healingName: action.name,
            remainingHitDice: (isHitDieRoll && isSelf) ? remainingHitDice : undefined,
            remainingUses: (isHitDieRoll && isSelf) ? undefined : currentUses - 1,
            maxUses,
            bonusDetails,
        });

        const healDesc = actualHeal > 0
            ? `Regained ${actualHeal} HP`
            : 'Already at full HP';
        const description = (isHitDieRoll && isSelf)
            ? `${action.name}: ${rollInfo} — ${healDesc} (${remainingHitDice} hit dice remaining).`
            : `${action.name}: ${rollInfo} — ${healDesc} (${currentUses - 1} use${currentUses - 1 > 1 ? 's' : ''} remaining).`;

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description,
                },
            };
        } else if (auto.uses !== undefined && auto.uses !== null) {
          const maxUses = auto.usesMax ?? auto.uses;
          const usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
          const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? maxUses);

          if (currentUses <= 0) {
              return {
                  type: 'popup',
                  payload: {
                      type: 'automation_info',
                      name: action.name,
                      automationType: auto.type,
                      description: `${action.name} has been used and cannot be used again until you finish a Long Rest.`,
                  },
              };
          }

            const targetInfo = await resolveTarget(campaignName, playerStats.name);
            const targetName = targetInfo?.target?.name || playerStats.name;

            if (auto.healExpression) {
                const resolvedExpression = resolveDiceExpression(auto.healExpression, playerStats, slotLevel);
                const maximize = hasHealingMaximization(playerStats);
                const rerollOnes = hasRerollHealingOnes(playerStats);
                const evaluated = evaluateAutoExpression(resolvedExpression, playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel);
                let rollResult;
                if (typeof evaluated === 'number') {
                    rollResult = { total: evaluated, rolls: [evaluated], formula: resolvedExpression };
                } else {
                    rollResult = maximize ? rollExpressionMaximized(resolvedExpression) : rerollOnes ? rollExpression(resolvedExpression, { rerollOnes: true }) : rollExpression(resolvedExpression);
                }
                if (!rollResult) {
                    console.error(`[healingHandler] ${action.name}: rollExpression returned null for resolved expression "${resolvedExpression}" (original: "${auto.healExpression}")`);
                    return null;
                }

                const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiencyBonus || 0, playerStats.level || 1, slotLevel, campaignName);
                const healAmount = rollResult.total + bonusHeal;

                const { newHp, maxHp, actualHeal } = applyHealingDirectly(playerStats, targetName, healAmount, campaignName);

                if (actualHeal > 0) {
                    const hasFortifiedHealth = bonusDetails.some(d => d.name === 'Fortified Health');
                    if (hasFortifiedHealth) {
                        await markFortifiedHealthUsed(playerStats, campaignName);
                    }
                }

                await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

                const remainingUses = currentUses - 1;
                const rollDisplay = maximize ? 'maximized' : (rerollOnes ? 'rerolled ones' : rollResult.rolls.join(', '));
                const rollInfo = `${resolvedExpression}=${rollResult.total} (${rollDisplay})`;

                logHealingToSSE(campaignName, {
                    targetName,
                    sourceName: action.name,
                    actualHeal,
                    newHp,
                    maxHp,
                    rollInfo,
                    maximize,
                    healingName: action.name,
                    remainingUses,
                    maxUses,
                    bonusDetails,
                });

                const healDesc = actualHeal > 0
                    ? `Regained ${actualHeal} HP`
                    : 'Already at full HP';
                const description = remainingUses > 0
                    ? `${action.name} on ${targetName}: ${rollInfo} — ${healDesc} (${remainingUses} use${remainingUses > 1 ? 's' : ''} remaining).`
                    : `${action.name} on ${targetName}: ${rollInfo} — ${healDesc} (no uses remaining).`;

                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        automationType: auto.type,
                        description,
                    },
                };
            }

            await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

            const baseHeal = typeof auto.healAmount === 'number' ? auto.healAmount : null;
            const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiencyBonus || 0, playerStats.level || 1, slotLevel, campaignName);
            const totalHealAmount = baseHeal !== null ? baseHeal + bonusHeal : auto.healExpression;

            // Determine target for this flat-heal path
            const flatTargetInfo = await resolveTarget(campaignName, playerStats.name);
            const flatTargetName = flatTargetInfo?.target?.name || playerStats.name;
            const { newHp: finalNewHp, maxHp: finalMaxHp, actualHeal: finalActualHeal } = applyHealingDirectly(playerStats, flatTargetName, totalHealAmount, campaignName);

            if (finalActualHeal > 0) {
                const hasFortifiedHealth = bonusDetails.some(d => d.name === 'Fortified Health');
                if (hasFortifiedHealth) {
                    await markFortifiedHealthUsed(playerStats, campaignName);
                }
            }

            const rollInfo = auto.healExpression || `${auto.healAmount}`;

            logHealingToSSE(campaignName, {
                targetName: flatTargetName,
                sourceName: action.name,
                actualHeal: finalActualHeal,
                newHp: finalNewHp,
                maxHp: finalMaxHp,
                rollInfo,
                maximize: false,
                healingName: action.name,
                bonusDetails,
            });

            const healDesc = finalActualHeal > 0
                ? `Regained ${finalActualHeal} HP`
                : 'Already at full HP';
            const description = `${action.name}: ${rollInfo} — ${healDesc}`;

            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description,
                },
            };
        } else {
         const baseHeal = typeof auto.healAmount === 'number' ? auto.healAmount : null;
         const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiencyBonus || 0, playerStats.level || 1, slotLevel, campaignName);
         const totalHealAmount = baseHeal !== null ? baseHeal + bonusHeal : auto.healExpression;

         const defaultTargetInfo = await resolveTarget(campaignName, playerStats.name);
         const defaultTargetName = defaultTargetInfo?.target?.name || playerStats.name;
         const { newHp: finalNewHp, maxHp: finalMaxHp, actualHeal: finalActualHeal } = applyHealingDirectly(playerStats, defaultTargetName, totalHealAmount, campaignName);

         if (finalActualHeal > 0) {
             const hasFortifiedHealth = bonusDetails.some(d => d.name === 'Fortified Health');
             if (hasFortifiedHealth) {
                 await markFortifiedHealthUsed(playerStats, campaignName);
             }
         }

         const rollInfo = auto.healExpression || `${auto.healAmount}`;

         logHealingToSSE(campaignName, {
             targetName: defaultTargetName,
             sourceName: action.name,
             actualHeal: finalActualHeal,
             newHp: finalNewHp,
             maxHp: finalMaxHp,
             rollInfo,
             maximize: false,
             healingName: action.name,
             bonusDetails,
         });

         const healDesc = finalActualHeal > 0
             ? `Regained ${finalActualHeal} HP`
             : 'Already at full HP';
         const description = `${action.name}: ${rollInfo} — ${healDesc}`;

         return {
             type: 'popup',
             payload: {
                 type: 'automation_info',
                 name: action.name,
                 automationType: auto.type,
                 description,
             },
             };
        }
   }
