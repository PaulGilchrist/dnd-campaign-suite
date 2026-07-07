import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

export const piercer = {
  name: 'piercer',
  condition: (ctx) => {
    const isPiercing = (ctx.attack?.damageType || '').toLowerCase() === 'piercing';
    return isPiercing && !!ctx.playerStats.automation?.passives;
  },
  handler: async (ctx, prevData) => {
    const isPiercing = (ctx.attack?.damageType || '').toLowerCase() === 'piercing';
    const ps = ctx.playerStats;
    let rolls = [...prevData.rolls];
    let total = prevData.total;
    let formula = prevData.formula;

    const piercerFeat = (ps.automation?.passives || []).find(a => a.type === 'attack_rider' && a.trigger === 'piercing_damage_hit' && a.oncePerTurn);
    if (piercerFeat && isPiercing) {
      const key = `_${piercerFeat.name.replace(/\s+/g, '_')}_usedRound`;
      const round = getCurrentCombatRound();
      if (getRuntimeValue(ps.name, key, ctx.campaignName) !== round) {
        const cnt = piercerFeat.rerollCount || 1;
        for (let i = 0; i < Math.min(cnt, rolls.length); i++) {
          if (rolls.length > 0) {
            let maxIdx = 0;
            for (let j = 1; j < rolls.length; j++) { if (rolls[j] > rolls[maxIdx]) maxIdx = j; }
            const orig = rolls[maxIdx];
            const rv = Math.floor(Math.random() * 6) + 1;
            rolls[maxIdx] = rv;
            total += rv - orig;
          }
        }
        formula += ' [Piercer Reroll]';
        return {
          data: { formula, total, rolls },
          sideEffects: async () => {
            setRuntimeValue(ps.name, key, round, ctx.campaignName);
          },
        };
      }
    }

    // Piercer crit bonus die
    if (isPiercing && ctx.isCrit && ctx.attack?.damage && ps.automation?.passives) {
      const pc = ps.automation.passives.find(a => a.type === 'damage_bonus' && a.trigger === 'critical_hit_piercing');
      if (pc) {
        const m = ctx.attack.damage.match(/(\d+)d(\d+)/);
        if (m) {
          const ds = parseInt(m[2], 10);
          const ev = Math.floor(Math.random() * ds) + 1;
          formula += ` + 1 [${ctx.attack.damageType}]`;
          total += ev;
          rolls = [...rolls, ev];
          return { data: { formula, total, rolls } };
        }
      }
    }

    return { data: prevData };
  },
};
