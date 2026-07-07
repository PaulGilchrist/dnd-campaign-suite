import { rollExpression } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

export const assassinate = {
  name: 'assassinate',
  condition: (ctx) => !!ctx.playerStats.automation?.actions,
  handler: async (ctx, prevData) => {
    const a = ctx.playerStats.automation.actions.find(
      x => x.type === 'damage_bonus' && x.trigger === 'first_round_sneak_attack_hit'
    );
    if (!a) return null;

    const cs = await getCombatContext(ctx.campaignName);
    if (!cs || getCurrentCombatRound() !== 1) return null;
    const pc = cs.creatures?.find(c => c.name === ctx.playerStats.name);
    if (pc?.hasActed) return null;

    const r = rollExpression(a.damageExpression);
    if (!r) return null;

    return {
      data: {
        formula: `${prevData.formula} + ${a.damageExpression} [${a.damageType || 'Sneak Attack'}]`,
        total: prevData.total + r.total,
        rolls: [...prevData.rolls, ...r.rolls],
      },
    };
  },
};
