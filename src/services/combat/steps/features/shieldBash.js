import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { parseMagicItemName } from '../../../rules/core/attackCalc.js';

export const shieldBash = {
  name: 'shieldBash',
  condition: (ctx) => !!ctx.playerStats.automation?.passives,
  handler: async (ctx, prevData) => {
    const a = (ctx.playerStats.automation?.passives || []).find(
      p => p.type === 'attack_rider' && p.trigger === 'melee_hit_with_shield_equipped' && p.options?.length > 0
    );
    if (!a) return null;

    const hasShield = ctx.playerStats.inventory?.equipped?.some(itemName => {
      const { baseName } = parseMagicItemName(itemName);
      return ctx.playerStats.equipment?.find(e => e.name === baseName)?.equipment_category === 'Shield';
    });
    if (!hasShield) return { data: prevData };

    const key = `_${a.name.replace(/\s+/g, '_')}_usedRound`;
    const round = getCurrentCombatRound();
    if (getRuntimeValue(ctx.playerStats.name, key, ctx.campaignName) === round) return { data: prevData };

    const cs = await getCombatContext(ctx.campaignName);
    const t = cs ? getTargetFromAttacker(cs, ctx.playerStats.name) : null;
    if (!t?.name) return { data: prevData };

    const o = a.options[0];
    const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
    setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: a.name, option: o.name, effect: o.effect, value: o.value || null, sizeLimit: o.sizeLimit || null, noOpportunityAttacks: o.noOpportunityAttacks || false, duration: 'until_start_of_next_turn', saveType: o.saveType || null, saveDc: o.saveDc || null, saveAbility: o.saveAbility || null, condition: o.condition || null, repeatingSave: !!o.repeatingSave }], ctx.campaignName);
    setRuntimeValue(ctx.playerStats.name, key, round, ctx.campaignName);
    return { data: prevData };
  },
};
