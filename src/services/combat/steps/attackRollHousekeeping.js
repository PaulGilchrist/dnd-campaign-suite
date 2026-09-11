import { isForcecageBlocked } from '../../automation/handlers/spells/forcecageHandler.js';
import { isMazeBlocked } from '../../automation/handlers/spells/mazeHandler.js';
import { isBanishmentBlocked } from '../../automation/handlers/spells/banishmentHandler.js';
import { isImprisonmentBlocked } from '../../automation/handlers/spells/imprisonmentHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

const ATTACK_BLOCKERS = [
  { name: 'Forcecage', check: isForcecageBlocked, barrier: 'prison', popupBarrier: 'prison' },
  { name: 'Maze', check: isMazeBlocked, barrier: 'demiplane barrier', popupBarrier: 'demiplane' },
  { name: 'Banishment', check: isBanishmentBlocked, barrier: 'demiplane barrier', popupBarrier: 'demiplane' },
  { name: 'Imprisonment', check: isImprisonmentBlocked, barrier: 'barrier', popupBarrier: 'prison' },
];

function blockAttackBy(ctx, blocker) {
  const description = `${ctx.playerStats.name}'s attack on ${ctx.targetName} is blocked by ${blocker.name} — they are on opposite sides of the ${blocker.barrier}.`;
  addEntry(ctx.campaignName, {
    type: 'automation',
    creatureName: ctx.playerStats.name,
    name: blocker.name,
    description,
    timestamp: Date.now(),
  }).catch((e) => { console.error("[attackRollHousekeeping:log-error]", e); });
  ctx.setPopupHtml?.({
    type: 'automation_info',
    name: blocker.name,
    description: `${ctx.playerStats.name}'s attack on ${ctx.targetName} is blocked by ${blocker.name}. No attack, spell, or effect can pass between inside and outside the ${blocker.popupBarrier}.`,
  });
  return null;
}

function findAttackBlocker(ctx) {
  if (!ctx.targetName) return null;
  return ATTACK_BLOCKERS.find(b => b.check(ctx.playerStats.name, ctx.targetName, ctx.campaignName)) || null;
}

function clearStalkersFlurryKeys(ctx) {
  const sfOptKey = `_${"Stalker's Flurry".replace(/\s+/g, '_')}_option`;
  setRuntimeValue(ctx.playerStats.name, sfOptKey, null, ctx.campaignName);
  setRuntimeValue(ctx.playerStats.name, 'stalkersFlurryChosenTarget', null, ctx.campaignName);
  setRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrike', null, ctx.campaignName);
  setRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrikeTarget', null, ctx.campaignName);
}

function applyHuntersPreyHousekeeping(ctx, isBonus) {
  if (ctx.attack?.name === 'Horde Breaker' && isBonus) {
    const choice = getRuntimeValue(ctx.playerStats.name, "_Hunter's_Prey_choice", ctx.campaignName);
    if (choice === 'Horde Breaker') {
      setRuntimeValue(ctx.playerStats.name, '_Hunters_Prey_HordeBreaker_UsedRound', getCurrentCombatRound(), ctx.campaignName);
    }
    return;
  }

  if (!isBonus && ctx.attack?.weaponType === 'melee' && !ctx.attack?.saveDc && ctx.attack?.name !== 'Horde Breaker' && ctx.targetName) {
    const hbChoice = getRuntimeValue(ctx.playerStats.name, "_Hunter's_Prey_choice", ctx.campaignName);
    const lastAttack = getRuntimeValue('campaign', 'lastAttack', ctx.campaignName);
    if (hbChoice === 'Horde Breaker' && lastAttack?.hit && lastAttack.attackerName === ctx.playerStats.name && lastAttack.weaponType === 'melee') {
      setRuntimeValue(ctx.playerStats.name, '_Hunters_Prey_HordeBreaker_Ready', {
        round: getCurrentCombatRound(),
        targetName: lastAttack.targetName,
        attackName: lastAttack.attackName,
      }, ctx.campaignName);
    }
  }
}

export function buildHousekeepingStep() {
  return {
    name: 'housekeeping',
    subscribe: 'housekeeping:do',
    emit: 'maneuvers:check',
    condition: () => true,
    handler: async (ctx) => {
      const blocker = findAttackBlocker(ctx);
      if (blocker) return blockAttackBy(ctx, blocker);

      clearStalkersFlurryKeys(ctx);

      const isBonus = ctx.attack?.type === 'Bonus Action';
      applyHuntersPreyHousekeeping(ctx, isBonus);
      return { data: { isBonusActionAttack: isBonus } };
    },
  };
}
