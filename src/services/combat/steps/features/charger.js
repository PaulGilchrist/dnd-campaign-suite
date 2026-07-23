import { checkOncePerTurn } from '../../../automation/common/oncePerTurn.js';

export const charger = {
  name: 'charger',
  condition: (ctx) => !!ctx.playerStats.automation?.passives,
  handler: async (ctx, prevData) => {
    const a = (ctx.playerStats.automation?.passives || []).find(
      p => p.type === 'attack_rider' && p.trigger === 'melee_hit_after_10ft_charge' && p.chooseOne
    );
    if (!a) return null;

    const usedKey = `_${a.name.replace(/\s+/g, '_')}_usedRound`;
    const skip = await checkOncePerTurn(a.name, usedKey, ctx.playerStats.name, ctx.campaignName);
    if (skip) {
      return { data: prevData };
    }

    return { data: prevData };
  },
};
