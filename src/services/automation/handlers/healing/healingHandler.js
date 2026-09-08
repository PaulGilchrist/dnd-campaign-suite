import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import { getClassFeatures } from '../../../character/classFeatures.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { applyHealingDirectly, logHealingToSSE } from '../../common/healingRoll.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximizationForTarget, hasRerollHealingOnes, markFortifiedHealthUsed, hasTacticalShift } from '../../../combat/automation/automationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getHitDieSize, computeHitDieRecovery } from '../../../rules/effects/restRules.js';
import { resolveDiceExpression, evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';

async function fetchTargetCharacterData(targetName, campaignName) {
    try {
        const encodedCampaign = encodeURIComponent(campaignName);
        const fileName = `${targetName.toLowerCase().replace(/\s+/g, '-')}.json`;
        const response = await fetch(`/api/campaigns/${encodedCampaign}/${encodeURIComponent(fileName)}`);
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        // Return null on failure
        console.warn('[healingHandler] Target character data unavailable:', error);
    }
    return null;
}

export async function handle(action, playerStats, campaignName, _mapName, _characters) {
    const auto = action.automation;
    const isSelf = auto.type === 'self_healing';
    const slotLevel = auto.slotLevel || 1;

    const expression = auto.healExpression || '';
    const isMonkHealing = expression.includes('martial_arts_die') && expression.includes('WIS');

    if (!isSelf && auto.requiresHealersKit === true && auto.healExpression) {
        const allItems = [...(playerStats.inventory?.equipped || []), ...(playerStats.inventory?.backpack || [])];
        const hasKit = allItems.some(item => {
            const name = typeof item === 'string' ? item : (item.name || '');
            return name.toLowerCase().includes("healer's kit") || name.toLowerCase().includes("healer kit");
        });
        if (!hasKit) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} requires a Healer's Kit.`,
                },
            };
        }

        const targetInfo = await resolveTarget(campaignName, playerStats.name);
        const targetName = targetInfo?.target?.name || playerStats.name;

        // Try to find target in the _characters prop first (player _characters with computedStats)
        const targetChar = (_characters || []).find(c => c.name === targetName);
        const targetStats = targetChar?.computedStats || targetChar || playerStats;
        let hitDieSize = getHitDieSize(targetStats);

        // If no hit die found and target is different from healer, fetch target character data
        if (!hitDieSize && targetName !== playerStats.name) {
            const targetData = await fetchTargetCharacterData(targetName, campaignName);
            if (targetData) {
                const classIndex = targetData.class?.index || targetData.class;
                if (classIndex) {
                    const is2024 = targetData.rules === '2024';
                    const classes = await (await fetch(`/api/data/classes${is2024 ? '2024' : ''}`)).json();
                    const classEntry = classes.find(c => c.index === classIndex || c.name === classIndex);
                    hitDieSize = parseInt((classEntry?.hit_point_die || 'd8').replace(/[^0-9]/g, ''), 10) || 8;
                }
            }
        }
        hitDieSize = hitDieSize || 8;

        const targetHitDice = Number(getRuntimeValue(targetName, 'shortRestHitDice', campaignName) ?? 0);
        if (targetHitDice < 1) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${targetName} has no hit dice remaining.`,
                },
            };
        }

        const maximize = hasHealingMaximizationForTarget(playerStats, targetName, campaignName);
        const rerollOnes = hasRerollHealingOnes(playerStats);
        const rollResult = maximize
            ? rollExpressionMaximized(`1d${hitDieSize}`)
            : rerollOnes
                ? rollExpression(`1d${hitDieSize}`, { rerollOnes: true })
                : rollExpression(`1d${hitDieSize}`);
        if (!rollResult) {
            console.error(`[healingHandler] ${action.name}: rollExpression returned null for 1d${hitDieSize}`);
            return null;
        }

        const profBonus = playerStats.proficiency || 0;
        const healAmount = rollResult.total + profBonus;

        const { newHp, maxHp, actualHeal } = applyHealingDirectly(playerStats, targetName, healAmount, campaignName);

        const rollDisplay = maximize ? 'maximized' : (rerollOnes ? 'rerolled ones' : rollResult.rolls.join(', '));
        const rollInfo = `1d${hitDieSize}=${rollResult.total} (${rollDisplay})`;

        logHealingToSSE(campaignName, {
            targetName,
            sourceName: action.name,
            actualHeal,
            newHp,
            maxHp,
            rollInfo,
            maximize: false,
            healingName: action.name,
            bonusDetails: [],
            skipPopup: true,
        });

        const remainingHitDice = Math.max(0, targetHitDice - 1);
        await setRuntimeValue(targetName, 'shortRestHitDice', remainingHitDice, campaignName, true);

        const healDesc = actualHeal > 0 ? `Regained ${actualHeal} HP` : 'Already at full HP';
        const formula = `1d${hitDieSize} + ${profBonus}`;
        const description = `${action.name} on ${targetName}: ${formula} = ${healAmount} — ${healDesc} (${remainingHitDice} hit dice remaining).`;

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

    if (isMonkHealing) {
        const monkFeatures = getClassFeatures(playerStats);
        const martialArtsDie = monkFeatures?.martialArtsDie || 4;
        const wisdom = playerStats.abilities?.find(a => a.name === 'Wisdom');
        const wisModifier = wisdom?.bonus || 0;

        const rerollOnes = hasRerollHealingOnes(playerStats);
        let targetName;
        if (isSelf) {
            targetName = playerStats.name;
           } else {
            const targetInfo = await resolveTarget(campaignName, playerStats.name);
            targetName = targetInfo?.target?.name || playerStats.name;
          }

        const maximize = hasHealingMaximizationForTarget(playerStats, targetName, campaignName);
        const rollResult = maximize ? rollExpressionMaximized(`1d${martialArtsDie}`) : rerollOnes ? rollExpression(`1d${martialArtsDie}`, { rerollOnes: true }) : rollExpression(`1d${martialArtsDie}`);
        if (!rollResult) {
            console.error(`[healingHandler] ${action.name}: monk rollExpression returned null for 1d${martialArtsDie}`);
            return null;
        }

        const baseHeal = rollResult.total + wisModifier;
        const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel, campaignName);
        const healAmount = baseHeal + bonusHeal;

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

        const gateMaxHp = playerStats.maxHitPoints ?? playerStats.hitPoints ?? 0;
        const storedCurrentHp = getRuntimeValue(playerStats.name, 'currentHitPoints', campaignName);
        const gateCurrentHp = (storedCurrentHp != null && storedCurrentHp !== '') ? Number(storedCurrentHp) : (playerStats.currentHitPoints ?? gateMaxHp);
        const hasHpTruth = gateMaxHp > 0 && !Number.isNaN(gateCurrentHp);

        if (hasHpTruth && gateCurrentHp <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} can't be used while unconscious at 0 Hit Points.`,
                },
            };
        }

        if (hasHpTruth && gateCurrentHp >= gateMaxHp) {
            const refusalUses = (isHitDieRoll && isSelf) ? undefined : ` (${currentUses} use${currentUses === 1 ? '' : 's'} remaining)`;
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name}: Already at full HP${refusalUses ?? ''}. No use spent.`,
                },
            };
        }

        let resolvedExpression = resolveDiceExpression(auto.healExpression, playerStats, slotLevel)
            .replace(/\bfighter level\b/gi, String(playerStats.level || 1));

        if (isHitDieRoll) {
            const hitDieSize = getHitDieSize(playerStats);
            resolvedExpression = `1d${hitDieSize}`;
        }

        const maximize = hasHealingMaximizationForTarget(playerStats, playerStats.name, campaignName);
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
            const { totalBonus, details } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel, campaignName);
            bonusDetails = details;
            healAmount = rollResult.total + totalBonus;
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

        let tacticalShiftTriggered = false;
        if (!(isHitDieRoll && isSelf) && actualHeal > 0) {
            await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName, true);

            // CLA-353 Tactical Shift (2024 Fighter lv5, passive_rule tactical_shift_no_oa):
            // whenever Second Wind is activated, the holder moves up to half their Speed
            // without provoking Opportunity Attacks until the start of their next turn.
            // Mirrors the verified CLA-333 stepOfTheWindHandler self-te + expiration shape.
            if (usesKey === 'secondWindUses' && hasTacticalShift(playerStats)) {
                tacticalShiftTriggered = true;
                const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
                await setRuntimeValue('campaign', 'targetEffects', [
                    ...storedEffects,
                    { target: playerStats.name, source: 'Tactical Shift', effect: 'no_opportunity_attacks', value: null, duration: 'until_start_of_next_turn' },
                ], campaignName);
                addExpiration(playerStats.name, playerStats.name, [
                    { type: 'remove_target_effect', effectKey: 'no_opportunity_attacks', source: 'Tactical Shift', target: playerStats.name },
                ], campaignName, undefined, playerStats.name);
                addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerStats.name,
                    abilityName: 'Tactical Shift',
                    description: `${playerStats.name} triggered Tactical Shift (Second Wind): moved up to half Speed without provoking Opportunity Attacks until the start of your next turn.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error('[healingHandler:Tactical Shift] Error logging:', e); });
            }
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
            remainingUses: (isHitDieRoll && isSelf) ? undefined : (actualHeal > 0 ? currentUses - 1 : currentUses),
            maxUses,
            bonusDetails,
        });

        const healDesc = actualHeal > 0
            ? `Regained ${actualHeal} HP`
            : 'Already at full HP';
        const remainingUses = actualHeal > 0 ? currentUses - 1 : currentUses;
        const shiftNote = tacticalShiftTriggered ? ' Tactical Shift: you can move up to half your Speed without provoking Opportunity Attacks until the start of your next turn' : '';
        const description = (isHitDieRoll && isSelf)
            ? `${action.name}: ${rollInfo} — ${healDesc} (${remainingHitDice} hit dice remaining).`
            : `${action.name}: ${rollInfo} — ${healDesc} (${remainingUses} use${remainingUses === 1 ? '' : 's'} remaining)${actualHeal > 0 ? '' : '. No use spent'}${shiftNote}.`;

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
                const maximize = hasHealingMaximizationForTarget(playerStats, targetName, campaignName);
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

                const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel, campaignName);
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
            const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel, campaignName);
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
          const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel, campaignName);
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
