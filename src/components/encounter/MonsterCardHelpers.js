import { getAbilitySaveModifier } from '../../services/shared/abilityLookup.js';
import { findLastAttack } from '../../services/automation/common/damageRollback.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

export function hasEntries(obj) {
  return obj && Object.keys(obj).length > 0;
}

export function hasSenseEntries(senses) {
  if (!senses) return false;
  return senses.blindsight || senses.darkvision || senses.truesight || senses.tremorsense || senses.passive_perception;
}

export function saveAbilityAbbr(full) {
  const map = { Strength: 'STR', Dexterity: 'DEX', Constitution: 'CON', Intelligence: 'INT', Wisdom: 'WIS', Charisma: 'CHA' };
  return map[full] || full?.substring(0, 3).toUpperCase();
}

const abilityNameMap = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
export { abilityNameMap };

export function parseInitiativeBonus(initStr) {
  if (!initStr) return null;
  const match = initStr.match(/^([+-]\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export function formatSenses(senses) {
  const parts = [];
  if (senses.blindsight) parts.push(`blindsight ${senses.blindsight}`);
  if (senses.darkvision) parts.push(`darkvision ${senses.darkvision}`);
  if (senses.truesight) parts.push(`truesight ${senses.truesight}`);
  if (senses.tremorsense) parts.push(`tremorsense ${senses.tremorsense}`);
  if (senses.passive_perception) parts.push(`passive Perception ${senses.passive_perception}`);
  return parts.join(', ');
}

const CONDITIONS = ['blinded', 'charmed', 'cursed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];

// MA-0038: authored failed-save concentration-disadvantage clause (Adult
// Black Dragon Cloud of Insects — "Disadvantage on saving throws to
// maintain Concentration until the end of its next turn"). Not a condition,
// so extractConditionsFromSaveEffect can never see it; this clause parse
// arms the te producer in saveProcessing on a failed save.
export function parseConcentrationDisadvantageClause(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  const re = /disadvantage on saving throws to maintain\s*(?:<\/?strong>)?\s*concentration/i;
  return re.test(saveEffect) ? { effect: 'concentration_disadvantage' } : null;
}

// MA-0073: authored failed-save speed-halved clause (Adult/Ancient Brass
// Dragon Scorching Sands — "the target's Speed is halved until the end of
// its next turn"). Not a condition, so extractConditionsFromSaveEffect can
// never see it; this clause parse arms the speed_half te producer in
// saveProcessing on a failed save (MA-0038 pattern).
export function parseSpeedHalfClause(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  return /speed is halved/i.test(saveEffect) ? { effect: 'speed_half' } : null;
}

// MA-0146: authored failed-save speed-zero clause (Adult White Dragon
// Freezing Burst — "the target's Speed is 0 until the end of the target's
// next turn"). Not a canonical condition, so extractConditionsFromSaveEffect
// can never see it; this clause parse arms the speed_zero producer (te +
// activeCondition) in the picker/saveProcessing failed-save seams
// (MA-0073 parse shape). Byte-inert (null) for rows without the clause.
export function parseSpeedZeroClause(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  return /speed is 0\b/i.test(saveEffect) ? { effect: 'speed_zero' } : null;
}

// MA-0093: authored failed-save subtract-die debuff clause (Adult Copper
// Dragon Giggling Magic — "the target rolls 1d6 whenever it makes an
// ability check or attack roll and subtracts the number rolled"). Maps the
// clause to the registered giggling_magic_debuff te; the parsed die rides
// the te as subtractDie and drives the generalized roll-time consumer
// (computeSubtractDiePenalty). Arms the te producer in saveProcessing on a
// failed save (MA-0073 parse shape).
export function parseSubtractDieClause(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  const m = saveEffect.match(/rolls\s+(\d+d\d+)\b[^.]*subtract(?:s)?\s+the number rolled/i);
  return m ? { effect: 'giggling_magic_debuff', die: m[1].toLowerCase(), displayLabel: 'Giggling Magic' } : null;
}

// MA-0102: authored failed-save weakening clause (Adult Gold Dragon Weakening
// Breath — "Disadvantage on Strength-based D20 Tests and subtracts 3 (1d6)
// from its damage rolls. It repeats the save at the end of each of its turns,
// ending the effect on itself on a success. After 1 minute, it succeeds
// automatically."). Maps the clause to the registered weakening_breath te;
// strCheckDisadvantage rides the generic te field the generalized roll-time
// consumers already read (ray_of_enfeeble_debuff chain, MA-0093 shape), and
// damageSubtractDie carries the die for the damage-roll consumer (NOT
// subtractDie — that key subtracts from d20 tests, wrong RAW here). Arms the
// te producer at the monster cone picker on a failed save (MA-0087 parse
// shape). Byte-inert (null) for rows without the clause.
export function parseWeakeningBreathClause(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  const m = saveEffect.match(/disadvantage on strength-based\s*(?:<\/?strong>)?\s*d20 tests?[^.]*subtract(?:s)?[^.]*\((\d+d\d+)\)/i);
  if (!m) return null;
  return {
    effect: 'weakening_breath',
    strCheckDisadvantage: true,
    damageSubtractDie: m[1].toLowerCase(),
    repeatSave: true,
    autoSuccessMinutes: /after 1 minute/i.test(saveEffect) ? 1 : null,
  };
}

// MA-0079: authored failed-save push clause (Adult Bronze Dragon Repulsion
// Breath — "pushed up to 60 feet straight away from the dragon"). Not a
// condition, so extractConditionsFromSaveEffect can never see it; this clause
// parse arms the push te marker grant in the AoE picker on a failed save
// (MA-0073 parse shape; token movement itself stays GM-enforced §7).
export function parsePushFeetClause(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  const m = saveEffect.match(/push(?:ed)? up to (\d+) feet/i);
  return m ? { feet: Number(m[1]) } : null;
}

// MA-0087: authored failed-save "slowed" rider clause (Adult Copper Dragon
// Slowing Breath — "can't take Reactions; its Speed is halved; and it can
// take either an action or a Bonus Action, not both"). 'slowed' is NOT a
// registered condition (no badge consumer in conditions.json / the sheet), so
// the canonical machinery maps each clause to an EXISTING registered te with a
// live consumer: speed_half (MA-0073), no_reactions, no_action_and_bonus_action
// (Stinking Cloud / slow2024 / CharReactions). Byte-inert (null) for rows
// without any clause. Mirrors the MA-0073 parse shape.
export function parseSlowedClauses(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  const clauses = [];
  if (/speed is halved/i.test(saveEffect)) clauses.push('speed_half');
  if (/can[’']?t take Reactions/i.test(saveEffect)) clauses.push('no_reactions');
  if (/either an action or a Bonus Action[^.]*not both/i.test(saveEffect)) clauses.push('no_action_and_bonus_action');
  return clauses.length > 0 ? { effects: clauses } : null;
}

// MA-0115: authored failed-save AC-penalty clause (Adult Green Dragon
// Noxious Miasma — "the target takes a −2 penalty to AC until the end of
// its next turn"). Not a condition, so extractConditionsFromSaveEffect can
// never see it; this parse arms the ac_penalty te producer at the failed-
// save seams (saveProcessing + SaveAttackAoeModal picker, MA-0073 parse
// shape). Value N parsed from the −N/-N token; the live consumer
// (conditionEffects acPenalty accumulation) already folds it into AC.
// Byte-inert (null) for rows without the clause.
export function parseAcPenaltyClause(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  const m = saveEffect.match(/[\u2212-]\s*(\d+)\s*penalt(?:y|ies) to AC/i);
  return m ? { effect: 'ac_penalty', value: Number(m[1]) } : null;
}

// MA-0104: authored failed-save demiplane-transport clause (Adult/Ancient
// Gold Dragon Banish — "transported to a harmless demiplane until the start
// of the dragon's next turn"). Not a condition, so extractConditionsFromSaveEffect
// can never see it; this parse arms the banished_demiplane te producer at the
// failed-save seam in saveProcessing (MA-0073 parse shape). Distinct te from
// the PC spell `banishment` (concentration/permanent semantics would misfire
// its badge/handler consumers). Byte-inert (null) for rows without the clause;
// "trapped in a demiplane inside the Soul Tome" (different wording) never
// matches. Reappearance placement stays GM-enforced §7.
export function parseBanishTransportClause(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  return /transported to a harmless demiplane/i.test(saveEffect) ? { effect: 'banished_demiplane' } : null;
}

// MA-0107: authored failed-save dream-plane banishment clause (Adult Gold
// Dragon lair action "Dream Plane Banishment" — "banished to a dream plane,
// a different plane of existence the dragon has imagined into being"). Not a
// condition, so extractConditionsFromSaveEffect can never see it; this parse
// arms the lair_dream_plane te producer at the failed-save seam in
// saveProcessing (MA-0104 parse shape). Distinct te from the MA-0104
// `banished_demiplane` (Banish wording never matches) and from the PC spell
// `banishment`. Byte-inert (null) for rows without the clause; the ancient
// gold dragon's lair dict gained the clause in MA-0222 (byte-mirror here).
export function parseDreamPlaneBanishClause(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  return /banished to a dream plane/i.test(saveEffect) ? { effect: 'lair_dream_plane' } : null;
}

export function extractConditionsFromSaveEffect(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return [];
  const found = [];
  for (const condition of CONDITIONS) {
    const regex = new RegExp(`\\b${condition}\\b`, 'i');
    if (regex.test(saveEffect)) {
      found.push(condition);
    }
  }
  return found;
}

// MA-0003/MA-0012: spell names in Spellcasting descriptions are marked up
// as either <strong>Name</strong> or <em>Name</em> across monsters.json —
// both markups yield clickable per-spell links.
export function extractSpellNamesFromSpellcasting(description) {
  if (!description || typeof description !== 'string') return [];
  const names = [];
  const re = /<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g;
  let match;
  while ((match = re.exec(description)) !== null) {
    const name = match[1].trim();
    if (!name || name.endsWith(':')) continue;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

export function extractSpellcastingSpellUses(description) {
  if (!description || typeof description !== 'string') return {};
  const uses = {};
  const re = /<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g;
  let match;
  let limit = null;
  while ((match = re.exec(description)) !== null) {
    const text = match[1].trim();
    if (!text) continue;
    const dayHeader = text.match(/^(\d+)\s*\/\s*Day(?:\s*Each)?:?$/i);
    if (dayHeader) { limit = parseInt(dayHeader[1], 10); continue; }
    if (text.endsWith(':')) { limit = null; continue; }
    if (limit != null) uses[text] = limit;
  }
  return uses;
}

export function spellHasDamage(spell) {
  if (!spell) return false;
  const damage = spell.damage;
  if (!damage) return false;
  if (damage.damage_dice) return true;
  return Object.keys(damage.damage_at_slot_level || {}).length > 0;
}

export function spellDamageFormulaAtBaseLevel(spell) {
  if (!spellHasDamage(spell)) return null;
  const damage = spell.damage;
  return damage.damage_dice
    || damage.damage_at_slot_level?.[String(spell.level)]
    || Object.values(damage.damage_at_slot_level || {})[0]
    || null;
}

// MA-0033: spells.json attack_type marks a spell as attack-roll based
// (ranged/melee) — it must resolve as an attack roll vs an armed target
// through the attack seam, NEVER as a block save.
export function isSpellAttackSpell(spell) {
  return spell?.attack_type === 'ranged' || spell?.attack_type === 'melee';
}

export function spellDamageFormulaAtLevel(spell, level) {
  if (!spellHasDamage(spell)) return null;
  const atLevel = spell.damage.damage_at_slot_level?.[String(level)];
  if (atLevel) return atLevel;
  return spellDamageFormulaAtBaseLevel(spell);
}

// MA-0033: "(level N version)" is the monsters.json authored-upcast
// convention (adult black dragon "Melf's Acid Arrow (level 3 version)").
// Parsed at cast time; falls back to the spell's base level.
export function spellCastLevelFromSpellcasting(description, spellName, spell) {
  const base = spell?.level ?? null;
  if (!description || !spellName) return base;
  const esc = String(spellName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const near = new RegExp(`${esc}(?:</(?:strong|em)>)?\\s*\\(level (\\d+) version\\)`, 'i');
  const m = description.match(near) || description.match(/\(level (\d+) version\)/i);
  return m ? Number(m[1]) : base;
}

// MA-0033: to-hit for a monster spell attack — authored spell_attack_bonus
// (bullywug-bog-sage convention) or the "+N to hit with spell attacks"
// prose in the Spellcasting row.
export function monsterSpellAttackBonus(action) {
  if (action?.spell_attack_bonus != null) return Number(action.spell_attack_bonus);
  const m = /(\+\d+)\s+to hit with spell attacks/i.exec(action?.description || '');
  return m ? Number(m[1]) : null;
}

export function toAbbr(name) {
  const ABBR_MAP = { Strength: 'str', Dexterity: 'dex', Constitution: 'con', Intelligence: 'int', Wisdom: 'wis', Charisma: 'cha', str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha' };
  return ABBR_MAP[name] || name?.substring(0, 3).toLowerCase();
}

function getCreatureSaveModifier(creature, abilityKey) {
  if (!creature) return 0;
  if (creature.saving_throws?.[abilityKey] != null) {
    return creature.saving_throws[abilityKey].modifier;
  }
  if (creature.ability_score_modifiers?.[abilityKey] != null) {
    return creature.ability_score_modifiers[abilityKey];
  }
  return 0;
}

export function getSaveModifierForSaveType(saveType, target, characters, creatures) {
  const abilityKey = toAbbr(saveType);
  if (!abilityKey || !target) return 0;

  if (target.type === 'player') {
    const playerChar = characters?.find(c => c.name === target.name);
    if (playerChar?.abilities) {
      return getAbilitySaveModifier(playerChar.abilities, abilityKey);
    }
    return getCreatureSaveModifier(creatures?.find(c => c.name === target.name), abilityKey);
  }

  return getCreatureSaveModifier(target, abilityKey);
}

// MA-0006: gated monster reactions (e.g. Aarakocra Aeromancer Feather Fall
// 1/Day). Rows carry automation {type:'reaction', trigger:'falling',
// effect:'feather_fall'}; the monster card gates them on the campaign
// lastAttack CLA-315 'falling' trigger seam (no fall-damage pipeline exists —
// negation is recorded advisory, GM-enforced for monsters, CLA-325 precedent).
export const MONSTER_REACTION_USES_KEY = 'monsterReactionUses';

// MA-0007: conditional charge-damage clause (e.g. Aarakocra Skirmisher Talons
// "3d4+2 if moved 30+ ft straight toward the target"). The app has no monster
// movement-distance subsystem (§7), so the clause surfaces as a GM-adjudication
// offer on the attack HIT popup (CLA-325 advisory precedent).
function chargeClauseFeet(condition) {
  const m = /(\d+)\s*(?:\+\s*)?feet/i.exec(condition);
  return m ? Number(m[1]) : null;
}

function chargeOfferLabel(feet, dice, modifier, damageType) {
  const head = feet ? `${feet}+ ft Charge` : 'Charge';
  const modText = modifier ? `+${modifier}` : '';
  return `${head}: +${dice}${modText} ${damageType}?`;
}

export function buildChargeBonusOffer(action, name) {
  const cd = action?.conditional_damage;
  if (!cd?.dice) return null;
  const modifier = Number(cd.modifier) || 0;
  const damageType = cd.damage_type || action?.damage_type_primary || '';
  const condition = cd.condition || '';
  const formula = modifier ? `${cd.dice} + ${modifier}` : cd.dice;
  return {
    dice: cd.dice,
    modifier,
    damageType,
    condition,
    formula,
    label: chargeOfferLabel(chargeClauseFeet(condition), cd.dice, modifier, damageType),
    attackName: name || action?.name || 'Attack',
  };
}

// MA-0010: monster attack-hit grapple/restrain clause (monsters.json
// hit_conditions + escape_dc). Forwarded onto the attack context so the
// plain-damage handler can apply the conditions to the target on a hit.
// MA-0016: hit_target_effect (e.g. 'no_healing' — Aberrant Spirit (Slaad)
// Claw "can't regain Hit Points") rides the same clause as a te write.
export function buildHitConditionClause(action) {
  const conditions = Array.isArray(action?.hit_conditions) ? action.hit_conditions.map(c => String(c).toLowerCase()) : [];
  const targetEffect = action?.hit_target_effect || null;
  if (conditions.length === 0 && !targetEffect) return null;
  return {
    conditions,
    escapeDc: action.escape_dc != null ? Number(action.escape_dc) : null,
    attackName: action?.name || 'Attack',
    targetEffect,
  };
}

// MA-0019: structured target-eligibility prerequisite (monsters.json
// target_prerequisite, e.g. Aboleth Consume Memories — "Charmed or
// Grappled by the aboleth"). by_attacker requires the condition's
// activeConditionMeta[cond].source to match the monster (provenance
// stamped by the MA-0010 hit-clause and save-fail condition seams).
export function parseTargetPrerequisite(action) {
  const tp = action?.target_prerequisite;
  if (!tp || !Array.isArray(tp.conditions) || tp.conditions.length === 0) return null;
  return {
    conditions: tp.conditions.map(c => String(c).toLowerCase()),
    byAttacker: tp.by_attacker === true,
    attackName: action?.name || 'Action',
  };
}

export function targetPrerequisiteSatisfied({ prerequisite, conditions, conditionMeta, monsterName }) {
  if (!prerequisite) return { satisfied: true };
  for (const cond of prerequisite.conditions) {
    if (!(conditions || []).some(c => String(c).toLowerCase() === cond)) continue;
    if (!prerequisite.byAttacker) return { satisfied: true, condition: cond };
    if ((conditionMeta?.[cond]?.source || null) === monsterName) return { satisfied: true, condition: cond };
  }
  return { satisfied: false };
}

export function evaluateTargetPrerequisiteGate({ action, target, monsterName, campaignName, getRuntimeValue }) {
  const prerequisite = parseTargetPrerequisite(action);
  if (!prerequisite) return { prerequisite: null, satisfied: true };
  const conditions = getRuntimeValue(target?.name, 'activeConditions', campaignName) || [];
  const conditionMeta = getRuntimeValue(target?.name, 'activeConditionMeta', campaignName) || {};
  const result = targetPrerequisiteSatisfied({ prerequisite, conditions, conditionMeta, monsterName });
  if (result.satisfied) return { prerequisite, satisfied: true };
  const conditionLabels = prerequisite.conditions.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' or ');
  const targetLabel = target?.name || 'the target';
  return {
    prerequisite,
    satisfied: false,
    popupHtml: `<div class="mc-prerequisite-refusal"><h3>Prerequisite Not Met</h3><p>${monsterName} can't use ${action.name} on ${targetLabel} — the target must be ${conditionLabels} by ${monsterName}. No save rolled, nothing spent (GM-enforced target eligibility).</p></div>`,
    refusalLog: buildTargetPrerequisiteRefusalLog({ monsterName, actionName: action.name, targetName: target?.name || 'no target', prerequisite }),
  };
}

export function buildTargetPrerequisiteRefusalLog({ monsterName, actionName, targetName, prerequisite }) {
  const slug = String(actionName || prerequisite?.attackName || 'action').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const conditionLabels = prerequisite.conditions.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' or ');
  return {
    type: 'automation',
    automationType: `${slug}_refused`,
    characterName: monsterName,
    abilityName: actionName || prerequisite?.attackName,
    targetName,
    description: `${monsterName} ${actionName} refused — ${targetName} does not satisfy the prerequisite (${conditionLabels}${prerequisite.byAttacker ? ` by ${monsterName}` : ''}). No save rolled, nothing spent.`,
    timestamp: Date.now(),
  };
}

// MA-0030: authored success-immunity (e.g. Abominable Yeti Chilling Gaze —
// "Success: immune to this yeti's Chilling Gaze for 1 hour"). A target that
// already carries the te sourced from this monster refuses the row click:
// popup + <action>_refused (immunity) log, zero save prompt.
export function parseSuccessImmunity(action) {
  const si = action?.success_immunity;
  if (!si || !si.effect) return null;
  return {
    effect: String(si.effect),
    duration: si.duration || '1_hour',
    durationMinutes: Number(si.duration_minutes) || 60,
  };
}

export function gazeImmunityActive({ action, target, monsterName, targetEffects }) {
  const immunity = parseSuccessImmunity(action);
  if (!immunity || !target) return null;
  const te = (targetEffects || []).find(e =>
    e.target === target.name && e.effect === immunity.effect && e.source === monsterName);
  return te ? immunity : null;
}

export function buildGazeImmunityRefusalLog({ monsterName, actionName, targetName }) {
  const slug = String(actionName || 'action').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return {
    type: 'automation',
    automationType: `${slug}_refused (immunity)`,
    characterName: monsterName,
    abilityName: actionName,
    targetName,
    description: `${targetName} is immune to ${monsterName}'s ${actionName} (save-granted immunity) — no save rolled, no damage, nothing spent.`,
    timestamp: Date.now(),
  };
}

export function buildChargeBonusGrantLog({ monsterName, offer, total }) {
  return {
    type: 'automation',
    automationType: 'conditional_damage_granted',
    characterName: monsterName,
    abilityName: offer.attackName,
    description: `${monsterName} ${offer.attackName} charge bonus granted (${offer.condition}) — +${total} ${offer.damageType} (${offer.formula}).`,
    timestamp: Date.now(),
  };
}

export function buildChargeBonusDeclineLog({ monsterName, offer }) {
  return {
    type: 'automation',
    automationType: 'conditional_damage_declined',
    characterName: monsterName,
    abilityName: offer.attackName,
    description: `${monsterName} ${offer.attackName} charge bonus declined (${offer.condition}) — base damage only.`,
    timestamp: Date.now(),
  };
}

const GATED_MONSTER_REACTIONS = {
  feather_fall: { effect: 'feather_fall', trigger: 'falling', label: 'Feather Fall', icon: 'fa-feather' },
  // MA-0013: Aberrant Cultist Counterspell (2/Day) — reactive spell-cast
  // reaction. Gate is a spell-origin campaign lastAttack by a NON-monster
  // attacker, unresolved-as-countered (CLA-325 spell-origin seam). RAW:
  // spell level <3 auto-countered; ≥3 ability check d20+spellcasting mod
  // vs DC 10+spellLevel (CLA-322 dispel shape, single ability mod — no PB).
  counterspell: { effect: 'counterspell', trigger: 'enemy_spell_cast', label: 'Counterspell', icon: 'fa-shield' },
};

export function isSpellOriginLastAttack(lastAttack) {
  if (!lastAttack) return false;
  return lastAttack.rollType === 'spell-attack'
    || lastAttack.rollType === 'spell-save'
    || lastAttack.attackType === 'spell'
    || lastAttack.isSpellDamage === true
    || !!lastAttack.damageSchool
    || (lastAttack.saveType != null && lastAttack.saveDc != null);
}

// A counterspell reaction must be provoked by someone ELSE's spell — a
// monster-origin lastAttack (this creature's own spell, or any monster cast)
// never satisfies the trigger, so PC attacker type is required.
export function counterspellTriggerSatisfied({ lastAttack, attackerIsPC }) {
  return isSpellOriginLastAttack(lastAttack) && attackerIsPC === true;
}

export function counterspellGate({ lastAttack, attackerIsPC, monsterName, currentRound, storedUses, usedRound, action }) {
  if (!counterspellTriggerSatisfied({ lastAttack, attackerIsPC })) {
    return { ok: false, reason: 'trigger', message: `Counterspell: no enemy spell to counter — ${monsterName} can only react to a spell cast by another creature.` };
  }
  if (lastAttack.counterspellResolved === true) {
    return { ok: false, reason: 'countered', message: `Counterspell: ${lastAttack.attackName || 'that spell'} is already resolved against — refused.` };
  }
  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return { ok: false, reason: 'round', message: `Counterspell: Reaction already used this round — refused.` };
  }
  const used = Number((storedUses && storedUses.counterspell) || 0);
  const limit = reactionMaxUses(action);
  if (used >= limit) {
    return { ok: false, reason: 'uses', message: `Counterspell: ${limit}/Day uses already spent today — refused. Uses reset at a long rest; GM-enforced for monsters.` };
  }
  return { ok: true, used, limit };
}

// CLA-322 dispel-check shape: level <3 auto-countered (no roll); ≥3 d20 +
// spellcasting ability modifier vs DC 10 + spell level (ability mod only,
// never PB stacked). rollD20 is a thunk so the auto path never rolls.
export function resolveCounterspellCheck({ spellLevel, abilityMod, rollD20 }) {
  const level = Number(spellLevel) || 0;
  if (level < 3) return { auto: true, countered: true, spellLevel: level };
  const raw = typeof rollD20 === 'function' ? rollD20() : rollD20;
  const d20 = Number(raw);
  const mod = Number(abilityMod) || 0;
  const total = d20 + mod;
  const targetDC = 10 + level;
  return { auto: false, countered: total >= targetDC, d20, mod, total, targetDC, spellLevel: level };
}

export function getGatedMonsterReaction(action) {
  const effect = action?.automation?.effect;
  return effect ? GATED_MONSTER_REACTIONS[effect] || null : null;
}

export function monsterReactionUsesRemaining(action, storedUses) {
  const maxUses = action?.maxUses ?? action?.uses ?? null;
  if (maxUses == null) return null;
  const used = Number(storedUses?.[action?.automation?.effect]) || 0;
  return Math.max(0, maxUses - used);
}

function lastAttackTrigger(lastAttack) {
  if (!lastAttack) return null;
  if (lastAttack.trigger) return lastAttack.trigger;
  if (lastAttack.attackEvent && lastAttack.attackEvent.trigger) return lastAttack.attackEvent.trigger;
  return null;
}

function reactionInvolvesMonster(lastAttack, monsterName) {
  return Boolean(lastAttack) && (lastAttack.attackerName === monsterName || lastAttack.targetName === monsterName);
}

function reactionMaxUses(action) {
  if (action && action.maxUses != null) return Number(action.maxUses);
  if (action && action.uses != null) return Number(action.uses);
  return 1;
}

export function monsterReactionGate({ def, action, monsterName, lastAttack, currentRound, storedUses, usedRound }) {
  if (lastAttackTrigger(lastAttack) !== def.trigger) {
    return { ok: false, reason: 'trigger', message: `${def.label}: no falling event — ${monsterName} can only react to a fall.` };
  }
  if (!reactionInvolvesMonster(lastAttack, monsterName)) {
    return { ok: false, reason: 'actor', message: `${def.label}: ${monsterName} is not the falling creature — refused.` };
  }
  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return { ok: false, reason: 'round', message: `${def.label}: Reaction already used this round (1/round) — refused.` };
  }
  const used = Number((storedUses && storedUses[def.effect]) || 0);
  const limit = reactionMaxUses(action);
  if (used >= limit) {
    return { ok: false, reason: 'uses', message: `${def.label}: 1/Day uses already spent today — refused. Uses reset at a long rest; GM-enforced for monsters.` };
  }
  return { ok: true, used, limit };
}

export async function resolveMonsterGatedReaction({ action, monsterName, campaignName, deps = {} }) {
  const def = getGatedMonsterReaction(action);
  if (!def) return null;
  const findLast = deps.findLastAttack || findLastAttack;
  const getCombat = deps.getCombatContext || getCombatContext;
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const latchKey = `_${def.effect}_usedRound`;
  const lastAttack = await findLast(campaignName);
  const cs = await getCombat(campaignName);
  const currentRound = Number(cs?.round ?? 1);
  const storedUses = getRV(monsterName, MONSTER_REACTION_USES_KEY) || {};
  const usedRound = Number(getRV(monsterName, latchKey) ?? 0);

  if (def.effect === 'counterspell') {
    // Read the RAW campaign lastAttack (not findLastAttack's normalized
    // wrapper, which drops spell-origin fields like rollType/damageSchool).
    const rawLastAttack = await getRV('campaign', 'lastAttack') || lastAttack;
    return resolveMonsterCounterspell({ action, monsterName, campaignName, lastAttack: rawLastAttack, cs, currentRound, storedUses, usedRound, latchKey, deps });
  }

  const gate = monsterReactionGate({ def, action, monsterName, lastAttack, currentRound, storedUses, usedRound });
  if (!gate.ok) {
    await log(campaignName, {
      type: 'automation',
      characterName: monsterName,
      automationType: `${def.effect}_refused`,
      name: def.label,
      description: `${def.label} refused (${gate.reason}): ${gate.message}`,
      timestamp: Date.now(),
    });
    return { ok: false, message: gate.message };
  }
  await setRV(monsterName, latchKey, currentRound, campaignName);
  await setRV(monsterName, MONSTER_REACTION_USES_KEY, { ...storedUses, [def.effect]: gate.used + 1 }, campaignName);
  const remaining = Math.max(0, gate.limit - gate.used - 1);
  const message = `${monsterName} uses ${def.label} — falling damage negated (GM-enforced for monsters — advisory record, no fall-damage pipeline). ${gate.limit}/Day · ${remaining} left today.`;
  await log(campaignName, {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: def.label,
    description: message,
    timestamp: Date.now(),
  });
  return { ok: true, message, remaining };
}

// MA-0013: reactive Counterspell for monsters. Mirrors MA-0006 gated-reaction
// economy (round latch + MONSTER_REACTION_USES spend + zero-spend refusals) and
// CLA-322 dispel-check shape (level <3 auto; ≥3 d20+ability mod vs DC 10+level).
// The triggering lastAttack is stamped `counterspellResolved:true` so a second
// click on the same cast is refused (no double-countering), pass or fail.
async function resolveMonsterCounterspell({ action, monsterName, campaignName, lastAttack, cs, currentRound, storedUses, usedRound, latchKey, deps }) {
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const rollD20 = deps.rollD20 || (() => Math.floor(Math.random() * 20) + 1);
  const getCreature = deps.findCreatureByName || ((ctx, name) => (ctx?.creatures || []).find(c => c.name === name) || null);
  // Spell level of the triggering cast: prefer a stamped level, else resolve
  // via the spells.json lookup the modal provides (deps.resolveSpellLevel).
  const resolveLevel = deps.resolveSpellLevel || (async (la) => Number(la?.spellLevel ?? la?.overchannelSpellLevel ?? 0));
  const attackerCreature = lastAttack?.attackerName ? getCreature(cs, lastAttack.attackerName) : null;
  const attackerIsPC = attackerCreature?.type === 'player';
  // The ability check is the MONSTER's spellcasting check (Aberrant Cultist
  // WIS +4) — the counter, not the original caster's, per RAW "same
  // spellcasting ability as Spellcasting".
  const abilityMod = Number(deps.spellAbilityMod) || 0;
  const gate = counterspellGate({ lastAttack, attackerIsPC, monsterName, currentRound, storedUses, usedRound, action });
  if (!gate.ok) {
    await log(campaignName, {
      type: 'automation',
      characterName: monsterName,
      automationType: 'counterspell_refused',
      name: 'Counterspell',
      description: `Counterspell refused (${gate.reason}): ${gate.message}`,
      timestamp: Date.now(),
    });
    return { ok: false, message: gate.message };
  }
  const spellLevel = await resolveLevel(lastAttack);
  const outcome = resolveCounterspellCheck({ spellLevel, abilityMod, rollD20 });
  await setRV(monsterName, latchKey, currentRound, campaignName);
  await setRV(monsterName, MONSTER_REACTION_USES_KEY, { ...storedUses, counterspell: gate.used + 1 }, campaignName);
  const spellName = lastAttack?.attackName || 'the triggering spell';
  const remaining = Math.max(0, gate.limit - gate.used - 1);
  // Stamp the triggering lastAttack as resolved against (MA-0013) — a second
  // click on the same cast is refused, whether the counter succeeded or failed.
  await setRV('campaign', 'lastAttack', {
    ...lastAttack,
    counterspellResolved: true,
    counteredSpell: spellName,
    counteredBy: monsterName,
    counterspellCheckFailed: outcome.countered !== true,
  }, campaignName);
  const message = buildCounterspellMessage({ monsterName, spellName, outcome, limit: gate.limit, remaining });
  await log(campaignName, {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: 'Counterspell',
    description: message,
    timestamp: Date.now(),
  });
  return { ok: true, countered: outcome.countered, message, remaining };
}

function buildCounterspellMessage({ monsterName, spellName, outcome, limit, remaining }) {
  const tail = `${limit}/Day · ${remaining} left today.`;
  if (outcome.auto) return `${monsterName} Counterspells ${spellName} (spell level ${outcome.spellLevel} < 3) — auto-countered. ${tail}`;
  const verdict = outcome.countered ? 'countered' : 'failed — spell resolves';
  return `${monsterName} Counterspells ${spellName}: ability check d20 (${outcome.d20}) + ${outcome.mod} = ${outcome.total} vs DC ${outcome.targetDC} — ${verdict}. ${tail}`;
}

// MA-0049: structured `usage` objects must never render as "[object Object]"
// (MV-26). Flat strings stay verbatim; d6-recharge shapes are owned by
// RechargeNote/monsterRecharge.js (null here, so the note never doubles up).
export function formatActionUsage(usage) {
  if (usage == null) return null;
  if (typeof usage === 'string') return usage;
  if (typeof usage !== 'object') return String(usage);
  const type = String(usage.type || '').toLowerCase();
  if (/recharge/.test(type)) return null;
  if (type === 'per day' && usage.times != null) return `${usage.times}/Day`;
  console.error('[MonsterCardHelpers] unformattable monster action usage', usage);
  return null;
}

// MA-0049: save-row safety gate — a single-target block save clicked with no
// armed target refuses instead of degrading to a self-target roll.
export function buildNoTargetRefusalPopup({ monsterName, actionName }) {
  return `<div class="mc-no-target-refusal"><h3>No Target</h3><p>${monsterName} cannot use ${actionName} — no target is armed on ${monsterName}'s initiative card. Arm a target on the initiative card first (AoE rows pick their own area targets). No save rolled, nothing spent.</p></div>`;
}

export function buildNoTargetRefusalLog({ monsterName, actionName }) {
  const slug = String(actionName || 'action').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return {
    type: 'automation',
    automationType: `${slug}_refused`,
    characterName: monsterName,
    abilityName: actionName,
    description: `${monsterName} ${actionName} refused (no target) — no armed target on the initiative card, no self-resolve. Zero spend, no save prompt.`,
    timestamp: Date.now(),
  };
}
