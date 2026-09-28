// MA-1510: Sphinx of Wonder "Burst of Ingenuity" gated buff-the-roller
// reaction for reactions[] rows authored automation:{type:"reaction",
// trigger:"ability_check_or_save", effect:"burst_of_ingenuity", bonus:2,
// range_ft:30} + numeric uses:2/maxUses:2 (formerly a zero-affordance
// prose row whose uses:"2/Day" STRING was unparseable by every usage
// parser — MA-1502 NaN fingerprint, §60 gated lane unarmed).
// Mirrors the sanctioned defender-reaction twins: guardian_protection
// (MA-1463 — press-time GM identification via the card-armed cs.targetName
// seam, getTargetFromAttacker MA-0882/MA-0891, ONE-SHOT activeBuffs stamp
// consumed at the next resolve MA-1170/§214 arm→next-resolve-consume
// lineage, refusals log-only §235d) and spell_reflection (MA-1488 —
// RAW_EVENT_GATE_RESOLVERS flat-dispatcher leg). Unlike guardian_protection
// the RAW names the SPHINX itself as a valid roller ("the sphinx or another
// creature"), so self-target is legal here — the refusal tokens are
// no_target/already_armed only. The press AWARDS nothing itself (the RAW
// grants no popup, no damage): it arms a ONE-SHOT activeBuffs
// {effect:'burst_of_ingenuity', saveBonus:2, oneShot:true} stamp on the
// GM-armed roller, which then rides to the roll seams where its live
// consumers fold the +2 and CONSUME it (never at press — §214):
// ability/skill check chips fold in d20RollComputation.computeD20Roll
// (pendingSkillCheckBonus MA-0316 fold-seam mirror), NPC inline saves fold
// in saveProcessing.processNpcSave (warding_bond saveBonus §76 fold seam —
// the narrow reader that accepts per-char activeBuffs saveBonus), and PC
// save prompts fold in SavePromptModal.computeSaveRollOutcome (same
// warding_bond seam PC-side). Economy: 2/Day numeric spends
// MONSTER_REACTION_USES[burst_of_ingenuity] at press (MA-0013/§165 spend
// shape — the "2/Day" string is replaced with numerics so the gate and the
// "(N left)" chip counter exist); every press additionally latches the round
// (_burst_of_ingenuity_usedRound, MA-0013 shape, AWAITED before consumers
// read CLA-361) — RAW "1 Reaction per round". At 0 uses every press refuses
// `burst_of_ingenuity_refused` (uses) with zero spend. The 30-ft RAW
// proximity has no gridless consumer (§42) — it rides the grant log as
// honest advisory copy; re-arm after the daily 2 is GM-enforced at a long
// rest (§70 monster rest-rearm residual). The unused armed stamp expires via
// ONE anchor clock expireOnCreatureName=sphinx (§38/§39, MA-1463 shape —
// fires at the sphinx's NEXT turn-start, same-round expiry never fires
// §38); the armed roll consumes it long before.
import { addEntry } from '../ui/logService.js';
import { addExpiration } from '../rules/effects/expirationQueue.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getTargetFromAttacker } from '../rules/combat/damageUtils.js';

// Same key MonsterCardHelpers.js pins (local literal avoids a circular
// import — dispatcher/spell_reflection precedent).
const MONSTER_REACTION_USES_KEY = 'monsterReactionUses';

export const BURST_OF_INGENUITY_BUFF_NAME = 'Burst of Ingenuity';

export function isMonsterBurstOfIngenuityRow(row) {
  return row?.automation?.type === 'reaction' && row?.automation?.effect === 'burst_of_ingenuity';
}

export function burstOfIngenuityBonus(action) {
  return Number(action?.automation?.bonus) || 2;
}

function reactionMaxUses(action) {
  if (action?.maxUses != null) return Number(action.maxUses);
  if (action?.uses != null) return Number(action.uses);
  return 1;
}

// Roller identification press-time (MA-1463 guardianWearerGate lineage) on
// the sphinx's OWN card-armed cs.targetName seam — the GM arms the creature
// about to make the check/save. Self is RAW-legal ("the sphinx or another
// creature"), so unlike the guardian there is NO self_target refusal; an
// already-armed roller refuses a double arm (one buff instance per roller).
export function burstRollerGate({ cs, monsterName, getRV }) {
  const armed = getTargetFromAttacker(cs, monsterName);
  if (!armed) return { roller: null, reason: 'no_target' };
  const buffs = getRV(armed.name, 'activeBuffs') || [];
  if (Array.isArray(buffs) && buffs.some(b => b && b.effect === 'burst_of_ingenuity')) return { roller: null, reason: 'already_armed' };
  return { roller: armed, reason: null };
}

export function burstOfIngenuityGate({ currentRound, usedRound, storedUses, action }) {
  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return { ok: false, reason: 'round', message: 'Burst of Ingenuity: Reaction already used this round — refused.' };
  }
  const used = Number((storedUses && storedUses.burst_of_ingenuity) || 0);
  const limit = reactionMaxUses(action);
  if (used >= limit) {
    return { ok: false, reason: 'uses', message: `Burst of Ingenuity: ${limit}/Day uses already spent today — refused. Uses reset at a long rest; GM-enforced for monsters.` };
  }
  return { ok: true, used, limit };
}

export function buildBurstOfIngenuityBuff(action, monsterName, currentRound) {
  return {
    effect: 'burst_of_ingenuity',
    name: BURST_OF_INGENUITY_BUFF_NAME,
    saveBonus: burstOfIngenuityBonus(action),
    oneShot: true,
    source: 'Burst of Ingenuity',
    grantedBy: monsterName,
    grantedToRollTypes: ['check', 'skill', 'save'],
    grantedRound: Number(currentRound) || 0,
    timestamp: Date.now(),
  };
}

const REFUSAL_MESSAGES = {
  round: () => 'Burst of Ingenuity: Reaction already used this round — refused.',
  uses: (limit) => `Burst of Ingenuity: ${limit}/Day uses already spent today — refused.`,
  no_target: (m) => `Burst of Ingenuity: ${m} has no roller armed on the card — arm the creature about to make the ability check or saving throw first (gridless proxy for the RAW 30-ft proximity).`,
  already_armed: (r) => `Burst of Ingenuity: ${r} is already carrying an armed +2 — one buff instance per roller; refused.`,
};

function buildBurstRefusalLog({ monsterName, action, reason, message }) {
  return {
    type: 'automation',
    automationType: 'burst_of_ingenuity_refused',
    automationDetail: reason,
    characterName: monsterName,
    abilityName: action?.name || 'Burst of Ingenuity',
    description: `Burst of Ingenuity refused (${reason}): ${message}`,
    timestamp: Date.now(),
  };
}

async function refuseBurst({ monsterName, action, campaignName, reason, message, log }) {
  // Log-only refusal (§235d) — zero spend, no popupHtml.
  await log(campaignName, buildBurstRefusalLog({ monsterName, action, reason, message }));
  return { ok: false, reason, message };
}

// Roll-seam consume (used by d20RollComputation check/skill fold,
// saveProcessing.processNpcSave NPC-inline fold, SavePromptModal PC-prompt
// fold): first ability-check/skill-check/saving-throw resolution by an armed
// roller folds the +2 and strips the ONE-SHOT stamp (clear on roll, not on
// press — §214). Byte-inert zero for every unarmed roller.
export function consumeBurstOfIngenuityBuff(rollerName, campaignName, { rollType, rollName } = {}) {
  const zero = { bonus: 0, applied: false };
  if (!rollerName) return zero;
  if (rollType !== 'check' && rollType !== 'skill' && rollType !== 'save') return zero;
  const buffs = getRuntimeValue(rollerName, 'activeBuffs', campaignName) || [];
  if (!Array.isArray(buffs)) return zero;
  const buff = buffs.find(b => b && b.effect === 'burst_of_ingenuity');
  if (!buff) return zero;
  setRuntimeValue(rollerName, 'activeBuffs', buffs.filter(b => b !== buff), campaignName);
  addEntry(campaignName, {
    type: 'automation',
    automationType: 'burst_of_ingenuity_applied',
    characterName: buff.grantedBy || rollerName,
    targetName: rollerName,
    abilityName: BURST_OF_INGENUITY_BUFF_NAME,
    description: `Burst of Ingenuity: +${Number(buff.saveBonus) || 2} folded into ${rollerName}'s ${rollType}${rollName ? ` (${rollName})` : ''} — buff consumed.`,
    timestamp: Date.now(),
  }).catch(e => console.error('[MA-1510 burst_of_ingenuity_applied] log error:', e));
  return { bonus: Number(buff.saveBonus) || 0, applied: true };
}

// One chip click: round latch → uses gate → roller gate (every refusal
// zero-spend, log-only §235d) → latch + spend + arm AWAITED (CLA-361, §39
// sequential) → ONE-SHOT +2 activeBuffs stamp on the ROLLER → ONE anchor
// clock (§38, expires at the sphinx's next turn-start if unused) →
// ability_use spend log. NO popupHtml ever — RAW grants no visible event
// until the roller rolls.
export async function resolveMonsterBurstOfIngenuityRow({ action, monsterName, campaignName, cs, currentRound, storedUses, usedRound, latchKey, deps = {} }) {
  if (!isMonsterBurstOfIngenuityRow(action)) return { resolved: false, reason: 'not-burst-of-ingenuity' };
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const log = deps.addEntry || addEntry;

  const gate = burstOfIngenuityGate({ currentRound, usedRound, storedUses, action });
  if (!gate.ok) {
    return refuseBurst({ monsterName, action, campaignName, reason: gate.reason, message: gate.message, log });
  }

  const armedGate = burstRollerGate({ cs, monsterName, getRV });
  if (!armedGate.roller) {
    const rollerName = getTargetFromAttacker(cs, monsterName);
    const message = REFUSAL_MESSAGES[armedGate.reason](armedGate.reason === 'already_armed' ? rollerName?.name : monsterName);
    return refuseBurst({ monsterName, action, campaignName, reason: armedGate.reason, message, log });
  }
  const roller = armedGate.roller;

  await setRV(monsterName, latchKey, currentRound, campaignName);
  await setRV(monsterName, MONSTER_REACTION_USES_KEY, { ...(storedUses || {}), burst_of_ingenuity: gate.used + 1 }, campaignName);
  const buffs = getRV(roller.name, 'activeBuffs') || [];
  const buff = buildBurstOfIngenuityBuff(action, monsterName, currentRound);
  await setRV(roller.name, 'activeBuffs', [...(Array.isArray(buffs) ? buffs : []), buff], campaignName);
  addExpiration({
    attackerName: monsterName,
    targetName: roller.name,
    campaignName,
    rounds: undefined,
    expireOnCreatureName: monsterName,
    effects: [{ type: 'remove_active_buff', buffName: BURST_OF_INGENUITY_BUFF_NAME }],
  });
  const remaining = Math.max(0, gate.limit - gate.used - 1);
  const description = `${monsterName} uses Burst of Ingenuity (Reaction) — ${roller.name} gains +${buff.saveBonus} on the next ability check or saving throw it makes (consumed on that roll). 30-ft proximity GM-enforced (gridless advisory, §42). ${gate.limit}/Day · ${remaining} left today.`;
  await log(campaignName, {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: action?.name || 'Burst of Ingenuity',
    description,
    timestamp: Date.now(),
  });
  return { ok: true, message: description, bonus: buff.saveBonus, rollerName: roller.name, remaining };
}
