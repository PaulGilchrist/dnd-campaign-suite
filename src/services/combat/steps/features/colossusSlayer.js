import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

export const colossusSlayer = {
  name: 'colossusSlayer',
  condition: (ctx) => {
    return getRuntimeValue(ctx.playerStats.name, "_Hunter's_Prey_choice", ctx.campaignName) === 'Colossus Slayer';
  },
  handler: async (ctx, prevData) => {
    const cs = await getCombatContext(ctx.campaignName);
    const t = cs ? getTargetFromAttacker(cs, ctx.playerStats.name) : null;
    if (!t || t.currentHp == null || t.maxHp == null || t.currentHp >= t.maxHp) return { data: prevData };

    const key = '_Hunters_Prey_Colossus_UsedRound';
    if (getRuntimeValue(ctx.playerStats.name, key, ctx.campaignName) === getCurrentCombatRound(ctx.campaignName)) return { data: prevData };

    const r = rollExpression('1d8');
    if (!r) return { data: prevData };

    return {
      data: {
        formula: `${prevData.formula} + 1d8 [extra]`,
        total: prevData.total + r.total,
        rolls: [...prevData.rolls, ...r.rolls],
      },
      sideEffects: async () => {
        setRuntimeValue(ctx.playerStats.name, key, getCurrentCombatRound(ctx.campaignName), ctx.campaignName);
        // Self-log mandate (#1050): every automation logs its trigger with the
        // event details. Sibling dice-append riders self-log in sideEffects
        // after the latch stamp (epitomeEmpoweredStrikes.js:30-39) — the
        // featureRiders dispatcher (attackRollPostDamage.js:35-45) stays pure
        // routing and never logs for its modules.
        addEntry(ctx.campaignName, {
          type: 'ability_use',
          characterName: ctx.playerStats.name,
          abilityName: 'Colossus Slayer',
          description: `${ctx.playerStats.name} used Colossus Slayer on ${t.name} — +1d8 extra damage rolled ${r.total} [${r.rolls.join(', ')}] (target below HP maximum ${t.currentHp}/${t.maxHp}, once per turn).`,
          targetName: t.name,
        }).catch((e) => { console.error("[colossusSlayer:log-error]", e); });
      },
    };
  },
};
