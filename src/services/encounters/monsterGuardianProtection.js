// MA-1463: monster-side Shield Guardian "Protection" reaction affordance for
// reactions[] rows authored automation:{type:"reaction", trigger:"attacked_by_hit",
// effect:"guardian_protection", acBonus:5} (formerly a zero-affordance prose row).
// Mirrors the sanctioned twins: monsterRedirectAttack (MA-0891 GM-armed
// cs.targetName seam via getTargetFromAttacker + refusal-token lineage), the
// parry press-over-pending template (MA-0341/§217/§235 — defender-side reaction
// pressed while the ATTACKER's hit popup is pending; the grant carries NO
// popupHtml so the pending Done popup survives the press), and the MA-1170
// oneShot:true activeBuffs stamp + consume channel (shieldHandler PC buffs
// never stripped). Unlike redirect/parry the RAW has NO daily cap —
// usage:"At Will" (uses/maxUses 999) means the uses gate can never spend;
// the only limit is the per-round latch plus one buff instance per wearer.
// Press flow: round-latch gate FIRST (MA-0881 MONSTER_REACTION_USES /
// reactionMaxUses shape) → armed-wearer gate on the guardian's OWN card-armed
// cs.targetName seam (MA-0882 getTargetFromAttacker tokens no_target/
// self_target/already-active, all zero-spend) → pending-attack identity gate
// against the WEARER (redirectIdentityRefusal lineage: rollType attack/
// spell-attack, targetName === wearer, hit:true, damage not yet applied,
// guardianProtectionResolved not stamped, identifiable attacker !== wearer).
// Met → latch AWAITED (CLA-361) → ONE-SHOT buff stamp on the WEARER's
// activeBuffs {effect:'guardian_protection', acBonus:5, oneShot:true,
// name:'Guardian Protection', grantedBy: monsterName} (same fold channel as
// MA-1170 shield / MA-0341 parry — read by getGuardianProtectionAcBonus in
// loggedDiceRollUtils, folded into computeEffectiveAc, consumed by
// consumeGuardianProtectionAcBonus in attackPostProcessing) → lastAttack merge
// {guardianProtectionResolved:true, protectedBy, protectedWearer,
// guardianProtectionAcBonus} → ANCHOR clock addExpiration expireOnCreatureName
// = guardian rounds:undefined (§38/§39 single merged list; MA-0548 limited
// foresight precedent — fires at the guardian's NEXT turn-start, matching RAW
// "until the start of the guardian's next turn") carrying ONE
// {type:'remove_active_buff', buffName:'Guardian Protection'} entry →
// ability_use spend log + guardian_protection_granted log. At Will: MONSTER_
// REACTION_USES is NEVER written (parry MA-0341 never-spends shape) — the
// chip stays "(999 left)" honestly. Refusals are log-only, NO popupHtml
// (§235d/MA-0895 lineage) so the attacker's pending Done popup survives a
// refused press. The RAW 5-ft proximity prerequisite has no gridless consumer
// (§42/§70) — it rides the grant log as honest advisory copy.
import { addEntry } from '../ui/logService.js';
import { addExpiration } from '../rules/effects/expirationQueue.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getTargetFromAttacker } from '../rules/combat/damageUtils.js';

export const GUARDIAN_PROTECTION_BUFF_NAME = 'Guardian Protection';

export function isMonsterGuardianProtectionRow(row) {
  return row?.automation?.type === 'reaction' && row?.automation?.effect === 'guardian_protection';
}

// Event-identity probe (MA-0891 redirectIdentityRefusal lineage) — but gated
// against the WEARER, not the guardian: the reaction answers the ONE attack
// roll against the amulet wearer whose damage is not yet committed (popup
// pending, Done not pressed). Returns a refusal reason token or null.
export function guardianProtectionIdentityRefusal(lastAttack, wearerName) {
  if (!lastAttack) return 'no_pending_attack';
  if (lastAttack.rollType !== 'attack' && lastAttack.rollType !== 'spell-attack') return 'no_pending_attack';
  if (lastAttack.targetName !== wearerName) return 'not_wearer';
  if (lastAttack.hit !== true) return 'miss';
  if (lastAttack.damageApplied === true || Number(lastAttack.actualDamage ?? 0) > 0) return 'resolved';
  if (lastAttack.guardianProtectionResolved === true) return 'reacted';
  if (!lastAttack.attackerName || lastAttack.attackerName === wearerName) return 'attacker';
  return null;
}

// Armed-wearer gate on the GM-armed cs.targetName seam (MA-0882/MA-0891 —
// the press reads the guardian's OWN card-armed target as the amulet wearer;
// there is no amulet-persistence subsystem in-app). already-active refuses a
// second press while the wearer already carries the +5 bond.
export function guardianWearerGate({ cs, monsterName, getRV }) {
  const armed = getTargetFromAttacker(cs, monsterName);
  if (!armed) return { wearer: null, reason: 'no_target' };
  if (armed.name === monsterName) return { wearer: null, reason: 'self_target' };
  const buffs = getRV(armed.name, 'activeBuffs') || [];
  if (Array.isArray(buffs) && buffs.some(b => b && b.effect === 'guardian_protection')) return { wearer: null, reason: 'already-active' };
  return { wearer: armed, reason: null };
}

export function guardianProtectionGate({ lastAttack, wearerName, currentRound, usedRound, action }) {
  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return { ok: false, reason: 'round', message: 'Protection: Reaction already used this round — refused.' };
  }
  const refusal = guardianProtectionIdentityRefusal(lastAttack, wearerName);
  if (refusal) {
    const messages = {
      no_pending_attack: `Protection: no pending attack roll targets ${wearerName} — refuse (no_pending_attack).`,
      not_wearer: `Protection: the last attack targeted ${lastAttack?.targetName}, not the armed wearer ${wearerName} — refused.`,
      miss: `Protection: the last attack against ${wearerName} missed — nothing to protect against.`,
      resolved: `Protection: damage is already applied on the attack against ${wearerName} — too late to Protect.`,
      reacted: `Protection: already Protected that attack — one Protection per attack.`,
      attacker: 'Protection: no identifiable attacker behind the pending attack — refused.',
    };
    return { ok: false, reason: refusal, message: messages[refusal] };
  }
  const acBonus = Number(action?.automation?.acBonus) || 5;
  return { ok: true, attackerName: lastAttack.attackerName, acBonus };
}

export function buildGuardianProtectionBuff(action, monsterName, lastAttack) {
  const acBonus = Number(action?.automation?.acBonus) || 5;
  return {
    effect: 'guardian_protection',
    name: GUARDIAN_PROTECTION_BUFF_NAME,
    acBonus,
    oneShot: true,
    source: 'Protection',
    grantedBy: monsterName,
    vsAttack: `${lastAttack.attackerName}:${lastAttack.attackName || 'attack'}`,
    appliedRoundContext: { d20: lastAttack.d20, total: lastAttack.total, targetAc: lastAttack.targetAc },
    timestamp: Date.now(),
  };
}

function buildProtectionRefusalLog({ monsterName, action, reason, message }) {
  return {
    type: 'automation',
    automationType: 'guardian_protection_refused',
    automationDetail: reason,
    characterName: monsterName,
    abilityName: action?.name || 'Protection',
    description: `Protection refused (${reason}): ${message}`,
    timestamp: Date.now(),
  };
}

const WEARER_REFUSAL_MESSAGES = {
  no_target: (m) => `Protection: ${m} has no amulet wearer armed on the card — arm the wearer that should take the +5 AC first (gridless proxy for the RAW amulet + 5-ft proximity).`,
  self_target: (m) => `Protection: ${m} cannot Protect itself — arm the amulet wearer on the card first.`,
  'already-active': (m, wearerName) => `Protection: ${wearerName} is already carrying ${m}'s +5 AC bond — one bond instance per wearer; refused.`,
};

async function refuseProtection({ monsterName, action, campaignName, reason, message, log }) {
  // Log-only refusal (§235d/MA-0895 lineage) — no popupHtml, so a refused
  // press never kills the attacker's pending Done popup. Zero spent.
  await log(campaignName, buildProtectionRefusalLog({ monsterName, action, reason, message }));
  return { ok: false, reason, message };
}

// One chip click: round-latch gate → armed-wearer gate → pending-identity
// gate (every refusal zero-spend, log-only) → latch AWAITED (CLA-361) →
// ONE-SHOT +5 buff on the WEARER's activeBuffs → lastAttack resolved-stamp →
// one anchor clock (§38, expires at the guardian's next turn-start via
// remove_buff_by_name on the wearer) → spend log. NO popupHtml on success —
// the attacker's pending Done popup survives the press (§217/§235).
export async function resolveMonsterGuardianProtectionRow({ action, monsterName, campaignName, lastAttack, cs, currentRound, usedRound, latchKey, deps = {} }) {
  if (!isMonsterGuardianProtectionRow(action)) return { resolved: false, reason: 'not-guardian-protection' };
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const log = deps.addEntry || addEntry;

  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return refuseProtection({ monsterName, action, campaignName, reason: 'round', message: 'Protection: Reaction already used this round — refused.', log });
  }

  const gated = guardianWearerGate({ cs, monsterName, getRV });
  if (!gated.wearer) {
    const armed = getTargetFromAttacker(cs, monsterName);
    const message = WEARER_REFUSAL_MESSAGES[gated.reason](monsterName, armed?.name || null);
    return refuseProtection({ monsterName, action, campaignName, reason: gated.reason, message, log });
  }
  const wearer = gated.wearer;

  const gate = guardianProtectionGate({ lastAttack, monsterName, wearerName: wearer.name, currentRound, usedRound, action });
  if (!gate.ok) {
    return refuseProtection({ monsterName, action, campaignName, reason: gate.reason, message: gate.message, log });
  }

  return applyGuardianProtectionGrant({ setRV, getRV, log, action, monsterName, campaignName, lastAttack, wearer, currentRound, latchKey, gate });
}

// Hoisted so the resolver stays under the complexity ceiling (§5). At Will
// (MA-0341 parry never-spends shape): MONSTER_REACTION_USES is never
// written — `storedUses` is read by the chip counter only.
async function applyGuardianProtectionGrant({ setRV, getRV, log, action, monsterName, campaignName, lastAttack, wearer, currentRound, latchKey, gate }) {
  const buff = buildGuardianProtectionBuff(action, monsterName, lastAttack);
  await setRV(monsterName, latchKey, currentRound, campaignName);
  const buffs = getRVOrEmpty(getRV(wearer.name, 'activeBuffs'));
  await setRV(wearer.name, 'activeBuffs', [...buffs, buff], campaignName);
  const newAc = (Number(lastAttack.targetAc) || 0) + gate.acBonus;
  await setRV('campaign', 'lastAttack', {
    ...lastAttack,
    guardianProtectionResolved: true,
    protectedBy: monsterName,
    protectedWearer: wearer.name,
    guardianProtectionAcBonus: gate.acBonus,
  }, campaignName);
  addExpiration({
    attackerName: monsterName,
    targetName: wearer.name,
    campaignName,
    rounds: undefined,
    expireOnCreatureName: monsterName,
    effects: [{ type: 'remove_active_buff', buffName: GUARDIAN_PROTECTION_BUFF_NAME }],
  });
  const entry = buildProtectionSpendLog({ monsterName, action, lastAttack, wearerName: wearer.name, gate, newAc });
  await log(campaignName, entry);
  return { ok: true, message: entry.description, acBonus: gate.acBonus, wearerName: wearer.name, newAc };
}

function getRVOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

export function buildProtectionSpendLog({ monsterName, action, lastAttack, wearerName, gate, newAc }) {
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: action?.name || 'Protection',
    description: `${monsterName} uses Protection (Reaction) — ${wearerName} gains +${gate.acBonus} AC (AC ${lastAttack.targetAc} → ${newAc}), including against ${lastAttack.attackerName}'s pending ${lastAttack.attackName || 'attack'}. Dismiss the pending attack popup WITHOUT Done, then re-click ${lastAttack.attackerName}'s attack chip to re-resolve vs AC ${newAc}. The +5 lasts until the start of ${monsterName}'s next turn. 5-ft proximity GM-enforced (gridless advisory, §42). At Will — 1 Reaction per round.`,
    timestamp: Date.now(),
  };
}
