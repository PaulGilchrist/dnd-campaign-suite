import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

export const crusher = {
  name: 'crusher',
  condition: (ctx) => {
    const isBludgeoning = (ctx.attack?.damageType || '').toLowerCase() === 'bludgeoning';
    return isBludgeoning && !!ctx.playerStats.automation?.passives;
  },
  handler: async (ctx, prevData) => {
    const isBludgeoning = (ctx.attack?.damageType || '').toLowerCase() === 'bludgeoning';
    const ps = ctx.playerStats;
    const crusherFeat = (ps.automation?.passives || []).find(a => a.type === 'attack_rider' && a.trigger === 'bludgeoning_damage_hit' && a.oncePerTurn);
    if (crusherFeat && isBludgeoning) {
      const key = `_${crusherFeat.name.replace(/\s+/g, '_')}_usedRound`;
      const round = getCurrentCombatRound();
      if (getRuntimeValue(ps.name, key, ctx.campaignName) !== round) {
        const cs = await getCombatContext(ctx.campaignName);
        const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
        if (t?.name && crusherFeat.options?.length > 0) {
          const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
          setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: crusherFeat.name, option: crusherFeat.options[0].name, effect: crusherFeat.options[0].effect, value: crusherFeat.options[0].value || null, sizeLimit: crusherFeat.options[0].sizeLimit || null, noOpportunityAttacks: crusherFeat.options[0].noOpportunityAttacks || false, duration: 'until_start_of_next_turn' }], ctx.campaignName);
          setRuntimeValue(ps.name, key, round, ctx.campaignName);
        }
      }
    }

    // Crusher crit effect: advantage on attack rolls until next turn
    if (ctx.isCrit && ps.automation?.passives) {
      const cc = ps.automation.passives.find(a => a.type === 'conditional_advantage' && a.trigger === 'critical_hit_bludgeoning');
      if (cc) {
        const cs = await getCombatContext(ctx.campaignName);
        const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
        if (t?.name) {
          const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
          setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: cc.name, effect: 'crusher_enhanced_critical', duration: 'until_start_of_next_turn' }], ctx.campaignName);
          addExpiration(ps.name, t.name, [
            { type: 'remove_target_effect', effectKey: 'crusher_enhanced_critical', source: cc.name }
          ], ctx.campaignName, undefined, ps.name);
          await addEntry(ctx.campaignName, {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: cc.name,
            description: `${ps.name} scored a critical hit with bludgeoning damage on ${t.name}. Attack rolls against ${t.name} have Advantage until the start of ${ps.name}'s next turn.`,
          }).catch((e) => { console.error('[crusher] Error logging:', e); });
        }
      }
    }

    return { data: prevData };
  },
};
