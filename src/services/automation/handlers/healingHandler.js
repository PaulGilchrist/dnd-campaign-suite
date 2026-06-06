import { rollExpression } from '../../diceRoller.js';
import { getClassFeatures } from '../../classFeatures.js';
import { resolveTarget } from '../common/targetResolver.js';
import { applyHealingDirectly, logHealingToSSE } from '../common/healingRoll.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const isSelf = auto.type === 'self_healing';

    const expression = auto.healExpression || '';
    const isMonkHealing = expression.includes('martial_arts_die') && expression.includes('WIS');

    if (isMonkHealing) {
        const monkFeatures = getClassFeatures(playerStats);
        const martialArtsDie = monkFeatures?.martialArtsDie || 4;
        const wisdom = playerStats.abilities?.find(a => a.name === 'Wisdom');
        const wisModifier = wisdom?.bonus || 0;

        const rollResult = rollExpression(`1d${martialArtsDie}`);
        if (!rollResult) return null;

        const healAmount = rollResult.total + wisModifier;

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
                formula: `1d${martialArtsDie} + ${wisModifier}`,
                rolls: rollResult.rolls,
                bonus: wisModifier,
                healAmount,
                monkName: playerStats.name,
                targetName: isSelf ? playerStats.name : targetName,
                targetCurrentHp: newHp,
                targetMaxHp: maxHp,
                hasPhysiciansTouch,
                },
            };
      } else {
        const healAmount = auto.healAmount || auto.healExpression;

        return {
            type: 'popup',
            payload: {
                type: 'healing',
                name: action.name,
                healAmount: typeof healAmount === 'number' ? healAmount : auto.healExpression,
                description: `${action.name}: Restores ${auto.healExpression} HP`,
                },
            };
       }
   }
