// MA-0895: monster-side miss-negation reaction affordance for reactions[] rows
// authored automation:{type:"reaction", trigger:"attacked_by_missable_hit",
// effect:"jinx_negate", saveType, saveDc} (Goblin Hexer "Jinx" — formerly a
// generic save-shell DC chip whose "The attack misses instead" clause had ZERO
// consumers). Rides the MA-0341 parry pending-Done window (press over the
// attacker's HIT popup before Done, chip arms via GatedReactionSlot §60) and
// the MA-0891 redirect resolve-consumer shape (campaign.pendingJinx stamp →
// handlePlainDamage resolve consumer).
// Press flow: round-latch/uses gate FIRST (MA-0881 MONSTER_REACTION_USES /
// reactionMaxUses shape) → pending-attack identity gate (parryIdentityRefusal
// MA-0341 lineage WITHOUT the melee-only filter — any attack-roll against the
// hexer qualifies; no pending popup → `jinx_refused` reason no_pending_attack,
// zero-spend) → ATTACKER's WIS save vs the authored DC 13 rolled honestly
// INLINE machine-stamped (§209/§212 inline path — cs creature saving_throws
// nested-abbrev stamp folded, ability_score_modifiers fallback; the .sp-modal
// prompt seam does NOT fold cs stamps, MA-0725 pitfall) → FAIL: latch+spend
// (awaited before consumers read, CLA-361) + campaign.pendingJinx stamp +
// lastAttack merge {jinxPending:true, jinxSaveResult:'failure'} → the RESOLVE
// consumer (consumePendingJinxOnResolve, handlePlainDamage top, redirect twin)
// converts the pending attack to a MISS before any damage lands: lastAttack
// hit:false + jinx_negated:true + zero hp_change + honest auto-miss popup
// "attack negated — Jinx". SUCCESS: attack proceeds untouched, `jinx_saved`
// log, Done commits damage normally. Refusals are LOG-ONLY like parry
// (§235/§217 press-over-pending lineage) — NO popupHtml ever: a refusal
// popup over the pending window would tear down the attacker's Done popup and
// silently abandon the attack (MA-0681 elemental-absorption teardown twin);
// every press either converts, proceeds, or refuses with the pending attack
// left byte-intact on screen. At Will sentinel (usage:'At Will'+uses:999,
// MA-0341/MA-0725 shape) — RAW unlimited; 1/round latch (_jinx_negate_usedRound)
// + lastAttack.jinxResolved identity stamp are the only fire limits.
import { addEntry } from '../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// Same key MonsterCardHelpers.js pins (local literal avoids a circular import —
// the dispatcher passes the stored map in, the resolver writes it back).
const MONSTER_REACTION_USES_KEY = 'monsterReactionUses';

export function isMonsterJinxRow(row) {
  return row?.automation?.type === 'reaction' && row?.automation?.effect === 'jinx_negate';
}

function reactionMaxUses(action) {
  if (action?.maxUses != null) return Number(action.maxUses);
  if (action?.uses != null) return Number(action.uses);
  return 1;
}

// camelCase automation convention (MA-0881/MA-0329 lineage) with the authored
// top-level save_dc/save_type truth as fallback — the row keeps both twins.
export function jinxSaveSpec(action) {
  const saveDc = Number(action?.automation?.saveDc ?? action?.save_dc);
  const saveType = action?.automation?.saveType || 'WIS';
  if (!Number.isFinite(saveDc) || saveDc <= 0) return null;
  return { saveDc, saveType };
}

// Nested-abbrev save bonus (§212 cs stamp `saving_throws:{wis:{modifier:-5}}`)
// mirroring MonsterCardHelpers.getCreatureSaveModifier — local copy keeps the
// service free of a components/ import (redirect MONSTER_REACTION_USES_KEY
// precedent).
export function attackerSaveModifier(creature, abilityAbbr) {
  if (!creature) return 0;
  if (creature.saving_throws?.[abilityAbbr]?.modifier != null) return Number(creature.saving_throws[abilityAbbr].modifier);
  if (creature.ability_score_modifiers?.[abilityAbbr] != null) return Number(creature.ability_score_modifiers[abilityAbbr]);
  return 0;
}

// Event-identity probe (redirectIdentityRefusal MA-0891 / parryIdentityRefusal
// MA-0341 lineage, WITHOUT the melee-only filter — RAW trigger is ANY attack
// roll against the hexer): the Jinx must answer the ONE pending attack whose
// damage is not yet committed (popup pending, Done not pressed). Returns a
// refusal reason token or null.
export function jinxIdentityRefusal(lastAttack, monsterName) {
  if (!lastAttack) return 'no_pending_attack';
  if (lastAttack.rollType !== 'attack' && lastAttack.rollType !== 'spell-attack') return 'no_pending_attack';
  if (lastAttack.targetName !== monsterName) return 'no_pending_attack';
  if (lastAttack.hit !== true) return 'miss';
  if (lastAttack.damageApplied === true || Number(lastAttack.actualDamage ?? 0) > 0) return 'resolved';
  if (lastAttack.jinxResolved === true) return 'reacted';
  if (!lastAttack.attackerName || lastAttack.attackerName === monsterName) return 'attacker';
  return null;
}

const JINX_REFUSAL_MESSAGES = {
  round: () => 'Jinx: Reaction already used this round — refused.',
  uses: (limit) => `Jinx: ${limit} uses already spent today — refused.`,
  no_pending_attack: (m) => `Jinx: no pending attack roll targets ${m} — refuse (no_pending_attack).`,
  miss: (m) => `Jinx: the last attack against ${m} missed — nothing to jinx.`,
  resolved: () => 'Jinx: damage is already applied on that attack — too late to jinx.',
  reacted: () => 'Jinx: already responded to that attack — one jinx per attack.',
  attacker: () => 'Jinx: no identifiable attacker to jinx against — refused.',
  spec: () => 'Jinx: no numeric save DC authored on the row — refused.',
  attacker_inactive: (a) => `Jinx: attacker ${a} is not an active combatant — refused.`,
};

export function jinxGate({ lastAttack, monsterName, currentRound, storedUses, usedRound, action }) {
  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return { ok: false, reason: 'round', message: JINX_REFUSAL_MESSAGES.round() };
  }
  const used = Number((storedUses && storedUses.jinx_negate) || 0);
  const limit = reactionMaxUses(action);
  if (used >= limit) {
    return { ok: false, reason: 'uses', message: JINX_REFUSAL_MESSAGES.uses(limit) };
  }
  const identity = jinxIdentityRefusal(lastAttack, monsterName);
  if (identity) {
    return { ok: false, reason: identity, message: JINX_REFUSAL_MESSAGES[identity](monsterName) };
  }
  const spec = jinxSaveSpec(action);
  if (!spec) {
    return { ok: false, reason: 'spec', message: JINX_REFUSAL_MESSAGES.spec() };
  }
  return { ok: true, used, limit, attackerName: lastAttack.attackerName, spec };
}

export function buildJinxRefusalLog({ monsterName, action, reason, message }) {
  return {
    type: 'automation',
    automationType: 'jinx_refused',
    automationDetail: reason,
    characterName: monsterName,
    abilityName: action?.name || 'Jinx',
    description: `Jinx refused (${reason}): ${message}`,
    timestamp: Date.now(),
  };
}

export function buildJinxSaveRollLog({ monsterName, attackerName, spec, roll, modifier, total, success }) {
  return {
    type: 'roll',
    rollType: 'save',
    characterName: attackerName,
    name: `${monsterName} Jinx — ${spec.saveType} Save`,
    formula: `d20 ${modifier >= 0 ? '+' : '−'} ${Math.abs(modifier)} vs DC ${spec.saveDc}`,
    rolls: [roll],
    total,
    modifier,
    saveType: spec.saveType,
    saveDc: spec.saveDc,
    saveRoll: roll,
    saveBonus: modifier,
    saveResult: success ? 'success' : 'failure',
    note: 'jinx_negate_attacker_save',
    timestamp: Date.now(),
  };
}

export function buildJinxSpendLog({ monsterName, attackerName, spec, success, limit, remaining }) {
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: 'Jinx',
    description: `${monsterName} uses Jinx (Reaction) against ${attackerName}'s pending attack — ${attackerName} ${success ? 'SUCCEEDED' : 'FAILED'} their ${spec.saveType} save vs DC ${spec.saveDc}. ${success ? 'The attack proceeds normally — press Done to commit its damage.' : 'The attack misses instead — press Done to resolve it as a miss (zero damage).'} At Will — unlimited, 1 Reaction per round. ${limit === 999 ? 'At Will · ' : `${limit}/Day · `}${remaining} left.`,
    timestamp: Date.now(),
  };
}

export function buildJinxPendingStamp({ monsterName, lastAttack, spec, roll, modifier, total, currentRound }) {
  return {
    attackerName: lastAttack.attackerName,
    targetName: monsterName,
    by: monsterName,
    attackName: lastAttack.attackName || null,
    saveType: spec.saveType,
    saveDc: spec.saveDc,
    saveRoll: roll,
    saveBonus: modifier,
    saveTotal: total,
    attackTotal: lastAttack.total ?? null,
    targetAc: lastAttack.targetAc ?? null,
    round: Number(currentRound) || 0,
    lastAttackNonce: `${lastAttack.attackName || 'attack'}:${lastAttack.d20 ?? ''}:${lastAttack.total ?? ''}`,
    consumed: false,
    timestamp: Date.now(),
  };
}

function jinxActiveAttacker(cs, attackerName) {
  const attacker = (cs?.creatures || []).find(c => c.name === attackerName) || null;
  const hp = Number(attacker?.currentHp ?? attacker?.currentHitPoints ?? 0);
  return attacker && hp > 0 ? attacker : null;
}

async function refuseJinx({ monsterName, action, campaignName, reason, message, log }) {
  await log(campaignName, buildJinxRefusalLog({ monsterName, action, reason, message }));
  return { resolved: false, refused: true, reason, message };
}

// One chip click: round-latch/uses gate → pending-identity gate (parry §235
// lineage), every refusal zero-spend and LOG-ONLY (no popupHtml — the
// attacker's pending Done popup must survive every press, MA-0681 teardown
// twin); met → latch+spend (awaited, CLA-361) → honest INLINE attacker WIS
// save vs DC → FAIL stamps campaign.pendingJinx + lastAttack jinxPending for
// the resolve consumer; SUCCESS merges jinxSaved and the attack rides Done
// unchanged. MA-0895 seam.
export function jinxSaveOutcome({ attacker, spec, rollD20 }) {
  const abbr = String(spec.saveType).toLowerCase().slice(0, 3);
  const modifier = attackerSaveModifier(attacker, abbr);
  const roll = rollD20();
  const total = roll + modifier;
  return { roll, modifier, total, success: total >= spec.saveDc };
}

// SUCCESS leg: jinxSaved merge + honest log — the attack rides the untouched
// Done popup and commits its damage normally.
async function commitJinxSaved({ setRV, log, campaignName, monsterName, lastAttack, spec, save, limit, remaining }) {
  await setRV('campaign', 'lastAttack', {
    ...lastAttack,
    jinxResolved: true,
    jinxedBy: monsterName,
    jinxSaveResult: 'success',
    jinxSaveTotal: save.total,
  }, campaignName);
  await log(campaignName, {
    type: 'automation',
    automationType: 'jinx_saved',
    characterName: monsterName,
    abilityName: 'Jinx',
    description: `Jinx: ${lastAttack.attackerName} succeeded their ${spec.saveType} save vs DC ${spec.saveDc} (d20 ${save.roll} ${save.modifier >= 0 ? '+' : '−'} ${Math.abs(save.modifier)} = ${save.total}) — ${lastAttack.attackerName}'s ${lastAttack.attackName || 'attack'} proceeds normally. Press Done to commit its damage. 1/round · Reaction spent.`,
    timestamp: Date.now(),
  });
  await log(campaignName, buildJinxSpendLog({ monsterName, attackerName: lastAttack.attackerName, spec, success: true, limit, remaining }));
}

// FAIL leg: pending-miss stamps — campaign.pendingJinx + lastAttack
// jinxPending — for consumePendingJinxOnResolve to convert the attack to a
// MISS before Done commits damage.
async function commitJinxNegate({ setRV, log, campaignName, monsterName, lastAttack, spec, save, currentRound, limit, remaining }) {
  await setRV('campaign', 'lastAttack', {
    ...lastAttack,
    jinxResolved: true,
    jinxedBy: monsterName,
    jinxSaveResult: 'failure',
    jinxSaveTotal: save.total,
    jinxPending: true,
  }, campaignName);
  await setRV('campaign', 'pendingJinx', buildJinxPendingStamp({ monsterName, lastAttack, spec, roll: save.roll, modifier: save.modifier, total: save.total, currentRound }), campaignName);
  await log(campaignName, buildJinxSpendLog({ monsterName, attackerName: lastAttack.attackerName, spec, success: false, limit, remaining }));
}

// One chip click. Gate FIRST (§235 lineage), honest INLINE attacker save,
// spend+latch for BOTH legs, no popupHtml ever (§17 teardown mandate).
export async function resolveMonsterJinxRow({ action, monsterName, campaignName, lastAttack, cs, currentRound, storedUses, usedRound, latchKey, deps = {} }) {
  if (!isMonsterJinxRow(action)) return { resolved: false, reason: 'not-jinx' };
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const rollD20 = deps.rollD20 || (() => Math.floor(Math.random() * 20) + 1);
  const gate = jinxGate({ lastAttack, monsterName, currentRound, storedUses, usedRound, action });
  if (!gate.ok) return refuseJinx({ monsterName, action, campaignName, reason: gate.reason, message: gate.message, log });

  const attacker = jinxActiveAttacker(cs, gate.attackerName);
  if (!attacker) {
    return refuseJinx({ monsterName, action, campaignName, reason: 'attacker_inactive', message: JINX_REFUSAL_MESSAGES.attacker_inactive(gate.attackerName), log });
  }

  const save = jinxSaveOutcome({ attacker, spec: gate.spec, rollD20 });
  await log(campaignName, buildJinxSaveRollLog({ monsterName, attackerName: gate.attackerName, spec: gate.spec, ...save }));

  // Latch + spend AWAITED before consumers read (CLA-361), for BOTH legs —
  // a saved Jinx is still a spent reaction.
  await setRV(monsterName, latchKey, currentRound, campaignName);
  await setRV(monsterName, MONSTER_REACTION_USES_KEY, { ...(storedUses || {}), jinx_negate: gate.used + 1 }, campaignName);
  const remaining = Math.max(0, gate.limit - gate.used - 1);

  if (save.success) {
    await commitJinxSaved({ setRV, log, campaignName, monsterName, lastAttack, spec: gate.spec, save, limit: gate.limit, remaining });
    return { resolved: true, success: true, saveTotal: save.total, remaining };
  }

  await commitJinxNegate({ setRV, log, campaignName, monsterName, lastAttack, spec: gate.spec, save, currentRound, limit: gate.limit, remaining });
  return { resolved: true, success: false, saveTotal: save.total, remaining };
}

// RESOLVE CONSUMER (MA-0895, redirect consumePendingRedirectOnResolve MA-0891
// twin): runs at the top of handlePlainDamage. When the stamped attacker fails
// the Jinx save, the pending attack is honestly converted to a MISS BEFORE any
// damage lands — lastAttack hit:false + jinx_negated:true + zero hp_change +
// auto-miss popup "attack negated — Jinx". No armed jinx, attacker/target
// mismatch, or consumed stamp → byte-inert null (legacy rows untouched).
function jinxConsumeMatch(pending, context) {
  return Boolean(pending) && pending.consumed !== true && Boolean(context)
    && context.attackerName === pending.attackerName
    && context.targetName === pending.targetName;
}

function buildJinxMissStamp(pending) {
  return {
    hit: false,
    jinx_negated: true,
    negatedBy: pending.by,
    jinxSaveResult: 'failure',
    jinxSaveRoll: pending.saveRoll ?? null,
    jinxSaveBonus: pending.saveBonus ?? null,
    jinxSaveTotal: pending.saveTotal ?? null,
    jinxSaveDc: pending.saveDc ?? null,
    actualDamage: 0,
    damageApplied: false,
  };
}

export async function consumePendingJinxOnResolve(campaignName, context, deps = {}) {
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const pending = getRV('campaign', 'pendingJinx', campaignName);
  if (!jinxConsumeMatch(pending, context)) return null;
  const attackName = context.attackName || pending.attackName || 'attack';
  await setRV('campaign', 'pendingJinx', null, campaignName);
  const existingLastAttack = (await getRV('campaign', 'lastAttack', campaignName)) || {};
  await setRV('campaign', 'lastAttack', { ...existingLastAttack, ...buildJinxMissStamp(pending) }, campaignName);
  await log(campaignName, {
    type: 'automation',
    automationType: 'jinx_attack_negated',
    characterName: pending.by,
    abilityName: 'Jinx',
    description: `Jinx resolved: ${pending.attackerName}'s ${attackName} attack on ${pending.targetName} is NEGATED — ${pending.attackerName} failed the ${pending.saveType} save vs DC ${pending.saveDc} (total ${pending.saveTotal}); the attack misses instead. Zero damage, ${pending.targetName} unchanged.`,
    timestamp: Date.now(),
  });
  return {
    negated: true,
    popupData: {
      type: 'auto-miss',
      rollType: 'attack',
      computedHit: false,
      name: attackName,
      targetName: pending.targetName,
      jinxNegated: true,
      attackerName: pending.attackerName,
      total: pending.attackTotal ?? null,
      targetAc: pending.targetAc ?? null,
      saveType: pending.saveType,
      saveDc: pending.saveDc,
      saveTotal: pending.saveTotal,
      finalDamage: 0,
      damageApplied: false,
      note: 'attack negated — Jinx',
    },
  };
}
