import { rollExpression } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

export const huntersMarkDamage = {
  name: 'huntersMarkDamage',
  condition: () => true,
  handler: async (ctx, prevData) => {
    const cs = await getCombatContext(ctx.campaignName);
    if (!cs) return { data: prevData };

    const atk = cs.creatures?.find(c => c.name === ctx.playerStats.name);
    if (atk?.concentration?.spell !== "Hunter's Mark") return { data: prevData };

    const isFoeSlayer = ctx.playerStats.class?.name === 'Ranger' && ctx.playerStats.level >= 20;
    const die = isFoeSlayer ? '1d10' : '1d6';

    const r = rollExpression(die);
    if (!r) return { data: prevData };

    const data = {
      formula: `${prevData.formula} + ${die} [Force]`,
      total: prevData.total + r.total,
      rolls: [...(prevData.rolls || []), ...r.rolls],
    };

    return { data };
  },
};
