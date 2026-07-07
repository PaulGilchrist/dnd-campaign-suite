import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

export const charger = {
  name: 'charger',
  condition: (ctx) => !!ctx.playerStats.automation?.passives,
  handler: async (ctx, prevData) => {
    const a = (ctx.playerStats.automation?.passives || []).find(
      p => p.type === 'attack_rider' && p.trigger === 'melee_hit_after_10ft_charge' && p.chooseOne
    );
    if (!a) return null;

    const key = `_${a.name.replace(/\s+/g, '_')}_usedRound`;
    const round = getCurrentCombatRound();
    if (getRuntimeValue(ctx.playerStats.name, key, ctx.campaignName) === round) return { data: prevData };

    const cs = await getCombatContext(ctx.campaignName);
    const t = cs ? getTargetFromAttacker(cs, ctx.playerStats.name) : null;
    if (!t?.name || !a.options?.length) return { data: prevData };

    const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
    setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: a.name, option: a.options[0].name, effect: a.options[0].effect, value: a.options[0].value || null, sizeLimit: a.options[0].sizeLimit || null, noOpportunityAttacks: a.options[0].noOpportunityAttacks || false, duration: 'until_start_of_next_turn' }], ctx.campaignName);
    setRuntimeValue(ctx.playerStats.name, key, round, ctx.campaignName);
    return { data: prevData };
  },
};
