import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

export const eldritchStrikes = {
  name: 'eldritchStrikes',
  condition: (ctx) => !!ctx.playerStats.automation?.actions || !!ctx.playerStats.automation?.passives,
  handler: async (ctx, prevData) => {
    const riders = [...(ctx.playerStats.automation?.actions || []), ...(ctx.playerStats.automation?.passives || [])].filter(
      a => a.type === 'attack_rider' && a.trigger === 'weapon_attack_hit' && !a.damageExpression && a.name !== "Stalker's Flurry"
    );
    if (riders.length === 0) return null;

    for (const rider of riders) {
      const key = `_${rider.name.replace(/\s+/g, '_')}_usedRound`;
      const round = getCurrentCombatRound();
      if (rider.oncePerTurn && getRuntimeValue(ctx.playerStats.name, key, ctx.campaignName) === round) continue;

      const cs = await getCombatContext(ctx.campaignName);
      const t = cs ? getTargetFromAttacker(cs, ctx.playerStats.name) : null;
      if (t?.name && rider.options?.length > 0) {
        const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
        setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: rider.name, option: rider.options[0].name, effect: rider.options[0].effect, value: rider.options[0].value || null, noOpportunityAttacks: rider.options[0].noOpportunityAttacks || false, duration: 'until_start_of_next_turn' }], ctx.campaignName);
        if (rider.oncePerTurn) setRuntimeValue(ctx.playerStats.name, key, round, ctx.campaignName);
        addEntry(ctx.campaignName, { type: 'ability_use', characterName: ctx.playerStats.name, abilityName: rider.name, description: `${ctx.playerStats.name} used ${rider.name} on ${t.name}, imposing Disadvantage on the target's next saving throw.`, targetName: t.name }).catch(() => {});
      }
    }
    return { data: prevData };
  },
};
