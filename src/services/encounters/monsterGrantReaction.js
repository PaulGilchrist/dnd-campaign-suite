// MA-0882: monster-side grant-reaction affordance for actions[] rows authored
// automation:{type:"monster_grant_reaction", effect:"incite_rampage", range_ft:60}
// (Gnoll Pack Lord "Incite Rampage" — formerly a zero-affordance inert row with
// cosmetic <em> (5-6)</em> recharge text only). Mirrors the MA-0648 monsterSummon /
// MA-0655 monsterSelfBuff registration style.
// One chip click = recharge gate FIRST (live MA-0031 monsterRechargeGate: a spent
// row refuses with popup + `incite_rampage_refused` (not recharged) log, zero
// grant) → armed-target resolution via the GM-armed targetName seam
// (getTargetFromAttacker — RAW targets ANOTHER creature it can see ≤60 ft, so a
// missing or self-armed target refuses zero-spend) → already-incited refusal on
// the target zero-spend → spendMonsterRecharge FIRST (double-spend guard,
// ability_use log) → register te `incite_rampage` ON THE TARGET with ONE
// rounds:1 addExpiration clock (the reaction window clears next round) → grant log
// "can take a Reaction to make one melee attack (GM-enforced)". The "has the
// Rampage Bonus Action" prerequisite has no per-creature bonus-action-ownership
// consumer (§70-class), so it rides the grant log + popup as honest advisory copy;
// gridless 60-ft range is GM-enforced (§42 advisory). Turn-start d6 5-6 recovery
// rides the existing rollMonsterRecharges seam untouched.
import { addEntry } from '../ui/logService.js';
import { registerTargetEffect, getActiveTargetEffect } from '../combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../rules/effects/expirations.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../rules/combat/damageUtils.js';
import { MONSTER_RECHARGE_KEY, monsterRechargeGate, spendMonsterRecharge, buildRechargeRefusalPopup, buildRechargeRefusalLog } from './monsterRecharge.js';

export function isMonsterGrantReactionRow(row) {
  return row?.automation?.type === 'monster_grant_reaction' && !!row.automation.effect;
}

export function grantReactionRangeFt(action) {
  return Number(action?.automation?.range_ft) || 60;
}

function grantSlug(action) {
  return String(action?.name || 'grant_reaction').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function buildGrantTargetRefusalLog({ monsterName, action, reason }) {
  return {
    type: 'automation',
    automationType: `${grantSlug(action)}_refused`,
    automationDetail: reason,
    characterName: monsterName,
    abilityName: action?.name || 'Grant Reaction',
    description: `${monsterName} ${action?.name || 'Grant Reaction'} refused (${reason}) — arm a different creature within ${grantReactionRangeFt(action)} ft on the card first. Zero recharge spent, zero te.`,
    timestamp: Date.now(),
  };
}

export function buildGrantTargetRefusalPopup({ monsterName, action, reason }) {
  const title = reason === 'self_target' ? 'Cannot Incite Yourself' : 'No Target Armed';
  const body = reason === 'self_target'
    ? `${monsterName} cannot ${action?.name || 'Incite Rampage'} itself — the RAW targets another creature it can see within ${grantReactionRangeFt(action)} ft. Arm a different creature on the card first. No recharge spent.`
    : `${monsterName} has no armed target — ${action?.name || 'Incite Rampage'} needs a different creature armed within ${grantReactionRangeFt(action)} ft. Arm the target on the card first. No recharge spent.`;
  return `<div class="mc-prerequisite-refusal"><h3>${title}</h3><p>${body}</p></div>`;
}

export function buildAlreadyIncitedRefusalLog({ monsterName, action, targetName }) {
  return {
    type: 'automation',
    automationType: `${grantSlug(action)}_refused`,
    automationDetail: `already_${action?.automation?.effect || 'incited'}`,
    characterName: monsterName,
    abilityName: action?.name || 'Grant Reaction',
    description: `${targetName} is already incited by ${monsterName} — ${action?.name || 'Grant Reaction'} refused, zero recharge spent. Refusal reason: already_${action?.automation?.effect || 'incited'}.`,
    timestamp: Date.now(),
  };
}

export function buildAlreadyIncitedRefusalPopup({ monsterName, action, targetName }) {
  return `<div class="mc-prerequisite-refusal"><h3>Already Incited</h3><p>${targetName} is already raging on ${monsterName}'s incitement — ${action?.name || 'Incite Rampage'} refused. No recharge spent; the existing Reaction window keeps running.</p></div>`;
}

export function buildGrantReactionGrantLog({ monsterName, action, targetName, rangeFt }) {
  return {
    type: 'automation',
    automationType: `${action?.automation?.effect || 'grant_reaction'}_granted`,
    characterName: monsterName,
    abilityName: action?.name || 'Grant Reaction',
    description: `${monsterName} ${action?.name || 'Grant Reaction'}: te \`${action?.automation?.effect || 'grant_reaction'}\` armed on ${targetName} — can take a Reaction to make one melee attack (GM-enforced). Rampage Bonus Action prerequisite on ${targetName} and the ${rangeFt}-ft line-of-sight range are GM-checked (§70/§42 advisory); Recharge 5-6 spent, unavailable until a d6 5+ at the start of ${monsterName}'s next turn.`,
    timestamp: Date.now(),
  };
}

export function buildGrantReactionPopup({ monsterName, action, targetName, rangeFt, threshold }) {
  return `<div class="mc-prerequisite-refusal"><h3>${action?.name || 'Grant Reaction'}</h3><p>${targetName} is incited into a rampage — it can take a Reaction to make one melee attack (GM-enforced, clears next round). Rampage Bonus Action prerequisite and the ${rangeFt}-ft range are GM-checked (§70). Recharge ${threshold || 5}-6 spent — unavailable until a d6 ${threshold || 5}+ at the start of ${monsterName}'s next turn.</p></div>`;
}

// Live MA-0031 recharge economy at chip click: a spent row refuses with the
// canonical "Not Recharged" popup + `incite_rampage_refused` (not recharged)
// log — zero spend, zero te, no save/target prompts. Turn-start d6 5-6 recovery
// rides rollMonsterRecharges untouched.
async function gateRecharge({ action, monsterName, campaignName, setPopupHtml, log, getRV }) {
  const rechargeGate = monsterRechargeGate(action, getRV(monsterName, MONSTER_RECHARGE_KEY) || {});
  if (rechargeGate && !rechargeGate.available) {
    setPopupHtml(buildRechargeRefusalPopup({ monsterName, actionName: action.name, threshold: rechargeGate.threshold }));
    await log(campaignName, buildRechargeRefusalLog({ monsterName, actionName: action.name, rechargeKey: rechargeGate.key, threshold: rechargeGate.threshold }));
    return { ok: false, gate: null };
  }
  return { ok: true, gate: rechargeGate };
}

// GM-armed target gate (RAW "another creature it can see within 60 feet"): the
// armed targetName seam must resolve to a board creature that is not the Pack Lord
// itself, and the target must not already carry this Pack Lord's incite te. Every
// refusal is zero-spend/zero-te; the caller only proceeds on a resolved target.
async function gateGrantTarget({ armed, monsterName, action, campaignName, effectKey, setPopupHtml, log, deps }) {
  if (!armed) {
    setPopupHtml(buildGrantTargetRefusalPopup({ monsterName, action, reason: 'no_target' }));
    await log(campaignName, buildGrantTargetRefusalLog({ monsterName, action, reason: 'no_target' }));
    return { target: null, reason: 'no-target' };
  }
  if (armed.name === monsterName) {
    setPopupHtml(buildGrantTargetRefusalPopup({ monsterName, action, reason: 'self_target' }));
    await log(campaignName, buildGrantTargetRefusalLog({ monsterName, action, reason: 'self_target' }));
    return { target: null, reason: 'self-target' };
  }
  const getActive = deps.getActiveTargetEffect || getActiveTargetEffect;
  if (getActive(campaignName, armed.name, effectKey)) {
    setPopupHtml(buildAlreadyIncitedRefusalPopup({ monsterName, action, targetName: armed.name }));
    await log(campaignName, buildAlreadyIncitedRefusalLog({ monsterName, action, targetName: armed.name }));
    return { target: null, reason: 'already-active' };
  }
  return { target: armed, reason: null };
}

// One chip click: recharge gate → armed-target gate (another creature only) →
// already-incited gate, all refusals zero-spend/zero-te; met → spendMonsterRecharge
// FIRST (ability_use log), register te `incite_rampage` ON THE TARGET with ONE
// rounds:1 addExpiration clock, grant log + popup. MA-0882 seam.
export async function resolveMonsterGrantReactionRow({ action, monsterName, campaignName, setPopupHtml, deps = {} }) {
  if (!isMonsterGrantReactionRow(action)) return { resolved: false, reason: 'not-grant-reaction' };
  const log = deps.addEntry || addEntry;
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const effectKey = action.automation.effect;
  const rangeFt = grantReactionRangeFt(action);

  const recharged = await gateRecharge({ action, monsterName, campaignName, setPopupHtml, log, getRV });
  if (!recharged.ok) return { resolved: false, reason: 'not-recharged' };

  const getCS = deps.getCombatContext || getCombatContext;
  const cs = await getCS(campaignName);
  const armed = cs ? getTargetFromAttacker(cs, monsterName) : null;
  const gated = await gateGrantTarget({ armed, monsterName, action, campaignName, effectKey, setPopupHtml, log, deps });
  if (!gated.target) return { resolved: false, reason: gated.reason };
  const target = gated.target;

  const gate = await spendMonsterRecharge({ monsterName, action, campaignName, deps });
  if (gate && !gate.available) return { resolved: false, reason: 'not-recharged' };
  const threshold = gate ? gate.threshold : null;

  const register = deps.registerTargetEffect || registerTargetEffect;
  register(campaignName, target.name, effectKey, monsterName, {
    duration: 'rounds',
    rounds: 1,
    actionName: action.name,
  });
  const addExp = deps.addExpiration || addExpiration;
  addExp({
    attackerName: monsterName,
    targetName: target.name,
    campaignName,
    rounds: 1,
    effects: [{ type: 'remove_target_effect', effectKey, source: monsterName, target: target.name }],
  });
  await log(campaignName, buildGrantReactionGrantLog({ monsterName, action, targetName: target.name, rangeFt }));
  setPopupHtml(buildGrantReactionPopup({ monsterName, action, targetName: target.name, rangeFt, threshold }));
  return { resolved: true, effectKey, targetName: target.name, rangeFt };
}
