import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';

export const cantripBonuses = {
  name: 'cantripBonuses',
  condition: (ctx) => {
    const isCantrip = ctx.attack?.baseLevel === 0 || ctx.playerStats.spellAbilities?.spells?.some(s => s.name === ctx.attack?.name && s.level === 0);
    return isCantrip && !!ctx.playerStats.automation?.actions;
  },
  handler: async (ctx, prevData) => {
    const ps = ctx.playerStats;
    const isCantrip = ctx.attack?.baseLevel === 0 || ps.spellAbilities?.spells?.some(s => s.name === ctx.attack?.name && s.level === 0);
    if (!isCantrip) return null;

    const allA = [...(ps.automation.actions || []), ...(ps.automation.passives || [])];
    const upgradedCantrip = new Set(allA.filter(b => b.upgrades).map(b => b.upgrades));

    let formula = prevData.formula;
    let total = prevData.total;
    let rolls = [...prevData.rolls];

    for (const a of ps.automation.actions.filter(x => x.type === 'damage_bonus' && x.options?.length > 0).filter(b => !upgradedCantrip.has(b.name))) {
      const wis = ps.abilities?.find(x => x.name === 'Wisdom');
      const wisMod = Math.max(0, wis?.bonus || 0);
      if (wisMod > 0) { formula += ` + ${wisMod} [Cantrip]`; total += wisMod; }

      const thp = evaluateAutoExpression(a.tempHpExpression, ps);
      if (thp && !isNaN(thp)) {
        const cs = await getCombatContext(ctx.campaignName);
        const allies = cs?.creatures?.filter(c => c.type === 'player' || c.type === 'npc' || c.type === 'monster') || [];
        if (ctx.setSecondaryTargetModal && allies.length > 0) {
          return {
            data: { _cantripTempHp: thp },
            modal: { type: 'secondaryTarget', props: { title: 'Improved Blessed Strikes — Potent Spellcasting', targets: allies.map(c => ({ name: c.name, currentHp: c.currentHp, maxHp: c.maxHp, size: c.size, type: c.type })), confirmLabel: 'Grant Temp HP' } },
          };
        } else {
          const e = getRuntimeValue(ps.name, 'tempHp', ctx.campaignName) || 0;
          setRuntimeValue(ps.name, 'tempHp', Math.max(e, thp), ctx.campaignName);
        }
      }
    }

    return { data: { formula, total, rolls } };
  },
};
