import { rollExpression, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { getClassFeatures } from '../../character/classFeatures.js';
import { resolveTarget } from '../common/targetResolver.js';
import { applyHealingDirectly, logHealingToSSE } from '../common/healingRoll.js';
import { resolveHealingBonuses, hasHealingMaximization } from '../../combat/automationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

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
        const rollResult = maximize ? rollExpressionMaximized(`1d${martialArtsDie}`) : rollExpression(`1d${martialArtsDie}`);
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
                },
            };
      } else if (isSelf && auto.healExpression) {
        let resolvedExpression = auto.healExpression
            .replace(/\bfighter level\b/gi, String(playerStats.level || 1));

        const maximize = hasHealingMaximization(playerStats);
        const rollResult = maximize ? rollExpressionMaximized(resolvedExpression) : rollExpression(resolvedExpression);
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

        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        const maxSW = classLevel?.second_wind || 0;
        const currentUses = Number(getRuntimeValue(playerStats.name, 'secondWindUses', campaignName) ?? maxSW);
        if (currentUses > 0) {
            await setRuntimeValue(playerStats.name, 'secondWindUses', currentUses - 1, campaignName, true);
        }

        const remainingUses = Math.max(0, currentUses - 1);
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
