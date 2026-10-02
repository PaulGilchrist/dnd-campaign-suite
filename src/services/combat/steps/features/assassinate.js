// @improved-by-ai
import { rollExpression } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { resolveDiceExpression, resolveNumericExpression } from '../../automation/automationExpressions.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

function inBonusWindow(ctx, cs, round) {
  // CLA-016: only when Sneak Attack actually applied dice to this attack
  if ((ctx.effectiveSneakDice || 0) <= 0) return false;
  if (round !== 1) return false;
  const pc = cs.creatures?.find(c => c.name === ctx.playerStats.name);
  return !pc?.hasActed;
}

export const assassinate = {
  name: 'assassinate',
  condition: (ctx) => !!ctx.playerStats.automation?.actions,
  handler: async (ctx, prevData) => {
    const a = ctx.playerStats.automation.actions.find(
      x => x.type === 'damage_bonus' && x.trigger === 'first_round_sneak_attack_hit'
    );
    if (!a) return null;

    const cs = await getCombatContext(ctx.campaignName);
    if (!cs) return null;
    const round = getCurrentCombatRound(ctx.campaignName);
    if (!inBonusWindow(ctx, cs, round)) return null;

    // Once per round: only the first qualifying sneak hit gets the bonus
    const latchKey = '_assassinate_usedRound';
    if (getRuntimeValue(ctx.playerStats.name, latchKey, ctx.campaignName) === round) return null;

    // CLA-016: token-resolve before rolling ("rogue_level" → flat number;
    // raw token reached rollExpression unparseable and the bonus was inert).
    const resolved = resolveDiceExpression(a.damageExpression, ctx.playerStats);
    const roll = rollExpression(resolved);
    const bonus = roll ? roll.total : resolveNumericExpression(a.damageExpression, ctx.playerStats);
    if (!(typeof bonus === 'number' && !isNaN(bonus) && bonus > 0)) return null;

    setRuntimeValue(ctx.playerStats.name, latchKey, round, ctx.campaignName);

    const damageType = a.damageType || 'Sneak Attack';
    const label = roll ? resolved : String(bonus);
    addEntry(ctx.campaignName, {
      type: 'ability_use',
      characterName: ctx.playerStats.name,
      abilityName: 'Assassinate',
      description: `Assassinate: +${bonus} [${damageType}] extra damage to ${ctx.targetName} (first-round sneak attack hit)`,
      targetName: ctx.targetName,
    }).catch((e) => { console.error('[assassinate:log-error]', e); });

    return {
      data: {
        formula: `${prevData.formula} + ${label} [${damageType}]`,
        total: prevData.total + bonus,
        rolls: [...(prevData.rolls || []), ...(roll?.rolls || [])],
      },
    };
  },
};
