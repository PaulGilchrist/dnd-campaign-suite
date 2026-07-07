import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { addEntry } from '../../../ui/logService.js';

export const superiorHuntersPrey = {
  name: 'superiorHuntersPrey',
  condition: (ctx) => {
    return (ctx.playerStats.automation?.passives || []).some(p => p.type === 'superior_hunter_prey');
  },
  handler: async (ctx, prevData) => {
    const cs = await getCombatContext(ctx.campaignName);
    if (!cs) return { data: prevData };

    const atk = cs.creatures?.find(c => c.name === ctx.playerStats.name);
    if (atk?.concentration?.spell !== "Hunter's Mark") return { data: prevData };

    const key = '_Superior_Hunters_Prey_UsedRound';
    const round = getCurrentCombatRound();
    if (getRuntimeValue(ctx.playerStats.name, key, ctx.campaignName) === round) return { data: prevData };

    const r = rollExpression('1d6');
    if (!r) return { data: prevData };

    const primary = getTargetFromAttacker(cs, ctx.playerStats.name)?.name;
    const targets = cs.creatures?.filter(c => c.name !== primary && c.type === 'npc') || [];
    if (targets.length === 0) return { data: prevData };

    const st = targets[0];
    const cs2 = await loadCombatSummary(ctx.campaignName);
    const app = cs2 ? applyDamageToTarget(cs2, st.name, r.total, ['Force'], ctx.campaignName, null, false, ctx.playerStats.name) : null;
    addEntry(ctx.campaignName, { type: 'roll', characterName: ctx.playerStats.name, rollType: 'damage', name: "Superior Hunter's Prey", formula: '1d6 [Superior Hunters Prey]', rolls: r.rolls, total: r.total, modifier: 0, damageType: 'Force', targetName: st.name, finalDamage: app?.finalDamage }).catch(() => {});
    if (app && ctx.setPopupHtml) {
      ctx.setPopupHtml(prev => ({ ...prev, spreadTargetName: st.name, spreadFinalDamage: app.finalDamage, spreadTargetCurrentHp: app.newHp, spreadTargetMaxHp: st.type === 'player' ? (getRuntimeValue(st.name, 'hitPoints') ?? 0) : st.maxHp }));
    }

    return {
      data: prevData,
      sideEffects: async () => {
        setRuntimeValue(ctx.playerStats.name, key, round, ctx.campaignName);
      },
    };
  },
};
