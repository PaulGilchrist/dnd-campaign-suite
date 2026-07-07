import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../../automation/common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';

export const rendMind = {
  name: 'rendMind',
  condition: (ctx) => {
    const effSneak = ctx.effectiveSneakDice || 0;
    const isPsychicBlade = ctx.attack?.name?.includes('Psychic Blade');
    return effSneak > 0 && isPsychicBlade && !!ctx.targetName;
  },
  handler: async (ctx, prevData) => {
    const ps = ctx.playerStats;
    const rendMind = (ps.automation?.passives || []).find(
      a => a.type === 'attack_rider' && a.trigger === 'psychic_blade_sneak_attack_hit' && a.saveType
    );
    if (!rendMind) return { data: prevData };

    const key = '_RendMind_Used';
    let active = getRuntimeValue(ps.name, key, ctx.campaignName);
    if (active) {
      const llr = getRuntimeValue(ps.name, '_LastLongRest', ctx.campaignName);
      const clr = getRuntimeValue(ps.name, '_CurrentLongRest', ctx.campaignName);
      if (llr !== clr) { await setRuntimeValue(ps.name, key, false, ctx.campaignName); active = false; }
    }
    if (!active) {
      const dex = ps.abilities?.find(a => a.name === 'Dexterity');
      const dc = 8 + (dex?.bonus || 0) + (ps.proficiency || 0);
      const { promise } = createSaveListener(ctx.campaignName, { targetName: ctx.targetName, saveType: 'WIS', saveDc: dc });
      await setRuntimeValue(ps.name, key, true, ctx.campaignName);
      const sr = await promise;
      if (!sr.success) {
        const conds = getRuntimeValue(ctx.targetName, 'activeConditions') || [];
        if (!conds.some(c => String(c).toLowerCase() === 'stunned'))
          await setRuntimeValue(ctx.targetName, 'activeConditions', [...conds, 'stunned'], ctx.campaignName);
      }
      addEntry(ctx.campaignName, { type: 'ability_use', characterName: ps.name, abilityName: 'Rend Mind', description: `Rend Mind triggered on ${ctx.targetName} — ${sr?.success ? 'succeeded' : 'failed'} WIS save (DC ${dc})${sr?.success ? '' : ' — Stunned condition applied'}`, targetName: ctx.targetName }).catch(() => {});
    }
    return { data: prevData };
  },
};
