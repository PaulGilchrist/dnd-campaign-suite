import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { checkOncePerTurnWithSkip, clearSkipFlag } from '../../../automation/common/oncePerTurn.js';
import { resolveMassFear } from '../../../automation/handlers/combat/massFearHandler.js';

export const stalkersFlurry = {
  name: 'stalkersFlurry',
  condition: (ctx) => !!ctx.playerStats.automation?.passives,
  handler: async (ctx, prevData) => {
    const sf = (ctx.playerStats.automation?.passives || []).find(
      a => a.type === 'attack_rider' && a.trigger === 'weapon_attack_hit' && a.chooseOne && a.options?.length > 0 && a.name === "Stalker's Flurry"
    );
    if (!sf) {
      console.log('[stalkersFlurry] No Stalker\'s Flurry passive found');
      return null;
    }

    const key = `_${sf.name.replace(/\s+/g, '_')}_usedRound`;
    const skipKey = `_${sf.name.replace(/\s+/g, '_')}_skippedRound`;
    const optKey = `_${sf.name.replace(/\s+/g, '_')}_option`;
    const cs = await getCombatContext(ctx.campaignName);
    const t = cs ? getTargetFromAttacker(cs, ctx.playerStats.name) : null;
    if (!t?.name) {
      console.log('[stalkersFlurry] No target found');
      return { data: prevData };
    }

    if (sf.oncePerTurn) {
      const skip = await checkOncePerTurnWithSkip(sf.name, key, skipKey, ctx.playerStats, ctx.campaignName);
      if (skip) {
        return { data: prevData };
      }
    }

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
        await resolveMassFear(ctx.campaignName, ctx.playerStats.name, effectTarget, opt, ctx.playerStats, null);
      }
    }

    return {
      data: prevData,
      sideEffects: async () => {
        if (sf.oncePerTurn) {
          const cs2 = await getCombatContext(ctx.campaignName);
          const round = cs2?.round || 1;
          setRuntimeValue(ctx.playerStats.name, key, round, ctx.campaignName);
        }
        await clearSkipFlag(skipKey, ctx.playerStats, ctx.campaignName);
        setRuntimeValue(ctx.playerStats.name, optKey, null, ctx.campaignName);
        setRuntimeValue(ctx.playerStats.name, 'stalkersFlurryChosenTarget', null, ctx.campaignName);
        setRuntimeValue(ctx.playerStats.name, 'stalkersFlurrySecondaryTargets', null, ctx.campaignName);
        setRuntimeValue(ctx.playerStats.name, 'stalkersFlurryPrimaryTarget', null, ctx.campaignName);
        setRuntimeValue(ctx.playerStats.name, 'stalkersFlurryOptions', null, ctx.campaignName);
      },
    };
  },
};
