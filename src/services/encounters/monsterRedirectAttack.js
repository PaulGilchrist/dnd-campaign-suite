// MA-0891: monster-side redirect-attack reaction affordance for reactions[] rows
// authored automation:{type:"monster_redirect_attack", effect:"redirect_attack",
// ally_size:["Small","Medium"], range_ft:5} (Goblin Boss "Redirect Attack" —
// formerly a zero-affordance prose row). Mirrors the sanctioned twins:
// monsterGrantReaction (MA-0882 GM-armed cs.targetName seam + te on the ally +
// ONE rounds:1 clock), monsterSelfBuff (MA-0655 registration style), and the
// parry press-over-ppending lineage (MA-0341/§217/§235 — defender presses the
// chip while the attacker's hit popup is pending; the grant carries NO popupHtml
// so the pending Done popup survives the press).
// Press flow: round-latch/uses gate FIRST (MA-0881 MONSTER_REACTION_USES /
// reactionMaxUses shape) → pending-attack identity gate (parryIdentityRefusal
// lineage WITHOUT the melee-only filter — any attack-roll against the goblin
// qualifies; no pending popup → `redirect_attack_refused` reason
// no_pending_attack, zero-spend) → armed-ally gate on the goblin's own
// cs.targetName seam (getTargetFromAttacker — refuse no_target/self_target/
// already-active, MA-0882 tokens) → Small/Medium size gate ("Medium or Small"
// multi-size tokens folded largest-first, MA-0553 lineage) → latch + spend
// (MONSTER_REACTION_USES, awaited before consumers read, CLA-361) → RETARGET
// STAMP: campaign.pendingRedirect {attackerName, originalTarget, newTarget,
// round, lastAttackNonce} + lastAttack merge {redirected:true, retarget_original,
// retarget_to} → te `redirect_attack` ON THE ALLY rounds:1 + ONE addExpiration
// clock → ability_use spend log + redirect_attack_granted log ("the ally becomes
// the target of the attack; position swap GM-enforced").
// RESOLVE CONSUMER: consumePendingRedirectOnResolve runs at the top of
// handlePlainDamage — when the stamped attack resolves (Done on the pending
// popup), the victim is honestly rewritten to the ALLY (context.targetName swap,
// damage + hp_change land there, Boss stays unharmed; lastAttack carries
// redirectConsumed + retarget fields; no pending redirect = byte-inert null).
// The RAW 5-ft proximity prerequisite and the physical token swap have no
// gridless consumer (§42/§70 — moveToken grep-zero), so both ride the grant log
// as honest advisory copy, like the push-row phantom-distance precedent.
import { addEntry } from '../ui/logService.js';
import { registerTargetEffect, getActiveTargetEffect } from '../combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../rules/effects/expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getTargetFromAttacker } from '../rules/combat/damageUtils.js';

// Same key MonsterCardHelpers.js pins (local literal avoids a circular import —
// the dispatcher passes the stored map in, the resolver writes it back).
const MONSTER_REACTION_USES_KEY = 'monsterReactionUses';

export function isMonsterRedirectAttackRow(row) {
  return row?.automation?.type === 'monster_redirect_attack' && row?.automation?.effect === 'redirect_attack';
}

function reactionMaxUses(action) {
  if (action?.maxUses != null) return Number(action.maxUses);
  if (action?.uses != null) return Number(action.uses);
  return 1;
}

export function redirectRangeFt(action) {
  return Number(action?.automation?.range_ft) || 5;
}

export function redirectAllySizes(action) {
  const list = Array.isArray(action?.automation?.ally_size) ? action.automation.ally_size : ['Small', 'Medium'];
  return list.map(s => String(s).toLowerCase());
}

const KNOWN_SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];

// "Medium or Small" stat-block sizes (Bandit) fold to their token list
// (MA-0553 lineage); unknown sizes stay lenient, a known size OUTSIDE
// Small/Medium refuses — Tiny pets can never take the hit.
export function redirectAllySizeAllowed(size, allowedSizes) {
  const text = String(size || '').toLowerCase();
  if (!text) return true;
  const tokens = text.split(/\s+or\s+/i).map(s => s.trim());
  const known = tokens.filter(t => KNOWN_SIZES.includes(t));
  if (known.length === 0) return true;
  return known.some(t => allowedSizes.includes(t));
}

// Event-identity probe (parryIdentityRefusal MA-0341 / elemental-absorption
// MA-0681 lineage): the redirect must answer the ONE attack roll against this
// goblin whose damage is not yet committed (popup pending, Done not pressed).
// Returns a refusal reason token or null.
export function redirectIdentityRefusal(lastAttack, monsterName) {
  if (!lastAttack) return 'no_pending_attack';
  if (lastAttack.rollType !== 'attack' && lastAttack.rollType !== 'spell-attack') return 'no_pending_attack';
  if (lastAttack.targetName !== monsterName) return 'no_pending_attack';
  if (lastAttack.hit !== true) return 'miss';
  if (lastAttack.damageApplied === true || Number(lastAttack.actualDamage ?? 0) > 0) return 'resolved';
  if (lastAttack.redirected === true) return 'reacted';
  if (!lastAttack.attackerName || lastAttack.attackerName === monsterName) return 'attacker';
  return null;
}

const REDIRECT_REFUSAL_MESSAGES = {
  round: () => 'Redirect Attack: Reaction already used this round — refused.',
  uses: (limit) => `Redirect Attack: ${limit} uses already spent today — refused.`,
  no_pending_attack: (m) => `Redirect Attack: no pending attack roll targets ${m} — refuse (no_pending_attack).`,
  miss: (m) => `Redirect Attack: the last attack against ${m} missed — nothing to redirect.`,
  resolved: () => 'Redirect Attack: damage is already applied on that attack — too late to redirect.',
  reacted: () => 'Redirect Attack: already redirected that attack — one redirect per attack.',
  attacker: () => 'Redirect Attack: no identifiable attacker to redirect against — refused.',
  no_target: (m) => `Redirect Attack: ${m} has no ally armed on the card — arm the Small or Medium ally that should take the hit first.`,
  self_target: (m) => `Redirect Attack: ${m} cannot redirect an attack onto itself — the RAW chooses ANOTHER Small or Medium ally.`,
  size: (m, allyName, size) => `Redirect Attack: ${allyName} is ${size} — only Small or Medium allies can be the redirect target.`,
  'already-active': (m, allyName) => `Redirect Attack: ${allyName} is already carrying ${m}'s redirect te — refused.`,
};

export function redirectGate({ lastAttack, monsterName, currentRound, storedUses, usedRound, action }) {
  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return { ok: false, reason: 'round', message: REDIRECT_REFUSAL_MESSAGES.round() };
  }
  const used = Number((storedUses && storedUses.redirect_attack) || 0);
  const limit = reactionMaxUses(action);
  if (used >= limit) {
    return { ok: false, reason: 'uses', message: REDIRECT_REFUSAL_MESSAGES.uses(limit) };
  }
  const identity = redirectIdentityRefusal(lastAttack, monsterName);
  if (identity) {
    return { ok: false, reason: identity, message: REDIRECT_REFUSAL_MESSAGES[identity](monsterName) };
  }
  return { ok: true, used, limit, attackerName: lastAttack.attackerName };
}

// Armed-ally gate on the GM-armed cs.targetName seam (MA-0882 getTargetFromAttacker
// shape — the press reads the Goblin Boss's OWN card-armed target as the chosen
// ally): refuse no_target / self_target / already-active / size, all zero-spend.
export function redirectAllyGate({ cs, monsterName, action, campaignName, deps = {} }) {
  const armed = getTargetFromAttacker(cs, monsterName);
  if (!armed) return { ally: null, reason: 'no_target' };
  if (armed.name === monsterName) return { ally: null, reason: 'self_target' };
  const getActive = deps.getActiveTargetEffect || getActiveTargetEffect;
  if (getActive(campaignName, armed.name, 'redirect_attack')) return { ally: null, reason: 'already-active' };
  const allowed = redirectAllySizes(action);
  if (!redirectAllySizeAllowed(armed.size, allowed)) return { ally: null, reason: 'size' };
  return { ally: armed, reason: null };
}

export function buildRedirectRefusalPopup({ monsterName, message }) {
  return `<div class="mc-prerequisite-refusal"><h3>Redirect Attack Refused</h3><p>${message} ${monsterName} keeps its place — nothing spent, the pending attack stays as it is.</p></div>`;
}

export function buildRedirectRefusalLog({ monsterName, action, reason, message }) {
  return {
    type: 'automation',
    automationType: 'redirect_attack_refused',
    automationDetail: reason,
    characterName: monsterName,
    abilityName: action?.name || 'Redirect Attack',
    description: `Redirect Attack refused (${reason}): ${message}`,
    timestamp: Date.now(),
  };
}

export function buildRedirectSpendLog({ monsterName, action, lastAttack, allyName }) {
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: action?.name || 'Redirect Attack',
    description: `${monsterName} uses Redirect Attack (Reaction) against ${lastAttack?.attackerName}'s ${lastAttack?.attackName || 'attack'} — ${allyName} is armed as the redirect target.`,
    timestamp: Date.now(),
  };
}

export function buildRedirectGrantedLog({ monsterName, action, lastAttack, allyName, rangeFt }) {
  return {
    type: 'automation',
    automationType: 'redirect_attack_granted',
    characterName: monsterName,
    abilityName: action?.name || 'Redirect Attack',
    description: `${monsterName} Redirect Attack: ${allyName} becomes the target of ${lastAttack?.attackerName}'s ${lastAttack?.attackName || 'attack'} — the pending attack now lands on ${allyName} (press Done to commit it against ${allyName}). Position swap GM-enforced (gridless advisory, §70); the ${rangeFt}-ft adjacency and ${allyName}'s Small/Medium eligibility are GM-checked (§42 advisory). Reaction spent — 1 per round.`,
    timestamp: Date.now(),
  };
}

export function buildRedirectPendingStamp({ monsterName, lastAttack, allyName, currentRound }) {
  return {
    attackerName: lastAttack.attackerName,
    originalTarget: monsterName,
    newTarget: allyName,
    by: monsterName,
    attackName: lastAttack.attackName || null,
    round: Number(currentRound) || 0,
    lastAttackNonce: `${lastAttack.attackName || 'attack'}:${lastAttack.d20 ?? ''}:${lastAttack.total ?? ''}`,
    timestamp: Date.now(),
  };
}

async function refuseRedirect({ monsterName, action, campaignName, reason, message, log }) {
  await log(campaignName, buildRedirectRefusalLog({ monsterName, action, reason, message }));
  return { resolved: false, reason, message, popupHtml: buildRedirectRefusalPopup({ monsterName, message }) };
}

// One chip click: round-latch/uses gate → pending-identity gate → armed-ally
// gate (size-checked), every refusal zero-spend; met → latch+spend (awaited,
// CLA-361) → pendingRedirect + lastAttack retarget stamps → te on the ALLY
// rounds:1 + ONE clock → spend + grant logs. NO popupHtml on success — the
// attacker's pending Done popup must survive the press (parry §217/§235
// lineage); the grant lands in the campaign log. MA-0891 seam.
export async function resolveMonsterRedirectAttackRow({ action, monsterName, campaignName, lastAttack, cs, currentRound, storedUses, usedRound, latchKey, deps = {} }) {
  if (!isMonsterRedirectAttackRow(action)) return { resolved: false, reason: 'not-redirect-attack' };
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const gate = redirectGate({ lastAttack, monsterName, currentRound, storedUses, usedRound, action });
  if (!gate.ok) return refuseRedirect({ monsterName, action, campaignName, reason: gate.reason, message: gate.message, log });

  const gated = redirectAllyGate({ cs, monsterName, action, campaignName, deps });
  if (!gated.ally) {
    const armed = getTargetFromAttacker(cs, monsterName);
    const message = REDIRECT_REFUSAL_MESSAGES[gated.reason](monsterName, armed?.name || null, armed?.size || null);
    return refuseRedirect({ monsterName, action, campaignName, reason: gated.reason, message, log });
  }
  const ally = gated.ally;
  return applyRedirectGrant({ setRV, log, deps, action, monsterName, campaignName, lastAttack, ally, currentRound, latchKey, storedUses, gate });
}

// Latch+spend AWAITED before consumers read (CLA-361), then the retarget
// stamps, the ALLY te + ONE clock, and the spend + grant logs. Hoisted so the
// resolver stays under the complexity ceiling (§5).
async function applyRedirectGrant({ setRV, log, deps, action, monsterName, campaignName, lastAttack, ally, currentRound, latchKey, storedUses, gate }) {
  await setRV(monsterName, latchKey, currentRound, campaignName);
  await setRV(monsterName, MONSTER_REACTION_USES_KEY, { ...(storedUses || {}), redirect_attack: gate.used + 1 }, campaignName);
  await setRV('campaign', 'pendingRedirect', buildRedirectPendingStamp({ monsterName, lastAttack, allyName: ally.name, currentRound }), campaignName);
  await setRV('campaign', 'lastAttack', {
    ...lastAttack,
    redirected: true,
    redirectedBy: monsterName,
    retarget_original: monsterName,
    retarget_to: ally.name,
  }, campaignName);

  const register = deps.registerTargetEffect || registerTargetEffect;
  register(campaignName, ally.name, 'redirect_attack', monsterName, {
    duration: 'rounds',
    rounds: 1,
    actionName: action.name,
  });
  const addExp = deps.addExpiration || addExpiration;
  addExp({
    attackerName: monsterName,
    targetName: ally.name,
    campaignName,
    rounds: 1,
    effects: [{ type: 'remove_target_effect', effectKey: 'redirect_attack', source: monsterName, target: ally.name }],
  });

  await log(campaignName, buildRedirectSpendLog({ monsterName, action, lastAttack, allyName: ally.name }));
  await log(campaignName, buildRedirectGrantedLog({ monsterName, action, lastAttack, allyName: ally.name, rangeFt: redirectRangeFt(action) }));
  return { resolved: true, effectKey: 'redirect_attack', allyName: ally.name, attackerName: gate.attackerName };
}

// RESOLVE CONSUMER (MA-0891): runs at the top of handlePlainDamage. When the
// stamped pending attack resolves (Done), the victim is honestly rewritten to
// the armed ALLY — damage + hp_change land there, the Boss stays unharmed;
// lastAttack carries redirectConsumed + retarget fields. No armed redirect,
// attacker mismatch, or consumed stamp → byte-inert null (legacy rows untouched).
export async function consumePendingRedirectOnResolve(campaignName, context, combatSummary, deps = {}) {
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const pending = getRV('campaign', 'pendingRedirect', campaignName);
  if (!pending || pending.consumed === true) return null;
  if (!context || context.attackerName !== pending.attackerName) return null;
  // Identity gate: only the attack whose popup is still armed on the ORIGINAL
  // victim may be rewritten — a fresh swing the attacker re-armed elsewhere
  // must stay byte-inert (E2E control: second Scimitar armed on Bandit 2
  // must not consume the pending redirect).
  if (context.targetName !== pending.originalTarget) return null;
  const ally = (combatSummary?.creatures || []).find(c => c.name === pending.newTarget);
  if (!ally) {
    await setRV('campaign', 'pendingRedirect', null, campaignName);
    await log(campaignName, {
      type: 'automation',
      automationType: 'redirect_attack_lapsed',
      characterName: pending.by,
      abilityName: 'Redirect Attack',
      description: `Redirect Attack lapsed — ${pending.newTarget} is no longer on the board when ${pending.attackerName}'s attack resolved; damage lands on the pending popup's armed target. Reaction stays spent.`,
      timestamp: Date.now(),
    });
    return null;
  }
  context.targetName = pending.newTarget;
  await setRV('campaign', 'pendingRedirect', null, campaignName);
  const existingLastAttack = (await getRV('campaign', 'lastAttack', campaignName)) || {};
  await setRV('campaign', 'lastAttack', {
    ...existingLastAttack,
    redirected: true,
    retarget_original: pending.originalTarget,
    retarget_to: pending.newTarget,
    redirectConsumed: true,
  }, campaignName);
  await log(campaignName, {
    type: 'automation',
    automationType: 'redirect_attack_applied',
    characterName: pending.by,
    abilityName: 'Redirect Attack',
    description: `Redirect Attack resolved: ${pending.attackerName}'s ${pending.attackName || 'attack'} now targets ${pending.newTarget} — damage applies to ${pending.newTarget} (${pending.originalTarget} unharmed). Position swap GM-enforced (gridless advisory, §70).`,
    timestamp: Date.now(),
  });
  return { newTarget: pending.newTarget, originalTarget: pending.originalTarget };
}
