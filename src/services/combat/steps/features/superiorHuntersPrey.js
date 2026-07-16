import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import { isDistanceInRange } from '../../../rules/combat/rangeCheck.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { addEntry } from '../../../ui/logService.js';

const MAX_RANGE_FEET = 30;

const resolveHp = (creature) => {
  if (!creature) return { currentHp: 0, maxHp: 0 };
  if (creature.type === 'player') {
    const currentHp = getRuntimeValue(creature.name, 'currentHitPoints') ?? getRuntimeValue(creature.name, 'hitPoints') ?? 0;
    const maxHp = getRuntimeValue(creature.name, 'hitPoints') ?? 0;
    return { currentHp, maxHp };
  }
  return { currentHp: creature.currentHp ?? creature.maxHp, maxHp: creature.maxHp };
};

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
    if (atk.concentration.target && atk.concentration.target !== ctx.targetName) return { data: prevData };

    const key = '_Superior_Hunters_Prey_UsedRound';
    const round = getCurrentCombatRound();
    if (getRuntimeValue(ctx.playerStats.name, key, ctx.campaignName) === round) return { data: prevData };

    const markedTarget = cs.creatures?.find(c => c.name === atk.concentration.target);
    if (!markedTarget) return { data: prevData };

    const isFoeSlayer = ctx.playerStats.class?.name === 'Ranger' && ctx.playerStats.level >= 20;
    const die = isFoeSlayer ? '1d10' : '1d6';

    const mapName = ctx.playerStats?.mapName;
    const hasMapPositions = mapName && markedTarget?.position;

    let targets = cs.creatures?.filter(c => c.name !== ctx.playerStats.name && c.name !== markedTarget.name) || [];

    if (hasMapPositions) {
      targets = targets
        .filter(c => c.position)
        .map(c => ({ ...c, distance: getDistanceFeet(markedTarget.position, c.position) }))
        .filter(c => c.distance !== null && isDistanceInRange(c.distance, MAX_RANGE_FEET));
    }

    targets = targets.map(c => ({ ...c, ...resolveHp(c) }));

    if (targets.length === 0) return { data: prevData };

    ctx.setSecondaryTargetModal?.({
      title: "Superior Hunter's Prey — Choose Second Target",
      targets,
      confirmLabel: 'Deal Damage',
      featureDescription: `Deal ${die} Force damage to a creature within ${MAX_RANGE_FEET} feet of the Hunter's Mark target. Once per turn.`,
      onTargetSelected: async (targetName) => {
        if (!targetName) return;

        const r = rollExpression(die);
        if (!r) {
          ctx.setSecondaryTargetModal?.(null);
          return;
        }

        const cs2 = await loadCombatSummary(ctx.campaignName);
        const characters = getRuntimeValue('characters', 'characters', ctx.campaignName) || [];
        const app = cs2 ? applyDamageToTarget(cs2, targetName, r.total, ['Force'], ctx.campaignName, characters, false, ctx.playerStats.name) : null;
        addEntry(ctx.campaignName, { type: 'roll', characterName: ctx.playerStats.name, rollType: 'damage', name: "Superior Hunter's Prey", formula: `${die} [Superior Hunters Prey]`, rolls: r.rolls, total: r.total, modifier: 0, damageType: 'Force', targetName, finalDamage: app?.finalDamage }).catch(() => {});
        if (app && ctx.setPopupHtml) {
          const target = cs.creatures?.find(c => c.name === targetName);
          ctx.setPopupHtml(prev => ({ ...prev, spreadTargetName: targetName, spreadFinalDamage: app.finalDamage, spreadTargetCurrentHp: app.newHp, spreadTargetMaxHp: target?.maxHp ?? 0 }));
        }

        ctx.setSecondaryTargetModal?.(null);
        setRuntimeValue(ctx.playerStats.name, key, round, ctx.campaignName);
      },
      onSkip: () => {
        ctx.setSecondaryTargetModal?.(null);
      },
    });

    return { data: prevData };
  },
};
