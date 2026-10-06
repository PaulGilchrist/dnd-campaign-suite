import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';
import { addCondition } from '../../conditions/conditionSaveService.js';

// FT-036: Grappler (2024) "Punch and Grab" — when you hit a creature with an
// Unarmed Strike as part of the Attack action on your turn you can take the
// Damage AND grapple it, once per turn (no contest). Mirrors the verified
// unarmed on-hit rider lane (tavernBrawlerPush.js): same trigger shape
// (weaponType 'unarmed'), holder-keyed round latch, getTargetFromAttacker.
//
// Two RAW gates (see gatesRefusalReason) distinguish this from Tavern
// Brawler's plain push; latches clear at round wrap with the other
// PLAYER_ROUND_LATCH_KEYS.
//
// §70 residual: the grapple sustained-state / escape machine is untouched here
// (BA-002 owns the contested base-action grapple). This adds only the automatic
// on-hit grapple grant + its telemetry.
// Refusal convention (playbook §5): type 'automation' + <feature>_refused
// token + reason, zero effect.
function logRefusal(campaignName, attackerName, targetName, reason) {
  addEntry(campaignName, {
    type: 'automation',
    characterName: attackerName,
    automationType: 'grappler_refused',
    abilityName: 'Punch and Grab (Grappler)',
    note: 'grappler_refused',
    reason,
    description: `Punch and Grab refused (${reason})${targetName ? ` — no effect on ${targetName}.` : '.'}`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[grappler:log-error]', e); });
}

// Stamp source attribution on the granted condition's meta (MA-0801/MA-0855
// meta shape: activeConditionMeta[<cond-lowercase>] = {source, ...}).
function stampGrapplerMeta(targetName, campaignName) {
  const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
  const grappledMeta = existingMeta.grappled || {};
  if (grappledMeta.source === 'Grappler') return Promise.resolve();
  return setRuntimeValue(targetName, 'activeConditionMeta', {
    ...existingMeta,
    grappled: { ...grappledMeta, source: 'Grappler' },
  }, campaignName);
}

function findPunchGrabRider(ctx) {
  return (ctx.playerStats.automation?.passives || []).find(
    p => p.type === 'attack_rider' && p.trigger === 'unarmed_strike_hit' && p.effect === 'punch_and_grab'
  );
}

// RAW gates. Gate 1 — "part of the Attack action": the CLA-143 stamp is armed
// by non-BA rows only; the BA press stamp (armed by handleAttackClick's
// Bonus-Action branch) closes the post-Attack-action flurry resolution window,
// where armedRound already equals this round (normalizeAutoDamage flattens BA
// unarmed rows to type 'Action' at resolution). Gate 2 — once per turn:
// round-keyed holder latch (FT-074/FT-082 recipe).
function gatesRefusalReason(attackerName, campaignName, round) {
  const armedRound = Number(getRuntimeValue(attackerName, '_attackActionTakenRound', campaignName) ?? 0);
  const baStrikeRound = Number(getRuntimeValue(attackerName, '_bonusActionAttackRound', campaignName) ?? 0);
  if (armedRound !== round || baStrikeRound === round) return 'no_attack_action';
  if (getRuntimeValue(attackerName, '_Grappler_usedRound', campaignName) === round) return 'once_per_turn';
  return null;
}

export const grappler = {
  name: 'grappler',
  condition: (ctx) => ctx.attack?.weaponType === 'unarmed' && !!ctx.playerStats?.automation?.passives,
  handler: async (ctx, prevData) => {
    if (!findPunchGrabRider(ctx)) return null;

    const attackerName = ctx.playerStats.name;
    const campaignName = ctx.campaignName;
    const round = getCurrentCombatRound(campaignName);

    const refusal = gatesRefusalReason(attackerName, campaignName, round);
    if (refusal) {
      logRefusal(campaignName, attackerName, ctx.targetName || null, refusal);
      return { data: prevData };
    }

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, attackerName) : null;
    if (!target?.name) {
      logRefusal(campaignName, attackerName, ctx.targetName || null, 'no_target');
      return { data: prevData };
    }

    const result = addCondition({
      combatSummary: cs,
      creatureName: target.name,
      conditionDef: { key: 'grappled', label: 'Grappled' },
      getRuntimeValue,
      setRuntimeValue,
      campaignName,
      playerStats: ctx.playerStats,
    });

    if (result?.suppressed) {
      logRefusal(campaignName, attackerName, target.name, 'immune');
      return { data: prevData };
    }

    await stampGrapplerMeta(target.name, campaignName);
    await setRuntimeValue(attackerName, '_Grappler_usedRound', round, campaignName);

    addEntry(campaignName, {
      type: 'condition',
      characterName: target.name,
      action: 'applied',
      condition: 'Grappled',
      reason: `${attackerName}'s Punch and Grab (Grappler)`,
      timestamp: Date.now(),
    }).catch((e) => { console.error('[grappler:log-error]', e); });

    return { data: prevData };
  },
};
