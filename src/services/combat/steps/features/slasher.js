import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

export const slasher = {
  name: 'slasher',
  condition: (ctx) => {
    const isSlashing = (ctx.attack?.damageType || '').toLowerCase() === 'slashing';
    return isSlashing && !!ctx.playerStats.automation?.passives;
  },
  handler: async (ctx, prevData) => {
    const isSlashing = (ctx.attack?.damageType || '').toLowerCase() === 'slashing';
    const ps = ctx.playerStats;

    // Slasher crit effect: target has Disadvantage on all attack rolls until start of attacker's next turn
    if (isSlashing && ctx.isCrit && ps.automation?.passives) {
      const sc = ps.automation.passives.find(a => a.type === 'conditional_advantage' && a.trigger === 'critical_hit_slashing');
      if (sc) {
        const cs = await getCombatContext(ctx.campaignName);
        const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
        if (t?.name) {
          const effs = getRuntimeValue('campaign', 'targetEffects') || [];
          setRuntimeValue('campaign', 'targetEffects', [...effs, { target: t.name, source: sc.name, effect: 'slasher_enhanced_critical', duration: 'until_start_of_next_turn' }], ctx.campaignName);
          addExpiration({ attackerName: ps.name, targetName: t.name, effects: [
            { type: 'remove_target_effect', effectKey: 'slasher_enhanced_critical', source: sc.name }
          ], campaignName: ctx.campaignName, rounds: undefined, expireOnCreatureName: ps.name });

          await addEntry(ctx.campaignName, {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: sc.name,
            description: `${ps.name} scored a critical hit with slashing damage on ${t.name}. ${t.name} has Disadvantage on attack rolls until the start of ${ps.name}'s next turn.`,
          }).catch((e) => { console.error('[slasher] Error logging:', e); });
        }
      }
    }

    return { data: prevData };
  },
};
