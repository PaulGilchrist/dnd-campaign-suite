import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

export const savageAttacker = {
  name: 'savageAttacker',
  condition: (ctx) => {
    return (ctx.playerStats.automation?.passives || []).some(p => p.type === 'passive_rule' && p.effect === 'reroll_damage_once_per_turn')
      && !!ctx.attack?.damage;
  },
  handler: async (ctx, prevData) => {
    const sa = (ctx.playerStats.automation?.passives || []).find(p => p.type === 'passive_rule' && p.effect === 'reroll_damage_once_per_turn');
    if (!sa) return null;

    const key = `_${sa.name?.replace(/\s+/g, '_') || 'SavageAttacker'}_usedRound`;
    const round = getCurrentCombatRound();
    if (getRuntimeValue(ctx.playerStats.name, key, ctx.campaignName) === round) return { data: prevData };

    const m = ctx.attack.damage.match(/(\d+)d(\d+)/);
    if (!m || prevData.rolls.length === 0) return { data: prevData };

    const num = parseInt(m[1], 10);
    const ds = parseInt(m[2], 10);
    if (num <= 0 || ds <= 0 || num !== prevData.rolls.length) return { data: prevData };

    const first = prevData.rolls.reduce((s, r) => s + r, 0);
    const second = [];
    for (let i = 0; i < num; i++) second.push(Math.floor(Math.random() * ds) + 1);
    const secondTotal = second.reduce((s, r) => s + r, 0);

    if (secondTotal <= first) return { data: prevData };

    return {
      data: {
        formula: `${prevData.formula} [Savage Attacker]`,
        total: prevData.total + secondTotal - first,
        rolls: second,
      },
      sideEffects: async () => {
        setRuntimeValue(ctx.playerStats.name, key, round, ctx.campaignName);
      },
    };
  },
};
