import { rollExpression } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

export const hexDamage = {
  name: 'hexDamage',
  condition: () => true,
  handler: async (ctx, prevData) => {
    const cs = await getCombatContext(ctx.campaignName);
    if (!cs) return { data: prevData };

    const atk = cs.creatures?.find(c => c.name === ctx.playerStats.name);
    if (atk?.concentration?.spell !== 'Hex') return { data: prevData };

    // Only apply damage if the attack target matches the Hex target
    if (atk.concentration.target && atk.concentration.target !== ctx.targetName) return { data: prevData };

    const r = rollExpression('1d6');
    if (!r) return { data: prevData };

    const data = {
      formula: `${prevData.formula} + 1d6 [Necrotic]`,
      total: prevData.total + r.total,
      rolls: [...(prevData.rolls || []), ...r.rolls],
    };

    return { data };
  },
};
