import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

export const tavernBrawlerPush = {
  name: 'tavernBrawlerPush',
  condition: (ctx) => {
    return ctx.attack?.weaponType === 'unarmed' && !!ctx.playerStats.automation?.passives;
  },
  handler: async (ctx, prevData) => {
    const tbPush = (ctx.playerStats.automation?.passives || []).find(p => p.effect === 'tavern_brawler_push');
    if (!tbPush) return null;

    const key = '_Tavern_Brawler_Push_UsedRound';
    const round = getCurrentCombatRound();
    if (getRuntimeValue(ctx.playerStats.name, key, ctx.campaignName) === round) return { data: prevData };

    setRuntimeValue(ctx.playerStats.name, key, round, ctx.campaignName);
    const cs = await getCombatContext(ctx.campaignName);
    const t = cs ? getTargetFromAttacker(cs, ctx.playerStats.name) : null;
    if (t?.name) {
      const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
      setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: 'Tavern Brawler', effect: 'push', value: 5, duration: 'until_end_of_turn' }], ctx.campaignName);
    }
    return { data: prevData };
  },
};
