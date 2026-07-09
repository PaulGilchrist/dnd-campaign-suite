import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

export const stalkersFlurry = {
  name: 'stalkersFlurry',
  condition: (ctx) => !!ctx.playerStats.automation?.passives,
  handler: async (ctx, prevData) => {
    const sf = (ctx.playerStats.automation?.passives || []).find(
      a => a.type === 'attack_rider' && a.trigger === 'weapon_attack_hit' && a.chooseOne && a.options?.length > 0 && a.name === "Stalker's Flurry"
    );
    if (!sf) return null;

    const key = `_${sf.name.replace(/\s+/g, '_')}_usedRound`;
    const skipKey = `_${sf.name.replace(/\s+/g, '_')}_skippedRound`;
    const round = getCurrentCombatRound();
    if (sf.oncePerTurn && (getRuntimeValue(ctx.playerStats.name, key, ctx.campaignName) === round || getRuntimeValue(ctx.playerStats.name, skipKey, ctx.campaignName) === round)) return { data: prevData };

    const cs = await getCombatContext(ctx.campaignName);
    const t = cs ? getTargetFromAttacker(cs, ctx.playerStats.name) : null;
    if (!t?.name) return { data: prevData };

    const optKey = `_${sf.name.replace(/\s+/g, '_')}_option`;
    const chosen = getRuntimeValue(ctx.playerStats.name, optKey, ctx.campaignName);
    const secondaryTarget = getRuntimeValue(ctx.playerStats.name, 'stalkersFlurryChosenTarget', ctx.campaignName);
    const effectTarget = secondaryTarget || t.name;
    if (!chosen) {
      ctx.setAttackRiderModal?.({ action: sf, playerStats: ctx.playerStats, campaignName: ctx.campaignName, targetName: t.name });
      return {
        modal: { type: 'stalkersFlurry', props: { action: sf, playerStats: ctx.playerStats, campaignName: ctx.campaignName, targetName: t.name } },
      };
    }

    const opt = sf.options.find(o => o.name === chosen);
    if (opt) {
      if (opt.effect === 'sudden_strike') {
        setRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrike', true, ctx.campaignName);
        if (secondaryTarget) {
          setRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrikeTarget', secondaryTarget, ctx.campaignName);
        }
      }
      else if (opt.effect === 'mass_fear') {
        const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
        setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: effectTarget, source: sf.name, option: opt.name, effect: 'mass_fear', saveType: opt.saveType || 'WIS', saveDc: opt.saveDc || 'ability', saveAbility: opt.saveAbility || 'WIS', condition: opt.condition || 'frightened', duration: opt.duration || 'until_start_of_next_turn', range: opt.range || '10_ft' }], ctx.campaignName);
      }
    }

    return {
      data: prevData,
      sideEffects: async () => {
        if (sf.oncePerTurn) setRuntimeValue(ctx.playerStats.name, key, round, ctx.campaignName);
        const skipKey = `_${sf.name.replace(/\s+/g, '_')}_skippedRound`;
        setRuntimeValue(ctx.playerStats.name, skipKey, null, ctx.campaignName);
        setRuntimeValue(ctx.playerStats.name, 'stalkersFlurryChosenTarget', null, ctx.campaignName);
        setRuntimeValue(ctx.playerStats.name, 'stalkersFlurrySecondaryTargets', null, ctx.campaignName);
        setRuntimeValue(ctx.playerStats.name, 'stalkersFlurryPrimaryTarget', null, ctx.campaignName);
        setRuntimeValue(ctx.playerStats.name, 'stalkersFlurryOptions', null, ctx.campaignName);
      },
    };
  },
};
