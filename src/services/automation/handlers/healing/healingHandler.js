import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import { getClassFeatures } from '../../../character/classFeatures.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { applyHealingDirectly, logHealingToSSE } from '../../common/healingRoll.js';
import { resolveHealingBonuses, hasHealingMaximization, hasRerollHealingOnes } from '../../../combat/automation/automationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { getHitDieSize, computeHitDieRecovery } from '../../../rules/effects/restRules.js';

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
        if (!rollResult) return null;

        const baseHeal = rollResult.total + wisModifier;
        const bonusHeal = resolveHealingBonuses(playerStats, playerStats.proficiencyBonus || 0, playerStats.level || 1, slotLevel);
        const healAmount = baseHeal + bonusHeal;

        let targetName;
        if (isSelf) {
            targetName = playerStats.name;
           } else {
            const targetInfo = await resolveTarget(campaignName, playerStats.name);
            targetName = targetInfo?.target?.name || playerStats.name;
          }

        const { newHp, maxHp, actualHeal } = applyHealingDirectly(playerStats, isSelf ? playerStats.name : targetName, healAmount, campaignName);

        logHealingToSSE(campaignName, {
            targetName: isSelf ? playerStats.name : targetName,
            sourceName: action.name,
            actualHeal,
            newHp,
            maxHp,
          });

        const hasPhysiciansTouch = playerStats.characterAdvancement?.some(f => f.name === "Physician's Touch");

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

        const maxUses = auto.usesMax ?? auto.uses ?? 1;
        const usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
        const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? maxUses);

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

        let resolvedExpression = auto.healExpression
            .replace(/\bfighter level\b/gi, String(playerStats.level || 1));

        if (isHitDieRoll) {
            const hitDieSize = getHitDieSize(playerStats);
            resolvedExpression = `1d${hitDieSize}`;
        }

        const maximize = hasHealingMaximization(playerStats);
        const rerollOnes = hasRerollHealingOnes(playerStats);
        const rollResult = maximize ? rollExpressionMaximized(resolvedExpression) : rerollOnes ? rollExpression(resolvedExpression, { rerollOnes: true }) : rollExpression(resolvedExpression);
        if (!rollResult) return null;

        let healAmount;
        if (isHitDieRoll) {
            const conBonus = playerStats.abilities?.find(a => a.name === 'Constitution')?.bonus || 0;
            healAmount = computeHitDieRecovery(rollResult.total, conBonus);
        } else {
            const bonusHeal = resolveHealingBonuses(playerStats, playerStats.proficiencyBonus || 0, playerStats.level || 1, slotLevel);
            healAmount = rollResult.total + bonusHeal;
        }

        const { newHp, maxHp, actualHeal } = applyHealingDirectly(playerStats, playerStats.name, healAmount, campaignName);

        logHealingToSSE(campaignName, {
            targetName: playerStats.name,
            sourceName: action.name,
            actualHeal,
            newHp,
            maxHp,
        });

        if (isHitDieRoll && hitDiceCost > 0) {
            const currentHitDice = Number(getRuntimeValue(playerStats.name, 'shortRestHitDice', campaignName) ?? playerStats.level);
            const newHitDice = Math.max(0, currentHitDice - hitDiceCost);
            await setRuntimeValue(playerStats.name, 'shortRestHitDice', newHitDice, campaignName, true);
        }

        await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName, true);

        const remainingUses = currentUses - 1;
        const description = remainingUses > 0
            ? `${action.name}: Regained ${actualHeal} HP (${remainingUses} use${remainingUses > 1 ? 's' : ''} remaining).`
            : `${action.name}: Regained ${actualHeal} HP (no uses remaining).`;

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

         await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

         const targetInfo = await resolveTarget(campaignName, playerStats.name);
         const isSelf = !targetInfo?.target || targetInfo.target.name === playerStats.name;

          if (isSelf && auto.healExpression) {
              const expression = auto.healExpression || '';
              const maximize = hasHealingMaximization(playerStats);
              const rerollOnes = hasRerollHealingOnes(playerStats);
              const rollResult = maximize ? rollExpressionMaximized(expression) : rerollOnes ? rollExpression(expression, { rerollOnes: true }) : rollExpression(expression);
             if (!rollResult) return null;

             const bonusHeal = resolveHealingBonuses(playerStats, playerStats.proficiencyBonus || 0, playerStats.level || 1, slotLevel);
             const healAmount = rollResult.total + bonusHeal;

             const { newHp, maxHp, actualHeal } = applyHealingDirectly(playerStats, playerStats.name, healAmount, campaignName);

             logHealingToSSE(campaignName, {
                 targetName: playerStats.name,
                 sourceName: action.name,
                 actualHeal,
                 newHp,
                 maxHp,
             });

             const description = `Regained ${actualHeal} HP.`;
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

         const baseHeal = typeof auto.healAmount === 'number' ? auto.healAmount : null;
         const bonusHeal = resolveHealingBonuses(playerStats, playerStats.proficiencyBonus || 0, playerStats.level || 1, slotLevel);
         const totalHealAmount = baseHeal !== null ? baseHeal + bonusHeal : auto.healExpression;

         return {
             type: 'popup',
             payload: {
                 type: 'healing',
                 name: action.name,
                 healAmount: typeof totalHealAmount === 'number' ? totalHealAmount : auto.healExpression,
                 description: bonusHeal > 0
                     ? `${action.name}: Restores ${auto.healExpression} + ${bonusHeal} bonus HP`
                     : `${action.name}: Restores ${auto.healExpression} HP`,
                 },
             };
        } else {
         const baseHeal = typeof auto.healAmount === 'number' ? auto.healAmount : null;
         const bonusHeal = resolveHealingBonuses(playerStats, playerStats.proficiencyBonus || 0, playerStats.level || 1, slotLevel);
         const totalHealAmount = baseHeal !== null ? baseHeal + bonusHeal : auto.healExpression;

         return {
             type: 'popup',
             payload: {
                 type: 'healing',
                 name: action.name,
                 healAmount: typeof totalHealAmount === 'number' ? totalHealAmount : auto.healExpression,
                 description: bonusHeal > 0
                     ? `${action.name}: Restores ${auto.healExpression} + ${bonusHeal} bonus HP`
                     : `${action.name}: Restores ${auto.healExpression} HP`,
                 },
             };
        }
   }
