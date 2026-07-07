import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

export const stealthAttackCost = {
  name: 'stealthAttackCost',
  condition: (ctx) => {
    const cost = getRuntimeValue(ctx.playerStats.name, 'stealthAttackCost', ctx.campaignName);
    return cost > 0;
  },
  handler: async (ctx, prevData) => {
    const cost = getRuntimeValue(ctx.playerStats.name, 'stealthAttackCost', ctx.campaignName);
    const cl = ctx.playerStats.class?.class_levels?.[ctx.playerStats.level - 1];
    const sd = cl?.sneak_attack_num_d6 || 0;
    if (sd >= cost) {
      if (cl) cl.sneak_attack_num_d6 = sd - cost;
      await setRuntimeValue(ctx.playerStats.name, 'stealthAttackCost', 0, ctx.campaignName);
    }
    return { data: prevData };
  },
};
