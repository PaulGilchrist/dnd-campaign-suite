import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

export const slasher = {
  name: 'slasher',
  condition: (ctx) => {
    const isSlashing = (ctx.attack?.damageType || '').toLowerCase() === 'slashing';
    return isSlashing && !!ctx.playerStats.automation?.passives;
  },
  handler: async (ctx, prevData) => {
    const isSlashing = (ctx.attack?.damageType || '').toLowerCase() === 'slashing';
    const ps = ctx.playerStats;
    const slasherFeat = (ps.automation?.passives || []).find(a => a.type === 'attack_rider' && a.trigger === 'slashing_damage_hit' && a.oncePerTurn);
    if (slasherFeat && isSlashing) {
      const key = `_${slasherFeat.name.replace(/\s+/g, '_')}_usedRound`;
      const round = getCurrentCombatRound();
      if (getRuntimeValue(ps.name, key, ctx.campaignName) !== round) {
        const cs = await getCombatContext(ctx.campaignName);
        const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
        if (t?.name && slasherFeat.options?.length > 0) {
          const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
          setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: slasherFeat.name, option: slasherFeat.options[0].name, effect: slasherFeat.options[0].effect, value: slasherFeat.options[0].value || 10, duration: 'until_start_of_next_turn' }], ctx.campaignName);
          setRuntimeValue(ps.name, key, round, ctx.campaignName);
        }
      }
    }

    // Slasher crit effect: disadvantage on next attack
    if (isSlashing && ctx.isCrit && ps.automation?.passives) {
      const sc = ps.automation.passives.find(a => a.type === 'conditional_advantage' && a.trigger === 'critical_hit_slashing');
      if (sc) {
        const cs = await getCombatContext(ctx.campaignName);
        const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
        if (t?.name) {
          const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
          setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: sc.name, effect: 'disadvantage_next_attack', duration: 'until_start_of_next_turn' }], ctx.campaignName);
        }
      }
    }

    return { data: prevData };
  },
};
