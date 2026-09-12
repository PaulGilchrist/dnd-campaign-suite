import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../../automation/common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { addCondition } from '../../conditions/conditionSaveService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

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

    // CLA-293: re-arm comes from LONG_REST_RESOURCES (restRules-constants.js)
    // nulling '_RendMind_Used' on long rest — the former '_LastLongRest'/
    // '_CurrentLongRest' reads had zero writers app-wide (dead code).
    const key = '_RendMind_Used';
    const active = getRuntimeValue(ps.name, key, ctx.campaignName);
    if (!active) {
      const dex = ps.abilities?.find(a => a.name === 'Dexterity');
      const dc = 8 + (dex?.bonus || 0) + (ps.proficiency || 0);
      const { promise } = createSaveListener(ctx.campaignName, { targetName: ctx.targetName, saveType: 'WIS', saveDc: dc });
      await setRuntimeValue(ps.name, key, true, ctx.campaignName);
      const sr = await promise;
      if (!sr.success) {
        const cs = await getCombatContext(ctx.campaignName);
        const conditionDef = { key: 'stunned', label: 'Stunned' };
        addCondition({ combatSummary: cs, creatureName: ctx.targetName, conditionDef, dc, ability: 'WIS', getRuntimeValue, setRuntimeValue, campaignName: ctx.campaignName, playerStats: ps });
      }
      addEntry(ctx.campaignName, { type: 'ability_use', characterName: ps.name, abilityName: 'Rend Mind', description: `Rend Mind triggered on ${ctx.targetName} — ${sr?.success ? 'succeeded' : 'failed'} WIS save (DC ${dc})${sr?.success ? '' : ' — Stunned condition applied'}`, targetName: ctx.targetName }).catch((e) => { console.error("[rendMind:log-error]", e); });
    }
    return { data: prevData };
  },
};
