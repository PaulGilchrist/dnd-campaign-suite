// MA-1488: monster-side Spectator "Spell Reflection" gated reaction for
// reactions[] rows authored automation:{type:"reaction",
// trigger:"spell_miss_or_save_success", effect:"spell_reflection",
// saveType:"DEX", saveDc:12, dcSuccess:"none", damageExpression:"3d6",
// damageType:"Force"} (Spectator — formerly a generic save-shell DC chip whose
// ungated ActionSaveRoll press fired ANY time: no trigger event required, no
// reaction spent, and the dc_success default "half" leaked floor(roll/2)
// damage on a saving-throw SUCCESS the RAW answers with silence — live
// reproduced pre-fix: "✓ SAVE SUCCESS (16 vs DC 12) — 6 damage applied to
// Bandit 1 — HP: 11 → 5" with zero pending spells).
// RAW trigger is two-faced ("succeeds on a saving throw against a spell, OR a
// spell's attack roll misses it") — no existing trigger vocabulary carries
// both halves, so spell_miss_or_save_success is coined here; it is advisory
// on the row (the dispatcher matches def.effect, MA-1463 guardian_protection
// lineage) and the identity probe below is the real gate.
// Press flow mirrors the gated-reaction siblings (hellish_rebuke MA-0329 save
// + damage legs, reflexive_antennae MA-1407 dcSuccess:'none' save leg, jinx
// MA-0895 identity-refusal service shape): round-latch gate FIRST (MA-0013
// counterspell shape) → spell-origin identity probe on the campaign
// lastAttack (isSpellOriginLastAttack MA-0013 seam byte-copied locally — no
// components/ import, redirect MONSTER_REACTION_USES_KEY circular-import
// precedent): the monster must be the TARGET of a spell-origin attack that
// either MISSED it (hit:false, storeCampaignLastAttack MA-0245 stamp) or was
// SAVED against successfully (saveResult:'success' top-level MA-0816 lineage,
// targetResults.some fold §893) — neither face → `outcome` refusal → uses
// gate (At Will sentinel usage:'At Will'+uses:999, MA-1140 shape — the
// counter still spends honestly shield/jinx-style) → attacker (the spell's
// caster) must be an active combatant → latch + spend AWAITED (CLA-361) →
// the CASTER's DEX save vs DC 12 rides the createSaveListener prompt seam
// (hellish_rebuke MA-0725 shape; dcSuccess:'none' — RAW is silent on a
// success, so a successful save pays ZERO, the MV-20 half-leak kill) →
// rollExpression 3d6 Force logged honestly → computeDamageAfterSave
// (fail = full, success = 0, applyDamage.js MA-1242 'none' semantics) →
// applyDamageToTarget hp_change only when > 0 → lastAttack
// spellReflectionResolved identity stamp → ability_use spend log. "One
// creature the spectator can see within 120 feet" collapses to the
// triggering caster press-time — documented GM-enforced advisory (gridless
// §42, seen-not-modeled CLA-325 lineage); "redirect the spell" prose
// fidelity stays a documented residual (the disk JSON row game text is law).
// Refusals are LOG-ONLY (§235d jinx/guardian_protection lineage): NO
// popupHtml ever, so any pending Done popup survives every refused press and
// the zero-spend is honest.
import { addEntry } from '../ui/logService.js';
import { createSaveListener } from '../automation/common/savePrompt.js';
import { applyDamageToTarget, computeDamageAfterSave } from '../rules/combat/applyDamage.js';
import { rollExpression } from '../dice/diceRoller.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// Same key MonsterCardHelpers.js pins (local literal avoids a circular import —
// the dispatcher passes the stored map in, the resolver writes it back).
const MONSTER_REACTION_USES_KEY = 'monsterReactionUses';

export function isMonsterSpellReflectionRow(row) {
  return row?.automation?.type === 'reaction' && row?.automation?.effect === 'spell_reflection';
}

// Byte-mirror of isSpellOriginLastAttack (MonsterCardHelpers MA-0013 seam) —
// local copy keeps the service free of a components/ import (redirect/jinx
// circular-import precedent).
export function spellOriginLastAttack(lastAttack) {
  if (!lastAttack) return false;
  return lastAttack.rollType === 'spell-attack'
    || lastAttack.rollType === 'spell-save'
    || lastAttack.attackType === 'spell'
    || lastAttack.isSpellDamage === true
    || !!lastAttack.damageSchool
    || (lastAttack.saveType != null && lastAttack.saveDc != null);
}

function aimedAtMonster(lastAttack, monsterName) {
  return lastAttack.targetName === monsterName
    || (lastAttack.targetResults || []).some(t => t && t.targetName === monsterName);
}

// Two RAW trigger faces (MA-1488): the spell's attack roll missed the
// spectator (top-level hit:false, storeCampaignLastAttack MA-0245 stamp) or
// the spectator succeeded the spell's saving throw (top-level saveResult
// MA-0816 single-target stamp + targetResults.some fold §893 AoE twin).
function spellMissedMonster(lastAttack, monsterName) {
  return lastAttack.targetName === monsterName && lastAttack.hit === false;
}

function monsterSavedSpell(lastAttack, monsterName) {
  return (lastAttack.targetName === monsterName && lastAttack.saveResult === 'success')
    || (lastAttack.targetResults || []).some(t => t && t.targetName === monsterName && t.saveResult === 'success');
}

// Event-identity probe (jinxIdentityRefusal MA-0895 / mindCorrosion-
// IdentityRefusal MA-1354 lineage, two-faced trigger): spell-origin + aimed
// at the monster + (missed it OR saved against it) + un-reacted + an
// identifiable caster. Returns a refusal reason token or null.
export function spellReflectionIdentityRefusal(lastAttack, monsterName) {
  if (!lastAttack) return 'no_pending_attack';
  if (!spellOriginLastAttack(lastAttack)) return 'spell';
  if (!aimedAtMonster(lastAttack, monsterName)) return 'trigger';
  if (lastAttack.spellReflectionResolved === true) return 'reacted';
  if (!spellMissedMonster(lastAttack, monsterName) && !monsterSavedSpell(lastAttack, monsterName)) return 'outcome';
  if (!lastAttack.attackerName || lastAttack.attackerName === monsterName) return 'attacker';
  return null;
}

const SPELL_REFLECTION_REFUSAL_MESSAGES = {
  round: () => 'Spell Reflection: Reaction already used this round — refused.',
  uses: (limit) => `Spell Reflection: ${limit} uses already spent today — refused.`,
  no_pending_attack: () => 'Spell Reflection: no spell has been cast yet — nothing to reflect.',
  trigger: (m) => `Spell Reflection: ${m} was not the target of the last spell — refused.`,
  spell: () => 'Spell Reflection: the last attack was not spell-origin — it only answers spells.',
  outcome: (m) => `Spell Reflection: the last spell against ${m} neither missed nor was saved — nothing to reflect.`,
  reacted: () => 'Spell Reflection: already responded to that spell — one reflection per trigger.',
  attacker: () => 'Spell Reflection: no identifiable spellcaster behind that spell — refused.',
  spec: () => 'Spell Reflection: no authored numeric save DC / damage formula on the row — refused.',
  caster_inactive: (a) => `Spell Reflection: caster ${a} is not an active combatant — refused.`,
};

function reactionMaxUses(action) {
  if (action?.maxUses != null) return Number(action.maxUses);
  if (action?.uses != null) return Number(action.uses);
  return 1;
}

// Numeric spec read from the authored row — never a baked default before the
// row exists (hellishRebukeSpec MA-0329 / reflexiveAntennaeSpec MA-1407
// spec-read lineage). dcSuccess is authored "none" (MA-1488): a successful
// save pays zero — the default "half" is exactly the MV-20 leak this fix
// kills.
export function spellReflectionSpec(action) {
  const auto = action?.automation || {};
  const saveDc = Number(auto.saveDc ?? action?.save_dc);
  if (!Number.isFinite(saveDc) || saveDc <= 0) return { reason: 'spec', message: SPELL_REFLECTION_REFUSAL_MESSAGES.spec() };
  const formula = auto.damageExpression;
  if (!formula) return { reason: 'spec', message: SPELL_REFLECTION_REFUSAL_MESSAGES.spec() };
  return { spec: { saveDc, formula, saveType: auto.saveType || 'DEX', damageType: auto.damageType || 'Force', dcSuccess: auto.dcSuccess || 'none' } };
}

export function spellReflectionGate({ lastAttack, monsterName, currentRound, storedUses, usedRound, action }) {
  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return { ok: false, reason: 'round', message: SPELL_REFLECTION_REFUSAL_MESSAGES.round() };
  }
  const identity = spellReflectionIdentityRefusal(lastAttack, monsterName);
  if (identity) {
    return { ok: false, reason: identity, message: SPELL_REFLECTION_REFUSAL_MESSAGES[identity](monsterName) };
  }
  const used = Number((storedUses && storedUses.spell_reflection) || 0);
  const limit = reactionMaxUses(action);
  if (used >= limit) {
    return { ok: false, reason: 'uses', message: SPELL_REFLECTION_REFUSAL_MESSAGES.uses(limit) };
  }
  return { ok: true, used, limit, casterName: lastAttack.attackerName };
}

export function buildSpellReflectionRefusalLog({ monsterName, action, reason, message }) {
  return {
    type: 'automation',
    automationType: 'spell_reflection_refused',
    automationDetail: reason,
    characterName: monsterName,
    abilityName: action?.name || 'Spell Reflection',
    description: `Spell Reflection refused (${reason}): ${message}`,
    timestamp: Date.now(),
  };
}

function spellReflectionCasterActive(cs, casterName) {
  const caster = (cs?.creatures || []).find(c => c.name === casterName);
  return Boolean(caster) && Number(caster.currentHp ?? caster.currentHitPoints ?? 0) > 0;
}

// The CASTING creature's DEX save vs the authored DC rides the GM prompt seam
// (createSaveListener, hellish_rebuke MA-0725 shape) — dcSuccess 'none': a
// success pays zero (MV-20 kill), the failure lands the full authored dice.
async function runSpellReflectionSave({ impl, campaignName, monsterName, casterName, spec }) {
  const { promise } = impl.createSave(campaignName, {
    targetName: casterName,
    attackerName: monsterName,
    saveType: spec.saveType,
    saveDc: spec.saveDc,
    dcSuccess: spec.dcSuccess,
    damageFormula: spec.formula,
    damageType: spec.damageType,
    sourceName: 'Spell Reflection',
  });
  const detail = await promise;
  return detail?.success === true;
}

async function rollAndApplySpellReflectionDamage({ impl, log, cs, monsterName, casterName, campaignName, spec, success }) {
  const rolled = impl.rollDamage(spec.formula);
  const rawDamage = rolled?.total ?? 0;
  const finalDamage = computeDamageAfterSave(rawDamage, success, spec.dcSuccess);
  await log(campaignName, {
    type: 'roll',
    characterName: monsterName,
    rollType: 'damage',
    name: 'Spell Reflection Damage',
    formula: spec.formula,
    rolls: rolled?.rolls || [],
    total: rawDamage,
    damageType: spec.damageType,
    targetName: casterName,
    finalDamage,
    description: success
      ? `Spell Reflection: ${spec.formula} ${spec.damageType} = ${rawDamage} vs ${casterName} — ${spec.saveType} save vs DC ${spec.saveDc} SUCCEEDED — RAW is silent on a success, 0 damage (dc_success none, MA-1488 half-leak kill).`
      : `Spell Reflection: ${spec.formula} ${spec.damageType} = ${rawDamage} vs ${casterName} — ${spec.saveType} save vs DC ${spec.saveDc} FAILED — full ${finalDamage} applied.`,
    timestamp: Date.now(),
  });
  if (finalDamage > 0) {
    const characters = (cs?.creatures || []).filter(c => c.type === 'player');
    const applyResult = await impl.applyDamage(cs, casterName, finalDamage, [spec.damageType], { campaignName, characters, attackerName: monsterName });
    if (!applyResult) {
      console.error('[MA-1488] applyDamageToTarget failed — Spell Reflection damage not applied:', { monsterName, casterName, finalDamage });
    }
  }
  return finalDamage;
}

// One chip click: round latch → two-faced spell identity → uses → caster
// active, every refusal zero-spend LOG-ONLY (§235d, popupHtml never); met →
// latch+spend AWAITED (CLA-361) → caster save prompt → dice → 'none' save
// math → hp_change only on failure → identity stamp + spend log. MA-1488.
export async function resolveMonsterSpellReflectionRow({ action, monsterName, campaignName, lastAttack, cs, currentRound, storedUses, usedRound, latchKey, deps = {} }) {
  if (!isMonsterSpellReflectionRow(action)) return { resolved: false, reason: 'not-spell-reflection' };
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const impl = {
    rollDamage: deps.rollExpression || rollExpression,
    createSave: deps.createSaveListener || createSaveListener,
    applyDamage: deps.applyDamageToTarget || applyDamageToTarget,
  };
  const refuse = async (reason, message) => {
    await log(campaignName, buildSpellReflectionRefusalLog({ monsterName, action, reason, message }));
    return { ok: false, reason, message };
  };

  const gate = spellReflectionGate({ lastAttack, monsterName, currentRound, storedUses, usedRound, action });
  if (!gate.ok) return refuse(gate.reason, gate.message);

  const specRead = spellReflectionSpec(action);
  if (specRead.reason) {
    console.error(`[MA-1488] spell_reflection row refused (${specRead.reason})`, action);
    return refuse(specRead.reason, specRead.message);
  }
  const spec = specRead.spec;

  const casterName = gate.casterName;
  if (!spellReflectionCasterActive(cs, casterName)) {
    return refuse('caster_inactive', SPELL_REFLECTION_REFUSAL_MESSAGES.caster_inactive(casterName));
  }

  // Stamp the latch + spend BEFORE resolving (CLA-361 precedent) so a thrown
  // save/damage step cannot leave the Reaction refirable within the round.
  await setRV(monsterName, latchKey, currentRound, campaignName);
  await setRV(monsterName, MONSTER_REACTION_USES_KEY, { ...(storedUses || {}), spell_reflection: gate.used + 1 }, campaignName);

  const success = await runSpellReflectionSave({ impl, campaignName, monsterName, casterName, spec });
  const finalDamage = await rollAndApplySpellReflectionDamage({ impl, log, cs, monsterName, casterName, campaignName, spec, success });

  await setRV('campaign', 'lastAttack', {
    ...lastAttack,
    spellReflectionResolved: true,
    reflectedBy: monsterName,
    reflectionTarget: casterName,
    reflectionSaveSuccess: success,
    reflectionDamage: finalDamage,
  }, campaignName);

  const remaining = Math.max(0, gate.limit - gate.used - 1);
  const entry = {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: 'Spell Reflection',
    description: `${monsterName} uses Spell Reflection (Reaction) — ${casterName} ${success ? 'SUCCEEDED' : 'FAILED'} their DC ${spec.saveDc} ${spec.saveType} save and took ${finalDamage} ${spec.damageType} damage. Seen within 120 ft is GM-enforced (gridless advisory). At Will — unlimited, 1 Reaction per round. ${remaining} left on the counter.`,
    timestamp: Date.now(),
  };
  await log(campaignName, entry);
  return { ok: true, message: entry.description, remaining, saveSuccess: success, finalDamage };
}
