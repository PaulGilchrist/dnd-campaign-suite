import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

function findEldritchStrikeRiders(playerStats) {
  const riders = [...(playerStats.automation?.actions || []), ...(playerStats.automation?.passives || [])];
  return riders.filter(
    a => a.type === 'attack_rider' && a.trigger === 'weapon_attack_hit' && !a.damageExpression && a.name !== "Stalker's Flurry"
  );
}

function buildStrikeTargetEffect(targetName, rider) {
  const option = rider.options[0];
  return { target: targetName, source: rider.name, option: option.name, effect: option.effect, value: option.value || null, noOpportunityAttacks: option.noOpportunityAttacks || false, duration: 'until_start_of_next_turn' };
}

export const eldritchStrikes = {
  name: 'eldritchStrikes',
  condition: (ctx) => !!ctx.playerStats.automation?.actions || !!ctx.playerStats.automation?.passives,
  handler: async (ctx, prevData) => {
    const riders = findEldritchStrikeRiders(ctx.playerStats);
    if (riders.length === 0) return null;

    for (const rider of riders) {
      const key = `_${rider.name.replace(/\s+/g, '_')}_usedRound`;
      const round = getCurrentCombatRound(ctx.campaignName);
      if (rider.oncePerTurn && getRuntimeValue(ctx.playerStats.name, key, ctx.campaignName) === round) continue;

      const cs = await getCombatContext(ctx.campaignName);
      const t = cs ? getTargetFromAttacker(cs, ctx.playerStats.name) : null;
      if (t?.name && rider.options?.length > 0) {
        const effs = getRuntimeValue('campaign', 'targetEffects') || [];
        setRuntimeValue('campaign', 'targetEffects', [...effs, buildStrikeTargetEffect(t.name, rider)], ctx.campaignName);
        if (rider.oncePerTurn) setRuntimeValue(ctx.playerStats.name, key, round, ctx.campaignName);
        addEntry(ctx.campaignName, { type: 'ability_use', characterName: ctx.playerStats.name, abilityName: rider.name, description: `${ctx.playerStats.name} used ${rider.name} on ${t.name}, imposing Disadvantage on the target's next saving throw.`, targetName: t.name }).catch((e) => { console.error("[eldritchStrikes:log-error]", e); });
      }
    }
    return { data: prevData };
  },
};
