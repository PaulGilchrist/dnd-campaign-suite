import { getAbilitySaveModifier } from '../../services/shared/abilityLookup.js';
import { findLastAttack } from '../../services/automation/common/damageRollback.js';
import { createSaveListener } from '../../services/automation/common/savePrompt.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { applyDamageToTarget, computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';
import { isWithinRange } from '../../services/rules/combat/rangeCheck.js';
import { rangeToFeet } from '../../services/rules/combat/rangeValidation.js';
import { rollExpression, canRollExpression } from '../../services/dice/diceRoller.js';
import { applyHealingToTarget } from '../../services/rules/combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { MONSTER_RECHARGE_KEY, monsterRechargeGate, spendMonsterRecharge, rechargeActionKey, parseRechargeThreshold, buildRechargeRefusalPopup, buildRechargeRefusalLog } from '../../services/encounters/monsterRecharge.js';
import { registerTargetEffect } from '../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../services/rules/effects/expirationQueue.js';

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

// MA-0303: authored both-outcomes tail clause (Arch-hag Crackling Wave —
// "Failure or Success: The target is cursed until the end of the hag's next
// turn. The target can't take Reactions until the curse ends."). Every AoE
// picker seam is fail-only (applySaveFailConditions early-returns on
// saveSuccess), so the tail clauses never landed on a successful save. This
// parse arms a success-leg grant of ONLY what the tail after
// "Failure or Success:" itself names: canonical conditions (MA-0063
// extraction scoped to the tail) + the registered no_reactions te (MA-0087
// key), drained by ONE rounds:2 clock (MA-0073 shape). Every other
// "Failure or Success:" row — caster recharge restrictions ("can't take this
// action again", Kraken/Lich/Solar/Cataclysm/dragon legendaries), 0-HP
// thresholds (Colossus Divine Beam, Juvenile Shadow Shadow Breath), Animal
// Lord variant lists, Steam Mephit resistance notes, Succubus HP-max
// drain — names no canonical condition and no Reactions clause in its tail →
// null (byte-inert outside this row family). MA-0087 parse shape.
export function parseBothOutcomesClause(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  const m = saveEffect.match(/failure or success:\s*([\s\S]*)/i);
  if (!m) return null;
  const tail = m[1];
  const conditions = extractConditionsFromSaveEffect(tail);
  const effects = /can[’']?t take Reactions/i.test(tail) ? ['no_reactions'] : [];
  if (conditions.length === 0 && effects.length === 0) return null;
  return { conditions, effects };
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
// MA-0298: authored failed-save Soul Tome trap clause (Arcanaloth Banishing
// Claw — "the target is trapped in a demiplane inside the Soul Tome ... the
// target repeats the save, escaping the tome on a success"). RAW byte stays
// "trapped" (parseBanishTransportClause MA-0104 matches "transported to a
// harmless demiplane" ONLY — its wording never matches here and vice versa).
// Distinct soulTome flag arms the INDEFINITE trap producer (soulTomeTrapService
// — no expiry clock until a repeat save ends it), per the MA-0104 te shape with
// duration honest. Byte-inert (null) for every other row.
export function parseSoulTomeTrapClause(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  return /trapped in a demiplane/i.test(saveEffect) ? { effect: 'banished_demiplane', soulTome: true } : null;
}

export function parseDreamPlaneBanishClause(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  return /banished to a dream plane/i.test(saveEffect) ? { effect: 'lair_dream_plane' } : null;
}

// MA-0275: Animal Lord "Animal Spirit" authored variant trio ("Failure or
// Success: One of the following effects occurs: Fortify (Forager Only) —
// 20 Temporary Hit Points / Marked as Prey (Hunter Only) — Advantage on
// attack rolls against the target until the start of the animal lord's next
// turn / Pesky Swarm (Sage Only) — Disadvantage on attack rolls and ability
// checks until the end of its next turn"). The lord represents ONE form
// (DM's choice), so the GM picks the variant at the chip-click chooser
// (MonsterCardModal); the chosen clause lands state + log at the save
// outcome seam (saveProcessing). Byte-inert (null) for every row that does
// not carry ALL three named variant headers — no other wording matches.
export function parseAnimalSpiritVariants(action) {
  const saveEffect = action?.save_effect;
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  const fortify = /fortify\s*\(\s*forager only\s*\)/i.test(saveEffect);
  const prey = /marked as prey\s*\(\s*hunter only\s*\)/i.test(saveEffect);
  const swarm = /pesky swarm\s*\(\s*sage only\s*\)/i.test(saveEffect);
  if (!fortify || !prey || !swarm) return null;
  const thpMatch = saveEffect.match(/gains\s+(\d+)\s+temporary hit points/i);
  const rangeMatch = String(action.description || '').match(/within\s+(\d+)\s*feet/i);
  return {
    rangeFt: rangeMatch ? Number(rangeMatch[1]) : null,
    variants: [
      { key: 'fortify', label: 'Fortify', form: 'Forager', tempHp: Number(thpMatch?.[1]) || 20 },
      { key: 'marked_as_prey', label: 'Marked as Prey', form: 'Hunter' },
      { key: 'pesky_swarm', label: 'Pesky Swarm', form: 'Sage' },
    ],
  };
}

// MA-0367: authored infernal-wound row (Bearded Devil Infernal Glaive —
// "If the target is a creature and doesn't already have an infernal wound,
// it is subjected to ... loses 1d10 Hit Points at the start of each of its
// turns ... closes after 1 minute / healing / DC 12 Wisdom (Medicine)").
// "Infernal wound" is not a canonical condition, so extractConditionsFromSaveEffect
// can never see it; the parser arms the registered infernal_wound te producer
// at the save fail seams (saveProcessing + save-result + NPC save-damage) from
// the MA-0367 structured keys — rows without hit_target_effect stay byte-inert
// (null), so no other monster's wound prose can double-arm.
export function parseInfernalWoundClause(action) {
  if (!action || action.hit_target_effect !== 'infernal_wound') return null;
  return {
    effect: 'infernal_wound',
    bleedDie: String(action.wound_bleed_die || '1d10').toLowerCase(),
    expiresMinutes: Number(action.wound_expires_minutes) || 1,
    medicineDc: Number(action.wound_medicine_dc) || 12,
  };
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

// MA-0348: damageless save spells (Bandit Deceiver Hold Person) live on the
// spells.json text, not the monster row — "The target must succeed on a
// wisdom saving throw or be paralyzed". Spells with damage keep routing via
// spellHasDamage; zone spells stay advisory (CLA-325: no zone/movement
// engine consumer, MA-0003 Gust of Wind precedent); dc_type must agree with
// the clause ability so a mismatched spell never prompts. The extracted
// condition rides saveConditions to applyFailedSaveConditions (MA-0017 seam).
const SPELL_SAVE_CONDITION_CLAUSE = /must succeed on an? (strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw or be ([a-z]+)/i;
const SPELL_ABILITY_ABBR = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };
export function spellDamagelessSaveCondition(spell) {
  if (!spell?.dc?.dc_type || spell?.area_of_effect) return null;
  const text = [spell?.save_effect, ...(Array.isArray(spell?.description) ? spell.description : [spell?.description])].filter(Boolean).join(' ');
  const match = text.match(SPELL_SAVE_CONDITION_CLAUSE);
  if (!match) return null;
  if (SPELL_ABILITY_ABBR[match[1].toLowerCase()] !== spell.dc.dc_type.toUpperCase()) return null;
  const condition = match[2].toLowerCase();
  return CONDITIONS.includes(condition) ? condition : null;
}

// MA-0362: damage-bearing save spells (Phantasmal Killer) carry their fail
// condition in the spell's own text ("The target must make a wisdom saving
// throw. On a failed save, the target becomes frightened"), not in a row
// save_effect. Sourced only when save_effect yields nothing, the clause
// ability agrees with dc_type, and the tail is a canonical CONDITIONS word
// (MV-31); every spell without the clause stays byte-identical.
const SPELL_MUST_MAKE_SAVE_ABILITY = /must (?:make|succeed on) an? (strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw/i;
const SPELL_FAILED_SAVE_BECOMES_CLAUSE = /on a failed save[,.]?[^.]*?\b(?:becomes?|is|are|remains)\s+([a-z]+)/i;
export function spellDamageLegFailCondition(spell) {
  if (!spell?.dc?.dc_type) return null;
  const text = [spell?.save_effect, ...(Array.isArray(spell?.description) ? spell.description : [spell?.description])].filter(Boolean).join(' ');
  const ability = text.match(SPELL_MUST_MAKE_SAVE_ABILITY);
  if (!ability || SPELL_ABILITY_ABBR[ability[1].toLowerCase()] !== spell.dc.dc_type.toUpperCase()) return null;
  const match = text.match(SPELL_FAILED_SAVE_BECOMES_CLAUSE);
  if (!match) return null;
  const condition = match[1].toLowerCase();
  return CONDITIONS.includes(condition) ? condition : null;
}

// MA-0348: honest duration note for damageless spell save legs — the spell's
// own duration/concentration rides the condition meta as a GM-enforced note
// (MA-0020 until-clause shape; no auto-expiry/Repeat-save consumer exists).
export function spellConditionDurationNote(spell) {
  if (!spell?.duration) return null;
  return `for the spell's duration — ${spell.concentration ? 'Concentration, ' : ''}${spell.duration} (GM-enforced)`;
}

// MA-0348: fail-leg resolver — damage legs parse save_effect exactly as
// before; MA-0362: a damage leg with no save_effect sources its canonical
// failed-save condition from the spell's own text (Phantasmal Killer
// frightened), else stays byte-identical empty; damageless save legs grant
// the spell-text condition with an honest duration note.
export function spellSaveLegOutcome(spell, formula, saveLegCondition) {
  if (formula) {
    const saveConditions = extractConditionsFromSaveEffect(spell?.save_effect);
    if (saveConditions.length > 0) return { saveConditions, conditionDurationNote: null };
    const failCondition = spellDamageLegFailCondition(spell);
    if (failCondition) return { saveConditions: [failCondition], conditionDurationNote: spellConditionDurationNote(spell) };
    return { saveConditions, conditionDurationNote: null };
  }
  return {
    saveConditions: saveLegCondition ? [saveLegCondition] : [],
    conditionDurationNote: spellConditionDurationNote(spell),
  };
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

// MA-0286: an attack row (Melee/Ranged Spell|Weapon Attack wording or an
// attack-type indicator) with NO authored numeric attack_bonus must never
// expose a clickable damage chip — that rolls damage with no to-hit roll /
// AC check (auto-hit). Caster-dependent bonuses ("+spell attack modifier")
// are unresolvable without caster context (MA-0284), so honest suppression
// renders the row as plain text, like the Huge/Large Animated Object
// siblings. Damage-only rows (breath, auras, swallow) keep their chips.
const ATTACK_ROW_WORDING = /\b(?:melee|ranged)\s+(?:spell|weapon)\s+attack\b/i;
export function attackRowMissingToHit(action) {
  if (!action || typeof action !== 'object') return false;
  if (action.attack_bonus != null) return false;
  if (/attack/i.test(String(action.attackType || ''))) return true;
  return ATTACK_ROW_WORDING.test(String(action.description || ''));
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

// MA-0352: authored HP-threshold kill clause (Banshee Deathly Wail —
// "Failure: If the target has 25 Hit Points or fewer, it drops to 0 Hit
// Points"). Numeric threshold arm threaded onto the save context for the
// failed-save threshold-kill seam in saveProcessing. Byte-inert null for
// every row without the authored numeric key.
export function parseHpThresholdKillClause(action) {
  const value = Number(action?.hp_threshold_kill);
  return Number.isFinite(value) && value > 0 ? value : null;
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

// MA-0325: authored two-handed versatile-damage variant (monsters.json
// damage_dice_two_handed, e.g. Azer Warhammer "1d8 + 3, or 1d10 + 3 if used
// with two hands"). ALTERNATIVE primary dice (unlike MA-0007's ADDITIVE
// conditional_damage): the HIT popup offers a GM-adjudicated choice
// (MA-0007 offer-on-result shape); picking two-handed swaps the auto-damage
// formula before Done, so the variant leg can actually surface. Rows without
// the key are byte-inert (null).
export function buildTwoHandedVariantOffer(action, name) {
  const variant = action?.damage_dice_two_handed;
  const base = action?.damage_dice_primary;
  if (!variant || !base || variant === base) return null;
  const damageType = action?.damage_type_primary || '';
  return {
    formula: variant,
    baseFormula: base,
    damageType,
    label: `Two-Handed: ${variant} ${damageType}?`,
    attackName: name || action?.name || 'Attack',
  };
}

// MA-0436: authored melee-or-ranged dual-mode variant (monsters.json
// damage_dice_ranged + range "N/M" band, e.g. Bugbear Javelin "2d6 + 2 in
// melee or 1d6 + 2 at range"). MA-0325 mirror: ALTERNATIVE primary dice
// offered on the HIT popup; picking ranged swaps the Done auto-damage formula.
// Arming requires the authored variant dice AND the melee-or-ranged wording —
// rows without both are byte-inert (null). Range band is advisory
// (gridless-lenient, playbook §42): normalFt/longFt ride the offer for logs.
export function parseRangedBand(range) {
  if (!range || typeof range !== 'string') return null;
  const match = range.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;
  return { normalFt: Number(match[1]), longFt: Number(match[2]) };
}

// MA-0529: dice-identical dual-mode rows (Cult Fanatic Dagger "1d4 + 2" in
// BOTH modes) still carry a RAW 20/60 band — the mode CHOICE is enforced even
// when no dice swap exists, so an authored "N/M" band arms the chooser with
// formula === baseFormula (band advisory rides the ranged-select log). Rows
// with NO band and identical/absent variant dice stay byte-inert (null).
function rangedVariantRowArmed(row, band) {
  const variant = row.damage_dice_ranged;
  const base = row.damage_dice_primary;
  if (!base) return false;
  if (!band && (!variant || variant === base)) return false;
  return /melee or ranged/i.test(row.description || '');
}

export function buildRangedVariantOffer(action, name) {
  const row = action || {};
  const variant = row.damage_dice_ranged;
  const base = row.damage_dice_primary;
  const band = parseRangedBand(row.range);
  if (!rangedVariantRowArmed(row, band)) return null;
  const damageType = row.damage_type_primary || '';
  return {
    formula: variant || base,
    baseFormula: base,
    damageType,
    label: `Ranged: ${variant || base} ${damageType}?`,
    attackName: name || row.name || 'Attack',
    range: row.range || null,
    normalFt: band ? band.normalFt : null,
    longFt: band ? band.longFt : null,
  };
}

// MA-0539: PURE-ranged rows (authored "N/M" band, NO reach, no melee mode) —
// rangeToFeet cannot split bands and no chooser applies (MA-0436 chooser is
// melee-or-ranged only). Gridless/no-token-gate rows record the authored band
// as an advisory rangeReason so the attack log carries band truth.
export function buildRangedBandAdvisory(action) {
  if (!action || action.reach) return null;
  const band = parseRangedBand(action.range);
  if (!band) return null;
  return `Range band ${band.normalFt}/${band.longFt} ft — gridless: advisory (GM-enforced).`;
}

export function buildRangedVariantSelectLog({ monsterName, offer, mode, defaulted = false, rangeNote = null }) {
  const formula = mode === 'ranged' ? offer.formula : offer.baseFormula;
  return {
    type: 'automation',
    automationType: mode === 'ranged' ? 'ranged_variant_selected' : 'melee_variant_selected',
    characterName: monsterName,
    abilityName: offer.attackName,
    description: `${monsterName} ${offer.attackName} ${mode === 'ranged' ? 'RANGED' : 'melee'} variant selected${defaulted ? ' (default — no popup choice made)' : ''} — ${formula} ${offer.damageType} applied on Done.${rangeNote ? ` ${rangeNote}` : ''}`,
    timestamp: Date.now(),
  };
}

export function buildTwoHandedVariantSelectLog({ monsterName, offer, hands, defaulted = false }) {
  const formula = hands === 'two-handed' ? offer.formula : offer.baseFormula;
  return {
    type: 'automation',
    automationType: hands === 'two-handed' ? 'two_handed_variant_selected' : 'one_handed_variant_selected',
    characterName: monsterName,
    abilityName: offer.attackName,
    description: `${monsterName} ${offer.attackName} ${hands === 'two-handed' ? 'TWO-HANDED' : 'one-handed'} variant selected${defaulted ? ' (default — no popup choice made)' : ''} — ${formula} ${offer.damageType} applied on Done.`,
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
  // MA-0329: Azer Pyromancer Hellish Rebuke (2/Day) — reactive spell-damage
  // reaction. RAW trigger: takes damage from a creature it can see within
  // 60 ft (no vision model in-app — seen is GM-enforced advisory, CLA-325).
  // Gate reads the campaign lastAttack the monster as damaged target with
  // damage dealt (same identity/damage fields the PC-side reactionDamage
  // consumers gate on); DEX save vs the authored spell DC (15, MA-0328
  // lineage), 2d10 fire half on save, 2/Day spend + round latch.
  hellish_rebuke: { effect: 'hellish_rebuke', trigger: 'takes_damage', label: 'Hellish Rebuke', icon: 'fa-fire' },
  // MA-0341: Bandit Captain Parry — reactive defense reaction. RAW trigger:
  // hit by a melee attack roll while wielding a weapon (equip precondition is
  // GM-enforced advisory, CLA-325); response +2 AC against THAT attack.
  // Gate keys off the campaign lastAttack identity: melee weaponType, this
  // monster as target, hit, and damage NOT yet applied via Done (abandoned
  // popup window). Press stamps _parry_ac_bonus on the target's activeBuffs
  // (getParryAcBonus channel — mirrors SP-125 warding_bond acBonus), consumed
  // by the next resolved attack in attackPostProcessing. At Will sentinel
  // (usage:'At Will'+uses:999) — RAW unlimited, no uses/day; 1/round latch
  // (_parry_usedRound, MA-0013 counterspell shape).
  parry: { effect: 'parry', trigger: 'melee_hit', label: 'Parry', icon: 'fa-shield-halved' },
  // MA-0399: Black Pudding Split — reactive self-duplication reaction. RAW
  // trigger: while Large/Medium with 10+ HP, becomes Bloodied OR is subjected
  // to Lightning/Slashing damage. The gate reads live combatSummary HP
  // (bloodied: currentHp <= floor(maxHp/2), applyDamage.js threshold math)
  // and the campaign lastAttack damageTypes (handlePlainDamage stamp) —
  // "subjected to" is satisfied even when immunity zeroes the damage.
  // No monster-duplication subsystem exists (§7 no-consumer family), so the
  // response is a GM-executed advisory record (CLA-325, MA-0006 record-only
  // precedent): popup + ability_use log carry the exact duplication
  // instruction (one size smaller, floor(hp/2) each, own initiative).
  // At Will sentinel (usage:'At Will'+uses:999, MA-0341 shape) — RAW
  // unlimited; 1/round latch (_split_usedRound) + lastAttack.splitResolved
  // event stamp are the only fire limits.
  split: { effect: 'split', trigger: 'bloodied_or_lightning_slashing', label: 'Split', icon: 'fa-droplet' },
  // MA-0467: Celestial Spirit (Defender) Healing Touch — self-initiated touch
  // heal reaction (2024 PHB: reaction, touch, target regains 2d8+spell level).
  // No attack event gates it (unlike parry/counterspell) — GM-click fires the
  // touch, gated by the 1/round latch + At Will sentinel (usage:'At Will'+
  // uses:999, MA-0341 shape) + touch reach (isWithinRange 5 ft., gridless
  // lenient §42) + a live wound on the target. Dice fold via the summon seam
  // ("spell level"→slotLevel, MA-0465 lineage); heal rides the canonical
  // applyHealingToTarget choke point (MA-0367).
  heal: { effect: 'heal', trigger: 'touch', label: 'Healing Touch', icon: 'fa-hand-holding-medical' },
  // MA-0516: Construct Spirit (Clay) Berserk Lashing — reactive attack
  // reaction (2024 PHB: take damage from a creature → Slam attack vs THAT
  // creature, or half-speed move, advisory). Gate is the campaign lastAttack
  // identity (same damaged-target/damage-dealt probe as hellish_rebuke
  // MA-0329 — any weapon OR spell damage arms; "if possible" move-alternative
  // stays GM-adjudicated, CLA-325). The response routes the folded Slam row
  // from the summoned combatant's actions (attack_bonus backfill + dice token
  // fold, MA-0465/0284 caster-fold lineage) through the modal's existing
  // attack-roll seam (deps.handleAttack) against the triggering attacker.
  // Unfolded rows (EB-direct join, off-RAW route per MA-0286 adjudication)
  // refuse honestly — no false +0 auto-hit. At Will sentinel
  // (usage:'At Will'+uses:999, MA-0341 shape) — RAW unlimited; 1/round latch
  // (_attack_usedRound) + lastAttack.berserkLashingResolved identity stamp.
  attack: { effect: 'attack', trigger: 'damage_taken', label: 'Berserk Lashing', icon: 'fa-hand-fist' },
  // MA-0544: Cyclops Oracle Portent — d20-replacement pool reaction. No
  // D20-Test event dispatch exists app-wide (advisory-pool floor, CLA-325):
  // GM-click when a D20 Test happens, the app rolls the 1d20 and STORES it
  // on the monster's runtime `portentRolls` pool; replacement-application
  // stays GM-enforced, logged clearly. The authored recharge "4-6" is the
  // real economy: fire spends MONSTER_RECHARGE_KEY[Portent] via
  // spendMonsterRecharge (MA-0031) — second press refuses honestly until a
  // d6 4+ at the monster's own turn-start regains it (rollMonsterRecharges,
  // turnStartEffects seam; the spent stamp IS the regain registration).
  portent: { effect: 'portent', trigger: 'd20_test_seen', label: 'Portent', icon: 'fa-dice-d20' },
  // MA-0548: Cyclops Sentry Limited Foresight — pre-roll cloud reaction.
  // RAW trigger: a creature the cyclops can see makes an attack roll
  // against it (vision is GM-enforced advisory, CLA-325). Gate is the
  // campaign lastAttack identity (parry MA-0341 lineage, WITHOUT the
  // hit requirement — the roll is clouded before its result is committed;
  // damageApplied:true refuses as too-late). Response: te
  // `disadvantage_attack_rolls` on the ATTACKER (MA-0542 registered te,
  // consumer bumpCount(attackDisadvantageCount) in conditionEffects.js)
  // + self te `next_attack_advantage` with vexTarget = the attacker
  // (CLA-341 verified target-scoped adv channel, §69) — one merged
  // addExpiration anchored on the cyclops (MA-0016/§38 anchor leg fires
  // at its NEXT turn-start; RAW end-of-turn anchor is the accepted
  // advisory residual). Economy is the authored recharge "6"
  // (spendMonsterRecharge MA-0031 — the spent stamp IS the regain
  // registration via rollMonsterRecharges at the monster's turn-start)
  // + the 1/round latch (`_limited_foresight_usedRound`, MA-0013 shape).
  limited_foresight: { effect: 'limited_foresight', trigger: 'attacked_by_seen', label: 'Limited Foresight', icon: 'fa-eye' },
};

const SIZE_LADDER = ['colossal', 'gargantuan', 'huge', 'large', 'medium', 'small', 'tiny'];

export function oneSizeSmaller(size) {
  const idx = SIZE_LADDER.indexOf(String(size || '').toLowerCase());
  if (idx === -1 || idx === SIZE_LADDER.length - 1) return null;
  const smaller = SIZE_LADDER[idx + 1];
  return smaller.charAt(0).toUpperCase() + smaller.slice(1);
}

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

// MA-0329: event-identity refusal probe — no trigger-string stamp exists on
// ordinary attacks, so like counterspell (MA-0013) the gate keys off event
// identity: monster must be the damaged target with damage actually dealt
// (actualDamage merged by handlePlainDamage on weapon hits; primaryDamage /
// targetResults totals on spell legs). Returns a refusal reason or null.
export function hellishRebukeIdentityRefusal(lastAttack, monsterName) {
  if (!lastAttack || lastAttack.targetName !== monsterName) return 'trigger';
  const dealt = Number(lastAttack.actualDamage ?? ((lastAttack.primaryDamage || 0) + (lastAttack.secondaryDamage || 0)));
  if (!(dealt > 0)) return 'damage';
  if (lastAttack.hellishRebukeResolved === true) return 'reacted';
  if (!lastAttack.attackerName || lastAttack.attackerName === monsterName) return 'attacker';
  return null;
}

const HELLISH_REBULE_REFUSAL_MESSAGES = {
  trigger: (m) => `Hellish Rebuke: ${m} was not the damaged target of the last attack — refused.`,
  damage: (m) => `Hellish Rebuke: the last attack dealt ${m} no damage — refused.`,
  reacted: () => 'Hellish Rebuke: already responded to that attack — a single hit provokes one rebuke.',
  attacker: () => 'Hellish Rebuke: no identifiable attacker to rebuke — refused.',
  round: () => 'Hellish Rebuke: Reaction already used this round — refused.',
  uses: (limit) => `Hellish Rebuke: ${limit}/Day uses already spent today — refused. Uses reset at a long rest; GM-enforced for monsters.`,
};

export function hellishRebukeGate({ lastAttack, monsterName, currentRound, storedUses, usedRound, action }) {
  const identity = hellishRebukeIdentityRefusal(lastAttack, monsterName);
  if (identity) {
    return { ok: false, reason: identity, message: HELLISH_REBULE_REFUSAL_MESSAGES[identity](monsterName) };
  }
  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return { ok: false, reason: 'round', message: HELLISH_REBULE_REFUSAL_MESSAGES.round() };
  }
  const used = Number((storedUses && storedUses.hellish_rebuke) || 0);
  const limit = reactionMaxUses(action);
  if (used >= limit) {
    return { ok: false, reason: 'uses', message: HELLISH_REBULE_REFUSAL_MESSAGES.uses(limit) };
  }
  return { ok: true, used, limit, attackerName: lastAttack.attackerName };
}

// Numeric spec read from the authored row — never a baked default before the
// row exists (DC 15 authored via the MA-0328 Spellcasting lineage).
export function hellishRebukeSpec(action) {
  const auto = action?.automation || {};
  const saveDc = Number(auto.saveDc ?? action?.save_dc);
  if (!Number.isFinite(saveDc) || saveDc <= 0) return { reason: 'dc', message: 'Hellish Rebuke: no authored numeric spell save DC on the row — no save rolled, nothing spent.' };
  const formula = auto.damageExpression;
  if (!formula) return { reason: 'formula', message: 'Hellish Rebuke: no authored damage formula on the row — nothing rolled, nothing spent.' };
  return { spec: { saveDc, formula, saveType: auto.saveType || 'DEX', damageType: auto.damageType || 'Fire', dcSuccess: auto.dcSuccess || 'half', rangeFt: rangeToFeet(auto.range ?? action?.range) ?? 60 } };
}

// MA-0341: event-identity probe (mirrors hellishRebukeIdentityRefusal) — the
// parry must answer the ONE melee attack that hit this monster and whose
// damage is not yet committed (popup abandoned, Done not pressed). Returns a
// refusal reason token or null.
export function parryIdentityRefusal(lastAttack, monsterName) {
  if (!lastAttack || lastAttack.rollType !== 'attack') return 'trigger';
  // Spell-origin stamp guard (MA-0245 lineage: storeCampaignLastAttack falls
  // back weaponType:'melee' for spells) — Parry answers WEAPON melee attacks.
  if (isSpellOriginLastAttack(lastAttack)) return 'spell';
  if (lastAttack.weaponType !== 'melee') return 'melee';
  if (lastAttack.targetName !== monsterName) return 'trigger';
  if (lastAttack.hit !== true) return 'miss';
  if (lastAttack.damageApplied === true || Number(lastAttack.actualDamage ?? 0) > 0) return 'resolved';
  if (lastAttack.parryResolved === true) return 'reacted';
  if (!lastAttack.attackerName || lastAttack.attackerName === monsterName) return 'attacker';
  return null;
}

const PARRY_REFUSAL_MESSAGES = {
  trigger: (m) => `Parry: no melee attack has targeted ${m} — refused.`,
  melee: (m) => `Parry: the last attack against ${m} was not a melee attack — refused.`,
  spell: (m) => `Parry: the last attack against ${m} was a spell attack — Parry answers melee weapon attacks only.`,
  miss: (m) => `Parry: the melee attack against ${m} missed — nothing to parry.`,
  resolved: () => 'Parry: damage is already applied on that attack — too late to parry.',
  reacted: () => 'Parry: already responded to that attack — one parry per attack.',
  attacker: () => 'Parry: no identifiable attacker to parry against — refused.',
  round: () => 'Parry: Reaction already used this round — refused.',
  uses: (limit) => `Parry: ${limit} uses already spent today — refused.`,
};

export function parryGate({ lastAttack, monsterName, currentRound, storedUses, usedRound, action }) {
  const identity = parryIdentityRefusal(lastAttack, monsterName);
  if (identity) {
    return { ok: false, reason: identity, message: PARRY_REFUSAL_MESSAGES[identity](monsterName) };
  }
  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return { ok: false, reason: 'round', message: PARRY_REFUSAL_MESSAGES.round() };
  }
  const used = Number((storedUses && storedUses.parry) || 0);
  const limit = reactionMaxUses(action);
  if (used >= limit) {
    return { ok: false, reason: 'uses', message: PARRY_REFUSAL_MESSAGES.uses(limit) };
  }
  return { ok: true, used, limit, attackerName: lastAttack.attackerName };
}

// MA-0341: At Will sentinel — never spends MONSTER_REACTION_USES (RAW
// unlimited, uses:999 is an honest sentinel, MA-0006/0300/0305). The
// _parry_usedRound round-latch + lastAttack.parryResolved identity stamp
// are the only fire limits; the +2 AC rides activeBuffs until the next
// resolved attack consumes it.
function buildParryBuff(action, lastAttack) {
  const acBonus = Number(action?.automation?.acBonus) || 2;
  return {
    effect: 'parry',
    acBonus,
    source: 'Parry',
    vsAttack: `${lastAttack.attackerName}:${lastAttack.attackName || 'melee attack'}`,
    appliedRoundContext: { d20: lastAttack.d20, total: lastAttack.total, targetAc: lastAttack.targetAc },
    timestamp: Date.now(),
  };
}

function buildParrySpendLog({ monsterName, lastAttack, buff }) {
  const newAc = (Number(lastAttack.targetAc) || 0) + buff.acBonus;
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: 'Parry',
    description: `${monsterName} uses Parry — +${buff.acBonus} AC against ${lastAttack.attackerName}'s ${lastAttack.attackName || 'melee attack'} (AC ${lastAttack.targetAc} → ${newAc}). Dismiss the pending attack popup WITHOUT Done, then re-click the attacker's ${lastAttack.attackName || 'attack'} chip to re-resolve vs AC ${newAc}. Wielding a melee weapon is GM-enforced (no equip model). At Will — unlimited uses, 1 Reaction per round.`,
    timestamp: Date.now(),
  };
}

export async function resolveMonsterParry({ action, monsterName, campaignName, lastAttack, currentRound, storedUses, usedRound, latchKey, deps }) {
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const gate = parryGate({ lastAttack, monsterName, currentRound, storedUses, usedRound, action });
  if (!gate.ok) {
    await log(campaignName, {
      type: 'automation',
      characterName: monsterName,
      automationType: 'parry_refused',
      name: 'Parry',
      description: `Parry refused (${gate.reason}): ${gate.message}`,
      timestamp: Date.now(),
    });
    return { ok: false, message: gate.message };
  }
  const buff = buildParryBuff(action, lastAttack);
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const buffs = getRV(monsterName, 'activeBuffs') || [];
  const newBuffs = [...(Array.isArray(buffs) ? buffs : []), buff];
  await setRV(monsterName, latchKey, currentRound, campaignName);
  await setRV(monsterName, 'activeBuffs', newBuffs, campaignName);
  await setRV('campaign', 'lastAttack', {
    ...lastAttack,
    parryResolved: true,
    parriedBy: monsterName,
    parryAcBonus: buff.acBonus,
  }, campaignName);
  const entry = buildParrySpendLog({ monsterName, lastAttack, buff });
  await log(campaignName, entry);
  return { ok: true, message: entry.description, acBonus: buff.acBonus, newAc: (Number(lastAttack.targetAc) || 0) + buff.acBonus };
}

// MA-0399: event-identity + live-state probe (mirrors hellishRebukeIdentityRefusal).
// Bloodied reads the combatSummary snapshot (monster HP truth = cs currentHp);
// lightning/slashing reads the campaign lastAttack damageTypes stamp — an
// immune hit still counts as "subjected to" per the row's RAW wording.
function splitAttackDamageTypes(lastAttack) {
  if (Array.isArray(lastAttack?.damageTypes)) return lastAttack.damageTypes;
  return lastAttack?.primaryDamageType ? [lastAttack.primaryDamageType] : [];
}

function splitElementalType(lastAttack, monsterName, damageTypes) {
  if (!lastAttack || lastAttack.targetName !== monsterName) return null;
  return splitAttackDamageTypes(lastAttack).find(t => damageTypes.some(d => String(t).toLowerCase() === String(d).toLowerCase())) || null;
}

function splitBloodied(monster, minHp) {
  const hp = Number(monster.currentHp ?? 0);
  const maxHp = Number(monster.maxHp ?? 0);
  return hp >= minHp && hp > 0 && maxHp > 0 && hp <= Math.floor(maxHp / 2);
}

export function splitTriggerEvidence({ lastAttack, monster, auto }) {
  if (!monster) return { satisfied: false, reason: 'combatant' };
  const minHp = Number(auto?.minHp) || 10;
  const damageTypes = Array.isArray(auto?.damageTypes) && auto.damageTypes.length > 0 ? auto.damageTypes : ['Lightning', 'Slashing'];
  const size = String(monster.size || '').toLowerCase();
  if (size !== 'large' && size !== 'medium') return { satisfied: false, reason: 'size', size: size || null };
  const hp = Number(monster.currentHp ?? 0);
  const maxHp = Number(monster.maxHp ?? 0);
  if (splitBloodied(monster, minHp)) return { satisfied: true, via: 'bloodied', hp, maxHp };
  const elemental = splitElementalType(lastAttack, monster.name, damageTypes);
  if (elemental) return { satisfied: true, via: 'damage_type', hp, maxHp, damageType: elemental };
  return { satisfied: false, reason: 'trigger', hp, maxHp };
}

const SPLIT_REFUSAL_MESSAGES = {
  combatant: (m) => `Split: ${m} is not an active combatant in the current encounter — refused.`,
  size: (m, t) => `Split: ${m} is ${t.size || 'size-unknown'} — Split only triggers while Large or Medium. Refused.`,
  trigger: (m, t) => `Split: ${m} is not Bloodied (${t.hp}/${t.maxHp}, needs ≤ half with 10+ HP) and no Lightning/Slashing damage targeted it — refused.`,
  reacted: () => 'Split: already responded to that damage event — refused.',
  round: () => 'Split: already used this round — refused.',
};

export function splitGate({ lastAttack, monster, monsterName, currentRound, usedRound, auto }) {
  const trigger = splitTriggerEvidence({ lastAttack, monster, auto });
  if (!trigger.satisfied) {
    return { ok: false, reason: trigger.reason, message: SPLIT_REFUSAL_MESSAGES[trigger.reason](monsterName, trigger) };
  }
  if (lastAttack && lastAttack.targetName === monsterName && lastAttack.splitResolved === true) {
    return { ok: false, reason: 'reacted', message: SPLIT_REFUSAL_MESSAGES.reacted() };
  }
  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return { ok: false, reason: 'round', message: SPLIT_REFUSAL_MESSAGES.round() };
  }
  return { ok: true, ...trigger, eachHp: Math.floor(trigger.hp / 2) };
}

function buildSplitAdvisoryPopup({ monsterName, gate, newSize, eachHp }) {
  const triggerText = gate.via === 'bloodied'
    ? `Bloodied at ${gate.hp}/${gate.maxHp} HP`
    : `subjected to ${gate.damageType} damage (at ${gate.hp}/${gate.maxHp} HP)`;
  return `<div class="mc-prerequisite-refusal"><h3>Split — GM-Executed Duplication</h3><p>${monsterName} Split trigger confirmed (${triggerText}). Response: replace ${monsterName} with <strong>two ${newSize} Black Puddings</strong>, Hit Points divided evenly — <strong>${eachHp}/${eachHp} HP each</strong> — each on its own Initiative. No monster-duplication subsystem exists: add the two puddings via the Encounter Builder and stamp ${eachHp} HP on each card (GM-enforced, advisory record).</p></div>`;
}

function buildSplitSpendLog({ monsterName, gate, newSize, eachHp }) {
  const triggerText = gate.via === 'bloodied'
    ? `Bloodied at ${gate.hp}/${gate.maxHp} HP`
    : `subjected to ${gate.damageType} damage (at ${gate.hp}/${gate.maxHp} HP)`;
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: 'Split',
    description: `${monsterName} uses Split (${triggerText}) — GM duplication instruction: replace ${monsterName} with two ${newSize} Black Puddings at ${eachHp}/${eachHp} HP each (floor(${gate.hp}/2)), each on its own Initiative. No monster-duplication subsystem — add via Encounter Builder + stamp HP (GM-enforced, advisory record). At Will — unlimited, 1 Reaction per round.`,
    timestamp: Date.now(),
  };
}

export async function resolveMonsterSplit({ action, monsterName, campaignName, lastAttack, cs, currentRound, usedRound, latchKey, deps }) {
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const monster = (cs?.creatures || []).find(c => c.name === monsterName) || null;
  const gate = splitGate({ lastAttack, monster, monsterName, currentRound, usedRound, auto: action?.automation });
  if (!gate.ok) {
    await log(campaignName, {
      type: 'automation',
      characterName: monsterName,
      automationType: 'split_refused',
      name: 'Split',
      description: `Split refused (${gate.reason}): ${gate.message}`,
      timestamp: Date.now(),
    });
    return { ok: false, message: gate.message, popupHtml: `<div class="mc-prerequisite-refusal"><h3>Split Refused</h3><p>${gate.message} Nothing spent, no duplication.</p></div>` };
  }
  const newSize = oneSizeSmaller(monster.size) || 'one size smaller';
  // Stamp the round latch BEFORE the advisory write (CLA-361 precedent).
  await setRV(monsterName, latchKey, currentRound, campaignName);
  if (lastAttack && lastAttack.targetName === monsterName) {
    await setRV('campaign', 'lastAttack', {
      ...lastAttack,
      splitResolved: true,
      splitBy: monsterName,
      splitIntoHp: gate.eachHp,
    }, campaignName);
  }
  const entry = buildSplitSpendLog({ monsterName, gate, newSize, eachHp: gate.eachHp });
  await log(campaignName, entry);
  return { ok: true, message: entry.description, eachHp: gate.eachHp, newSize, popupHtml: buildSplitAdvisoryPopup({ monsterName, gate, newSize, eachHp: gate.eachHp }) };
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

async function readGatedReactionContext({ def, campaignName, monsterName, deps }) {
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
  // RAW campaign lastAttack (not findLastAttack's normalized wrapper, which
  // drops spell-origin fields like rollType/damageSchool).
  const rawLastAttack = await getRV('campaign', 'lastAttack') || lastAttack;
  return { getRV, setRV, log, latchKey, lastAttack, rawLastAttack, cs, currentRound, storedUses, usedRound };
}

export async function resolveMonsterGatedReaction({ action, monsterName, campaignName, deps = {} }) {
  const def = getGatedMonsterReaction(action);
  if (!def) return null;
  const ctx = await readGatedReactionContext({ def, campaignName, monsterName, deps });

  if (def.effect === 'counterspell') {
    return resolveMonsterCounterspell({ action, monsterName, campaignName, lastAttack: ctx.rawLastAttack, cs: ctx.cs, currentRound: ctx.currentRound, storedUses: ctx.storedUses, usedRound: ctx.usedRound, latchKey: ctx.latchKey, deps });
  }

  if (def.effect === 'hellish_rebuke') {
    return resolveMonsterHellishRebuke({ action, monsterName, campaignName, lastAttack: ctx.rawLastAttack, cs: ctx.cs, currentRound: ctx.currentRound, storedUses: ctx.storedUses, usedRound: ctx.usedRound, latchKey: ctx.latchKey, deps });
  }

  if (def.effect === 'parry') {
    return resolveMonsterParry({ action, monsterName, campaignName, lastAttack: ctx.rawLastAttack, currentRound: ctx.currentRound, storedUses: ctx.storedUses, usedRound: ctx.usedRound, latchKey: ctx.latchKey, deps: { ...deps, getRuntimeValue: ctx.getRV } });
  }

  if (def.effect === 'split') {
    return resolveMonsterSplit({ action, monsterName, campaignName, lastAttack: ctx.rawLastAttack, cs: ctx.cs, currentRound: ctx.currentRound, usedRound: ctx.usedRound, latchKey: ctx.latchKey, deps: { ...deps, setRuntimeValue: ctx.setRV } });
  }

  if (def.effect === 'heal') {
    return resolveMonsterHealReaction({ action, monsterName, campaignName, cs: ctx.cs, currentRound: ctx.currentRound, storedUses: ctx.storedUses, usedRound: ctx.usedRound, latchKey: ctx.latchKey, deps: { ...deps, getRuntimeValue: ctx.getRV, setRuntimeValue: ctx.setRV } });
  }

  if (def.effect === 'attack') {
    return resolveMonsterAttackReaction({ action, monsterName, campaignName, lastAttack: ctx.rawLastAttack, cs: ctx.cs, currentRound: ctx.currentRound, storedUses: ctx.storedUses, usedRound: ctx.usedRound, latchKey: ctx.latchKey, deps: { ...deps, setRuntimeValue: ctx.setRV } });
  }

  if (def.effect === 'portent') {
    return resolveMonsterPortentReaction({ action, monsterName, campaignName, currentRound: ctx.currentRound, getRV: ctx.getRV, setRV: ctx.setRV, log: ctx.log, deps });
  }

  if (def.effect === 'limited_foresight') {
    return resolveMonsterLimitedForesight({ action, monsterName, campaignName, lastAttack: ctx.rawLastAttack, currentRound: ctx.currentRound, usedRound: ctx.usedRound, latchKey: ctx.latchKey, getRV: ctx.getRV, setRV: ctx.setRV, log: ctx.log, deps });
  }

  return resolveRecordOnlyGatedReaction({ def, action, monsterName, campaignName, lastAttack: ctx.lastAttack, currentRound: ctx.currentRound, storedUses: ctx.storedUses, usedRound: ctx.usedRound, latchKey: ctx.latchKey, setRV: ctx.setRV, log: ctx.log });
}

// MA-0467: Healing Touch — dice preference order: the summoned combatant's
// folded reaction row (summonSpiritHandler.resolveMonsterReactions stamps
// "2d8+spell level" → "2d8+<slot>"), else the row itself when already
// numeric. An unfolded token (EB-direct join, off-RAW route per the caster-
// fold adjudication) is honestly refused — zero spend, no mod-0 silent roll.
export function healReactionDice({ action, combatant }) {
  const folded = (combatant?.reactions || []).find(r => r?.automation?.effect === 'heal');
  const formula = [folded?.damage_dice_primary, action?.damage_dice_primary]
    .find(d => d != null && canRollExpression(String(d)));
  return formula != null ? String(formula) : null;
}

function healTargetState(cs, targetName, getRV) {
  const creature = (cs?.creatures || []).find(c => c.name === targetName);
  if (!creature) return null;
  const maxHp = Number(creature.maxHp ?? 0);
  const hp = creature.type === 'player'
    ? Number(getRV(targetName, 'currentHitPoints') ?? creature.currentHp ?? 0)
    : Number(creature.currentHp ?? 0);
  return { hp, maxHp };
}

export function healGate({ monsterName, targetName, state, formula, inRange, currentRound, usedRound, storedUses, action }) {
  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return { ok: false, reason: 'round', message: `Healing Touch: Reaction already used this round (1/round) — refused.` };
  }
  const used = Number((storedUses && storedUses.heal) || 0);
  const limit = reactionMaxUses(action);
  if (used >= limit) {
    return { ok: false, reason: 'uses', message: `Healing Touch: ${limit} uses already spent today — refused.` };
  }
  if (!formula) {
    return { ok: false, reason: 'dice', message: `Healing Touch: no rollable dice for ${monsterName} — "spell level" is unresolved off the summon cast path. Refused.` };
  }
  if (!state) {
    return { ok: false, reason: 'target', message: `Healing Touch: ${targetName} is not an active combatant — refused.` };
  }
  if (!inRange) {
    return { ok: false, reason: 'range', message: `Healing Touch: ${targetName} is out of touch (5 ft.) — refused.` };
  }
  if (state.hp > 0 && state.hp >= state.maxHp) {
    return { ok: false, reason: 'full_hp', message: `Healing Touch: ${targetName} is already at full hit points (${state.hp}/${state.maxHp}) — nothing to heal, nothing spent.` };
  }
  return { ok: true, used, limit, formula, hp: state.hp, maxHp: state.maxHp };
}

function buildHealRefusalLog({ monsterName, gate }) {
  return {
    type: 'automation',
    characterName: monsterName,
    automationType: 'heal_refused',
    name: 'Healing Touch',
    description: `Healing Touch refused (${gate.reason}): ${gate.message}`,
    timestamp: Date.now(),
  };
}

function buildHealAbilityUseLog({ monsterName, targetName, gate, roll, result }) {
  const actualHeal = result ? result.actualHeal : 0;
  const newHp = result ? result.newHp : gate.hp;
  const blockedNote = result && actualHeal === 0 ? ' (healing blocked — no HP regained)' : '';
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: 'Healing Touch',
    description: `${monsterName} uses Healing Touch on ${targetName} — ${gate.formula} rolled ${roll.total}${blockedNote}. ${targetName} ${gate.hp}/${gate.maxHp} → ${newHp}/${gate.maxHp}. At Will — unlimited, 1 Reaction per round.`,
    timestamp: Date.now(),
  };
}

function buildHealHpChangeLog({ monsterName, targetName, result }) {
  return {
    type: 'hp_change',
    targetName,
    sourceName: monsterName,
    delta: result.actualHeal,
    currentHp: result.newHp,
    maxHp: result.maxHp,
    isHealing: true,
    isUnconscious: false,
    timestamp: Date.now(),
  };
}

function buildHealPopupHtml({ monsterName, targetName, gate, roll, result }) {
  const actualHeal = result ? result.actualHeal : 0;
  const newHp = result ? result.newHp : gate.hp;
  return `<div class="mc-prerequisite-refusal"><h3>Healing Touch</h3><p>${monsterName} touches ${targetName} — ${gate.formula} rolled <strong>${roll.total}</strong>, ${targetName} regains <strong>${actualHeal}</strong> HP (${gate.hp}/${gate.maxHp} → ${newHp}/${gate.maxHp}).</p></div>`;
}

function resolveHealDeps(deps) {
  return {
    setRV: deps.setRuntimeValue || setRuntimeValue,
    getRV: deps.getRuntimeValue || getRuntimeValue,
    log: deps.addEntry || addEntry,
    checkRange: deps.isWithinRange || isWithinRange,
    applyHeal: deps.applyHealingToTarget || applyHealingToTarget,
    rollDice: deps.rollExpression || rollExpression,
  };
}

async function resolveMonsterHealReaction({ action, monsterName, campaignName, cs, currentRound, storedUses, usedRound, latchKey, deps }) {
  const { setRV, getRV, log, checkRange, applyHeal, rollDice } = resolveHealDeps(deps);
  const combatant = (cs?.creatures || []).find(c => c.name === monsterName) || null;
  const armed = deps.getTarget ? deps.getTarget() : null;
  const targetName = (armed && armed.name) || monsterName;
  const state = healTargetState(cs, targetName, getRV);
  const inRange = await checkRange(monsterName, targetName, 5);
  const gate = healGate({ monsterName, targetName, state, formula: healReactionDice({ action, combatant }), inRange, currentRound, usedRound, storedUses, action });
  if (!gate.ok) {
    await log(campaignName, buildHealRefusalLog({ monsterName, gate }));
    return { ok: false, message: gate.message, popupHtml: `<div class="mc-prerequisite-refusal"><h3>Healing Touch Refused</h3><p>${gate.message}</p></div>` };
  }
  const roll = rollDice(gate.formula);
  if (!roll) {
    const diceGate = { reason: 'dice', message: `${gate.formula} did not resolve — nothing spent.` };
    await log(campaignName, buildHealRefusalLog({ monsterName, gate: diceGate }));
    return { ok: false, message: diceGate.message };
  }
  // Round latch stamped AWAITED before the heal write (CLA-361 precedent) —
  // the 1/round fire limit must be visible to the next click before it reads.
  await setRV(monsterName, latchKey, currentRound, campaignName);
  await setRV(monsterName, MONSTER_REACTION_USES_KEY, { ...storedUses, heal: gate.used + 1 }, campaignName);
  const result = applyHeal(cs, targetName, roll.total, campaignName);
  const spendLog = buildHealAbilityUseLog({ monsterName, targetName, gate, roll, result });
  await log(campaignName, spendLog);
  if (result) {
    await log(campaignName, buildHealHpChangeLog({ monsterName, targetName, result }));
  }
  return { ok: true, message: spendLog.description, healAmount: result ? result.actualHeal : 0, rollTotal: roll.total, targetName, popupHtml: buildHealPopupHtml({ monsterName, targetName, gate, roll, result }) };
}

// MA-0516: reactive attack reaction (Construct Spirit (Clay) Berserk
// Lashing). Event identity mirrors hellishRebukeIdentityRefusal (MA-0329) —
// ANY damage (weapon or spell legs) dealt to this monster by a distinct
// creature arms it; a resolved lashing stamp stops refire on the same event.
export function attackReactionIdentityRefusal(lastAttack, monsterName) {
  if (!lastAttack || lastAttack.targetName !== monsterName) return 'trigger';
  const dealt = Number(lastAttack.actualDamage ?? ((lastAttack.primaryDamage || 0) + (lastAttack.secondaryDamage || 0)));
  if (!(dealt > 0)) return 'damage';
  if (lastAttack.berserkLashingResolved === true) return 'reacted';
  if (!lastAttack.attackerName || lastAttack.attackerName === monsterName) return 'attacker';
  return null;
}

const ATTACK_REACTION_REFUSAL_MESSAGES = {
  trigger: (m) => `${m} was not the damaged target of the last attack — refused.`,
  damage: (m) => `the last attack dealt ${m} no damage — refused.`,
  reacted: () => 'already responded to that damage event — one lashing per trigger.',
  attacker: () => 'no identifiable attacker to lash against — refused.',
  round: () => 'Reaction already used this round — refused.',
  uses: (limit) => `${limit} uses already spent today — refused.`,
  target: (m, a) => `${m} must Slam the creature that damaged it — arm ${a} on the card first.`,
  fold: (m) => `${m} was not summoned via the cast path — no folded caster mod/dice — refused.`,
};

export function attackReactionGate({ lastAttack, monsterName, currentRound, storedUses, usedRound, action }) {
  const identity = attackReactionIdentityRefusal(lastAttack, monsterName);
  if (identity) {
    return { ok: false, reason: identity, message: ATTACK_REACTION_REFUSAL_MESSAGES[identity](monsterName, lastAttack?.attackerName) };
  }
  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return { ok: false, reason: 'round', message: ATTACK_REACTION_REFUSAL_MESSAGES.round() };
  }
  const used = Number((storedUses && storedUses.attack) || 0);
  const limit = reactionMaxUses(action);
  if (used >= limit) {
    return { ok: false, reason: 'uses', message: ATTACK_REACTION_REFUSAL_MESSAGES.uses(limit) };
  }
  return { ok: true, used, limit, attackerName: lastAttack.attackerName };
}

// The folded Slam row rides the summoned combatant's actions (resolveMonster-
// Actions backfill + foldRowDice token fold, MA-0465 lineage). A row still
// carrying an unfolded token ("+spell attack modifier" / "spell level") is
// the EB-direct off-RAW route (MA-0286 adjudication) — refuse, never bake a
// false +0 auto-hit.
export function attackReactionSlamRow({ action, combatant }) {
  const attackName = String(action?.automation?.attack || 'Slam');
  return (combatant?.actions || []).find(a => a?.name === attackName) || null;
}

export function attackReactionFoldCheck(slamRow) {
  const attackBonus = Number(slamRow?.attack_bonus);
  const formula = slamRow?.damage_dice_primary != null ? String(slamRow.damage_dice_primary) : null;
  if (!slamRow) return { reason: 'fold', message: 'no Slam row on the combatant — refused.' };
  if (!Number.isFinite(attackBonus)) return { reason: 'fold', message: 'Slam attack_bonus is unfolded — summon via the cast path. Refused.' };
  if (!formula || !canRollExpression(formula)) return { reason: 'fold', message: `Slam damage "${formula}" is unfolded — no rollable dice. Refused.` };
  return { attackBonus, formula, damageType: slamRow.damage_type_primary || 'Bludgeoning' };
}

// Fold + armed-target verification: RAW slams the creature that dealt the
// damage, so the armed target must be the triggering attacker — never a
// false +0 auto-hit, never a swung-at-bystander.
export function attackReactionFireCheck({ action, combatant, armed, attackerName, monsterName }) {
  const slamRow = attackReactionSlamRow({ action, combatant });
  const fold = attackReactionFoldCheck(slamRow);
  if (fold.reason) return { reason: 'fold', message: fold.message };
  if (!armed || armed.name !== attackerName) {
    return { reason: 'target', message: ATTACK_REACTION_REFUSAL_MESSAGES.target(monsterName, attackerName) };
  }
  return { slamRow, ...fold };
}

function buildAttackReactionRefusalLog({ monsterName, action, reason, message }) {
  const name = action?.name || 'Berserk Lashing';
  return {
    type: 'automation',
    characterName: monsterName,
    automationType: 'berserk_lashing_refused',
    name,
    description: `${name} refused (${reason}): ${message}`,
    timestamp: Date.now(),
  };
}

function buildAttackReactionSpendLog({ monsterName, action, attackerName, spec }) {
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: action?.name || 'Berserk Lashing',
    description: `${monsterName} uses Berserk Lashing — Slam attack on ${attackerName}, the creature that damaged it (+${spec.attackBonus} to hit, ${spec.formula} ${spec.damageType}). Half-speed move alternative is GM-adjudicated (advisory — no OA gridless). At Will — unlimited, 1 Reaction per round.`,
    timestamp: Date.now(),
  };
}

async function refuseAttackReaction({ monsterName, action, campaignName, log, reason, message }) {
  await log(campaignName, buildAttackReactionRefusalLog({ monsterName, action, reason, message }));
  return { ok: false, message, popupHtml: `<div class="mc-prerequisite-refusal"><h3>${action?.name || 'Berserk Lashing'} Refused</h3><p>${message}</p></div>` };
}

async function resolveMonsterAttackReaction({ action, monsterName, campaignName, lastAttack, cs, currentRound, storedUses, usedRound, latchKey, deps }) {
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const gate = attackReactionGate({ lastAttack, monsterName, currentRound, storedUses, usedRound, action });
  if (!gate.ok) return refuseAttackReaction({ monsterName, action, campaignName, log, reason: gate.reason, message: gate.message });
  const combatant = (cs?.creatures || []).find(c => c.name === monsterName) || null;
  const armed = deps.getTarget ? deps.getTarget() : null;
  const spec = attackReactionFireCheck({ action, combatant, armed, attackerName: gate.attackerName, monsterName });
  if (spec.reason) return refuseAttackReaction({ monsterName, action, campaignName, log, reason: spec.reason, message: spec.message });
  // Round latch + spend + event stamp AWAITED before the attack fires
  // (CLA-361 precedent) — a thrown attack step cannot leave the Reaction refirable.
  await setRV(monsterName, latchKey, currentRound, campaignName);
  await setRV(monsterName, MONSTER_REACTION_USES_KEY, { ...storedUses, attack: gate.used + 1 }, campaignName);
  await setRV('campaign', 'lastAttack', {
    ...lastAttack,
    berserkLashingResolved: true,
    lashedBy: monsterName,
    lashedTarget: gate.attackerName,
  }, campaignName);
  const entry = buildAttackReactionSpendLog({ monsterName, action, attackerName: gate.attackerName, spec });
  await log(campaignName, entry);
  if (!deps.handleAttack) {
    console.error('[MA-0516] handleAttack dep missing — Berserk Lashing attack not routed');
    return { ok: false, message: `${entry.description} ATTACK ROLL NOT ROUTED (no modal seam).` };
  }
  deps.handleAttack('Berserk Lashing (Slam)', spec.attackBonus, {
    name: 'Berserk Lashing (Slam)',
    damage_dice_primary: spec.formula,
    damage_type_primary: spec.damageType,
    reach: '5 ft.',
    description: null,
  });
  return { ok: true, message: entry.description, attackerName: gate.attackerName, attackBonus: spec.attackBonus, formula: spec.formula };
}

// MA-0006: record-only gated reactions (Feather Fall) — the app has no
// fall-damage pipeline, so a resolved use is an advisory negation record
// (CLA-325) after the round-latch + uses gate.
async function resolveRecordOnlyGatedReaction({ def, action, monsterName, campaignName, lastAttack, currentRound, storedUses, usedRound, latchKey, setRV, log }) {
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

// MA-0329: reactive Hellish Rebuke for monsters (Azer Pyromancer 2/Day).
// Mirrors MA-0013 gated-reaction economy (round latch + MONSTER_REACTION_USES
// spend + zero-spend refusals) and the PC-side reactionDamage seam
// (createSaveListener → save-result → computeDamageAfterSave half →
// applyDamageToTarget hp_change). Save is the ATTACKER's DEX save vs the
// monster's authored spell DC; damage is 2d10 Fire, half on save success.
// The triggering lastAttack is stamped hellishRebukeResolved so a second
// click on the same hit cannot refire even before the round latch differs.
function hellishRebukeAttackerActive(cs, attackerName) {
  const attacker = (cs?.creatures || []).find(c => c.name === attackerName);
  return Boolean(attacker) && Number(attacker.currentHp ?? attacker.currentHitPoints ?? 0) > 0;
}

async function runHellishRebukeSave({ impl, campaignName, monsterName, attackerName, spec }) {
  const { promise } = impl.createSave(campaignName, {
    targetName: attackerName,
    attackerName: monsterName,
    saveType: spec.saveType,
    saveDc: spec.saveDc,
    dcSuccess: spec.dcSuccess,
    damageFormula: spec.formula,
    damageType: spec.damageType,
    sourceName: 'Hellish Rebuke',
  });
  const detail = await promise;
  return detail?.success === true;
}

async function rollAndApplyHellishDamage({ impl, log, cs, monsterName, attackerName, campaignName, spec, success }) {
  const rolled = impl.rollDamage(spec.formula);
  const rawDamage = rolled?.total ?? 0;
  const finalDamage = computeDamageAfterSave(rawDamage, success, spec.dcSuccess);
  await log(campaignName, {
    type: 'roll',
    characterName: monsterName,
    rollType: 'damage',
    name: 'Hellish Rebuke Damage',
    formula: spec.formula,
    rolls: rolled?.rolls || [],
    total: rawDamage,
    damageType: spec.damageType,
    targetName: attackerName,
    finalDamage,
    description: `Hellish Rebuke: ${spec.formula} ${spec.damageType} = ${rawDamage} vs ${attackerName} — DEX save vs DC ${spec.saveDc} ${success ? 'SUCCEEDED — half' : 'FAILED — full'} = ${finalDamage} applied.`,
    timestamp: Date.now(),
  });
  if (finalDamage > 0) {
    const characters = (cs?.creatures || []).filter(c => c.type === 'player');
    const applyResult = await impl.applyDamage(cs, attackerName, finalDamage, [spec.damageType], { campaignName, characters, attackerName: monsterName });
    if (!applyResult) {
      console.error('[MA-0329] applyDamageToTarget failed — Hellish Rebuke damage not applied:', { monsterName, attackerName, finalDamage });
    }
  }
  return finalDamage;
}

function buildHellishRebukeSpendLog({ monsterName, attackerName, saveDc, success, finalDamage, rangeFt, limit, remaining }) {
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: 'Hellish Rebuke',
    description: `${monsterName} uses Hellish Rebuke against ${attackerName} — ${attackerName} ${success ? 'succeeded' : 'failed'} their DEX save (DC ${saveDc}) and took ${finalDamage} Fire damage. Seen within ${rangeFt} ft is GM-enforced (no vision model). ${limit}/Day · ${remaining} left today.`,
    timestamp: Date.now(),
  };
}

async function resolveMonsterHellishRebuke({ action, monsterName, campaignName, lastAttack, cs, currentRound, storedUses, usedRound, latchKey, deps }) {
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const impl = {
    rollDamage: deps.rollExpression || rollExpression,
    createSave: deps.createSaveListener || createSaveListener,
    applyDamage: deps.applyDamageToTarget || applyDamageToTarget,
    inRange: deps.isWithinRange || isWithinRange,
  };
  const refuse = async (reason, message) => {
    await log(campaignName, {
      type: 'automation',
      characterName: monsterName,
      automationType: 'hellish_rebuke_refused',
      name: 'Hellish Rebuke',
      description: `Hellish Rebuke refused (${reason}): ${message}`,
      timestamp: Date.now(),
    });
    return { ok: false, message };
  };

  const gate = hellishRebukeGate({ lastAttack, monsterName, currentRound, storedUses, usedRound, action });
  if (!gate.ok) return refuse(gate.reason, gate.message);

  const specRead = hellishRebukeSpec(action);
  if (specRead.reason) {
    console.error(`[MA-0329] hellish_rebuke row refused (${specRead.reason})`, action);
    return refuse(specRead.reason, specRead.message);
  }
  const spec = specRead.spec;

  const attackerName = gate.attackerName;
  if (!hellishRebukeAttackerActive(cs, attackerName)) {
    return refuse('attacker', `Hellish Rebuke: attacker ${attackerName} is not an active combatant — refused.`);
  }
  const within = await impl.inRange(attackerName, monsterName, spec.rangeFt);
  if (!within) {
    return refuse('range', `Hellish Rebuke: ${attackerName} is not within ${spec.rangeFt} feet — refused.`);
  }

  // Stamp the latch + spend BEFORE resolving (CLA-361 precedent) so a thrown
  // save/damage step cannot leave the Reaction refirable within the round.
  await setRV(monsterName, latchKey, currentRound, campaignName);
  await setRV(monsterName, MONSTER_REACTION_USES_KEY, { ...storedUses, hellish_rebuke: gate.used + 1 }, campaignName);

  const success = await runHellishRebukeSave({ impl, campaignName, monsterName, attackerName, spec });
  const finalDamage = await rollAndApplyHellishDamage({ impl, log, cs, monsterName, attackerName, campaignName, spec, success });

  await setRV('campaign', 'lastAttack', {
    ...lastAttack,
    hellishRebukeResolved: true,
    rebukedBy: monsterName,
    rebukeTarget: attackerName,
    rebukeDamage: finalDamage,
  }, campaignName);

  const remaining = Math.max(0, gate.limit - gate.used - 1);
  const entry = buildHellishRebukeSpendLog({ monsterName, attackerName, saveDc: spec.saveDc, success, finalDamage, rangeFt: spec.rangeFt, limit: gate.limit, remaining });
  await log(campaignName, entry);
  return { ok: true, message: entry.description, remaining, finalDamage, saveSuccess: success };
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

// MA-0322: flat integer hit damage ("Hit: 1 Slashing damage.") authored as
// prose with NO dice (no damage_dice_primary, no parenthesized formula) —
// extractDamageDiceFromDescription can never see it, so the auto-damage chain
// silently dealt zero. This parses the constant back out for the attack-row
// auto-damage seam ONLY: every dice-bearing row ("Hit: 7 (2d8+4) …") returns
// null byte-inert, and non-hit-clause prose returns null. Rows matched live:
// Awakened Shrub Rake, Badger Bite, Bat Bite, Cat Scratch … (23 total).
// Returns the fixed amount as a numeric string; the roller resolves it
// dice-less via parseConstant (flat never doubles on crit — dice-only rule).
export function extractFlatHitDamage(action) {
  const description = String(action?.description || '');
  if (!description) return null;
  if (/\(\s*\d+d\d+/.test(description)) return null;
  const stripped = description.replace(/<[^>]+>/g, '');
  const m = stripped.match(/Hit:\s*(\d+)\s+(?:[A-Za-z-]+\s+)*?damage\b/i);
  return m ? m[1] : null;
}

// ── MA-0374/MA-0383: Eye Rays picker (die = len(rays): d10 Beholder,
// d4 Beholder Zombie) ────────────────────────────────────────────────────
// Beholder actions[2] "Eye Rays" was a save-only shell: save_type
// "Varies (WIS, CON, STR, DEX)" + multi-string damage ("3d8, 4d6, …") —
// unparseable, zero ray resolution ("VAR"/"var" mod-0 fallback, playbook §6
// MA-0374/0383 family). Fix (Option A): structured per-ray data on the row
// (rays[]) + this pure picker + per-ray legs through the existing
// executeBlockSaveRoll → saveProcessing seams. Byte-inert null for every
// row without an authored rays[] array.

const EYE_RAY_SAVE_ABILITIES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

export function parseEyeRayGrant(action) {
  return action?.eyeRay ?? null;
}

export function parseEyeRays(action) {
  const rays = action?.rays;
  // MA-0383: die size is len(rays) — Beholder 10 rays/d10, Beholder
  // Zombie 4 rays/d4 (RAW "roll 1d4"). Any authored 2..N ray array arms.
  if (!Array.isArray(rays) || rays.length < 2) return null;
  const valid = rays.every(r =>
    r && typeof r.key === 'string' && typeof r.name === 'string'
    && EYE_RAY_SAVE_ABILITIES.includes(r.save_ability)
    && (r.damage_dice === null || /^\d+d\d+(\s*[+-]\s*\d+)?$/.test(String(r.damage_dice)))
    && (r.dc_success === 'half' || r.dc_success === 'none')
    && Array.isArray(r.conditions));
  return valid ? rays : null;
}

// RAW: "roll 1d10 (Beholder) / 1d4 (Beholder Zombie); reroll if already
// used that ray during this turn" — the picker die is len(rays); usedKeys
// carries the rays already fired this round (runtime key eyeRaysUsed,
// round-stamped). rollDie injected for deterministic tests.
export function pickEyeRay({ rays, usedKeys = [], rollDie }) {
  const die = Array.isArray(rays) ? rays.length : 0;
  const rerolls = [];
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const roll = Math.trunc(Number(rollDie()));
    if (!(roll >= 1 && roll <= die)) continue;
    const candidate = rays[roll - 1];
    if (candidate && !usedKeys.includes(candidate.key)) return { ray: candidate, roll, rerolls };
    rerolls.push(roll);
  }
  return { ray: null, roll: null, rerolls };
}

// Synthesized single-ray row fed to the existing block-save seam: one
// save_type, one dice formula, one dc_success — everything already parseable
// byte-inert for every other monster. eyeRay rides the save context so
// saveProcessing grants the ray's te/ladder/zero-HP clauses.
export function buildEyeRayAction(rowAction, ray) {
  return {
    name: `${ray.name} (Eye Rays)`,
    save_dc: rowAction.save_dc ?? 16,
    save_type: ray.save_ability,
    dc_success: ray.dc_success,
    save_effect: null,
    // MA-0383: row DC stamped onto the ray so the repeat-save ladder
    // (beholderEyeRayService) honors per-monster DCs (Zombie 14).
    eyeRay: { ...ray, save_dc: ray.save_dc ?? rowAction.save_dc ?? 16 },
    damage_dice_primary: ray.damage_dice ?? undefined,
    damage_type_primary: ray.damage_type ?? undefined,
    description: null,
  };
}

export function eyeRayAutoSuccessReason(ray, csCreature) {
  if (!ray || !csCreature) return null;
  const size = String(csCreature.size || '');
  if (ray.auto_success_size && size.toLowerCase() === String(ray.auto_success_size).toLowerCase()) {
    return `${size} creatures succeed automatically`;
  }
  const type = String(csCreature.monsterType || csCreature.type || '');
  const hit = (ray.auto_success_types || []).find(t => String(t).toLowerCase() === type.toLowerCase());
  if (hit) return `${hit} creatures succeed automatically`;
  return null;
}

export function buildEyeRayPickerPopup({ monsterName, ray, roll, rerolls = [], targetName, die = 10, dc = 16 }) {
  const rerollNote = rerolls.length > 0
    ? ` (rerolled ${rerolls.join(', ')} — already used this turn)`
    : '';
  return `<div class="mc-eye-ray-picked"><h3><i class="fa-solid fa-eye"></i> ${ray.name}</h3><p>${monsterName} rolls ${roll}${rerollNote} on the Eye Rays d${die} — <strong>${ray.name}</strong> at ${targetName} (DC ${dc} ${ray.save_ability} save).</p></div>`;
}

export function buildEyeRayPickerRollLog({ monsterName, ray, roll, rerolls = [], targetName, die = 10 }) {
  const rerollNote = rerolls.length > 0 ? ` (rerolled ${rerolls.join(', ')})` : '';
  return {
    type: 'roll',
    rollType: `d${die}`,
    characterName: monsterName,
    name: `Eye Rays (d${die} ray picker)`,
    rolls: [roll],
    total: roll,
    targetName,
    description: `${monsterName} rolled ${roll}${rerollNote} on the Eye Rays d${die} — ${ray.name}.`,
    timestamp: Date.now(),
  };
}

export function buildEyeRayAbilityUseLog({ monsterName, ray, targetName, dc = 16 }) {
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: `${ray.name} (Eye Rays)`,
    description: `${monsterName} fires ${ray.name} from Eye Rays at ${targetName} — DC ${dc} ${ray.save_ability} save${ray.damage_dice ? `, ${ray.damage_dice} ${ray.damage_type} damage (half on a successful save)` : ' — no damage, condition save'} .`.replace(' .', '.'),
    timestamp: Date.now(),
  };
}

export function buildEyeRayAutoSuccessLog({ monsterName, ray, targetName, reason }) {
  return {
    type: 'automation',
    automationType: 'eye_ray_auto_success',
    characterName: targetName,
    abilityName: `${ray.name} (Eye Rays)`,
    sourceName: monsterName,
    description: `${targetName} succeeds automatically against ${monsterName}'s ${ray.name} (${reason}) — no save rolled, no effect applied.`,
    timestamp: Date.now(),
  };
}

// MA-0544: Cyclops Oracle Portent — d20-replacement pool (advisory-pool
// floor). Pool lives on the MONSTER-name runtime store under `portentRolls`
// (distinct from the PC DivinationWizard `portentDice` key). Full-store-safe:
// always spread a NEW array (in-place push skips the dirty-check POST, §39).
export const PORTENT_POOL_KEY = 'portentRolls';

function portentPoolOf(stored) {
  return Array.isArray(stored) ? stored : [];
}

function buildPortentRefusalLog({ monsterName, reason, message }) {
  return {
    type: 'automation',
    characterName: monsterName,
    automationType: 'portent_refused',
    name: 'Portent',
    description: `Portent refused (${reason}): ${message}`,
    timestamp: Date.now(),
  };
}

function buildPortentSpendLog({ monsterName, roll, poolSize, rechargeThreshold }) {
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: 'Portent',
    description: `${monsterName} uses Portent — rolled ${roll.total} (GM applies ${roll.total} in place of a D20 Test made by ${monsterName} or an ally it can see — replacement is GM-enforced advisory, no d20-replacement consumer). Pool holds ${poolSize} portent roll(s). Recharge ${rechargeThreshold}-6: unavailable until a d6 ${rechargeThreshold}+ at the start of ${monsterName}'s next turn.`,
    timestamp: Date.now(),
  };
}

function buildPortentPopupHtml({ monsterName, roll, poolSize }) {
  return `<div class="mc-prerequisite-refusal"><h3>Portent</h3><p>${monsterName} rolls a Portent d20: <strong>${roll.total}</strong> — stored in the portent pool (${poolSize} held). GM applies it in place of the d20 rolled for a D20 Test made by ${monsterName} or an ally it can see (GM-enforced, advisory — no d20-replacement chooser consumer exists). Recharge 4-6 spent.</p></div>`;
}

export function portentGate({ action, monsterName, rechargeMap }) {
  const gate = monsterRechargeGate(action, rechargeMap || {});
  if (gate && !gate.available) {
    return { ok: false, reason: 'recharge', message: `Portent: not recharged — ${monsterName} must roll a d6 ${gate.threshold}+ at the start of its next turn before Portent can roll again.` };
  }
  return { ok: true, threshold: gate ? gate.threshold : null };
}

async function resolveMonsterPortentReaction({ action, monsterName, campaignName, currentRound, getRV, setRV, log, deps }) {
  const rollDice = deps.rollExpression || rollExpression;
  const gate = portentGate({ action, monsterName, rechargeMap: getRV(monsterName, MONSTER_RECHARGE_KEY) });
  if (!gate.ok) {
    await log(campaignName, buildRechargeRefusalLog({ monsterName, actionName: action?.name || 'Portent', rechargeKey: rechargeActionKey(action), threshold: parseRechargeThreshold(action?.recharge) }));
    return { ok: false, message: gate.message, popupHtml: buildRechargeRefusalPopup({ monsterName, actionName: action?.name || 'Portent', threshold: parseRechargeThreshold(action?.recharge) }) };
  }
  const roll = rollDice('1d20');
  if (!roll) {
    const message = 'Portent: 1d20 did not resolve — nothing rolled, nothing spent.';
    await log(campaignName, buildPortentRefusalLog({ monsterName, reason: 'dice', message }));
    return { ok: false, message };
  }
  const pool = [...portentPoolOf(getRV(monsterName, PORTENT_POOL_KEY)), { roll: roll.total, round: Number(currentRound) || 1, timestamp: Date.now() }];
  await setRV(monsterName, PORTENT_POOL_KEY, pool, campaignName);
  const entry = buildPortentSpendLog({ monsterName, roll, poolSize: pool.length, rechargeThreshold: gate.threshold || 4 });
  await log(campaignName, entry);
  await spendMonsterRecharge({ monsterName, action, campaignName, deps: { getRuntimeValue: getRV, setRuntimeValue: setRV, addEntry: log } });
  return { ok: true, message: entry.description, rollTotal: roll.total, pool, popupHtml: buildPortentPopupHtml({ monsterName, roll, poolSize: pool.length }) };
}

// MA-0548: Cyclops Sentry Limited Foresight — event-identity probe (mirrors
// parryIdentityRefusal MA-0341 WITHOUT the hit requirement: RAW clouds the
// attack roll before its result is committed, so `damageApplied:true` is the
// too-late boundary, not `hit:false`). rollType guard keeps non-attack
// events (saves/checks) off the trigger. Returns a refusal token or null.
export function limitedForesightIdentityRefusal(lastAttack, monsterName) {
  if (!lastAttack || lastAttack.targetName !== monsterName) return 'trigger';
  if (lastAttack.rollType && lastAttack.rollType !== 'attack' && lastAttack.rollType !== 'spell-attack') return 'roll';
  if (lastAttack.damageApplied === true) return 'resolved';
  if (lastAttack.limitedForesightResolved === true) return 'reacted';
  if (!lastAttack.attackerName || lastAttack.attackerName === monsterName) return 'attacker';
  return null;
}

const LIMITED_FORESIGHT_REFUSAL_MESSAGES = {
  trigger: (m) => `Limited Foresight: no attack roll has targeted ${m} — ${m} can only cloud a roll made against it.`,
  roll: () => 'Limited Foresight: the last event against the cyclops was not an attack roll — refused.',
  resolved: () => 'Limited Foresight: damage is already applied on that attack — too late to cloud the roll.',
  reacted: () => 'Limited Foresight: already responded to that attack — one foresight per trigger.',
  attacker: () => 'Limited Foresight: no identifiable attacker to cloud — refused.',
  recharge: (m, t) => `Limited Foresight: not recharged — ${m} must roll a d6 ${t ?? 6}+ at the start of its next turn before Limited Foresight can trigger again.`,
  round: () => 'Limited Foresight: Reaction already used this round — refused.',
  target: (m, a) => `Limited Foresight must cloud the creature that attacked ${m} — arm ${a || 'the triggering attacker'} on the card first.`,
};

export function limitedForesightGate({ action, lastAttack, monsterName, rechargeMap, armed, currentRound, usedRound }) {
  const identity = limitedForesightIdentityRefusal(lastAttack, monsterName);
  if (identity) {
    return { ok: false, reason: identity, message: LIMITED_FORESIGHT_REFUSAL_MESSAGES[identity](monsterName, lastAttack?.attackerName) };
  }
  const recharge = monsterRechargeGate(action, rechargeMap || {});
  if (recharge && !recharge.available) {
    return { ok: false, reason: 'recharge', message: LIMITED_FORESIGHT_REFUSAL_MESSAGES.recharge(monsterName, recharge.threshold) };
  }
  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return { ok: false, reason: 'round', message: LIMITED_FORESIGHT_REFUSAL_MESSAGES.round() };
  }
  const attackerName = lastAttack.attackerName;
  if (!armed || armed.name !== attackerName) {
    return { ok: false, reason: 'target', message: LIMITED_FORESIGHT_REFUSAL_MESSAGES.target(monsterName, attackerName) };
  }
  return { ok: true, attackerName, threshold: recharge ? recharge.threshold : 6 };
}

function buildLimitedForesightGrantLogs({ monsterName, attackerName }) {
  const anchorNote = `anchor expiry fires at ${monsterName}'s next turn start — RAW end-of-turn anchor is advisory`;
  return [
    {
      type: 'condition',
      action: 'applied',
      characterName: attackerName,
      condition: 'Attack Disadvantage',
      reason: `Limited Foresight (${monsterName}) — Disadvantage on attack rolls; the triggering attack re-resolves with disadvantage once the armed target is the attacker`,
      note: `disadvantage_attack_rolls te on ${attackerName} — dismissed pending popup must be re-clicked to re-roll; ${anchorNote}.`,
      timestamp: Date.now(),
    },
    {
      type: 'condition',
      action: 'applied',
      characterName: monsterName,
      condition: 'Next Attack Advantage',
      reason: `Limited Foresight — Advantage on attack rolls against ${attackerName} until the end of ${monsterName}'s next turn (vexTarget channel, CLA-341)`,
      note: `next_attack_advantage te (vexTarget: ${attackerName}) — consumed by ${monsterName}'s next attack against ${attackerName}; ${anchorNote}.`,
      timestamp: Date.now(),
    },
  ];
}

function buildLimitedForesightPopupHtml({ monsterName, attackerName }) {
  return `<div class="mc-prerequisite-refusal"><h3>Limited Foresight</h3><p>${monsterName} clouds <strong>${attackerName}</strong>'s attack roll — ${attackerName} carries Attack Disadvantage and ${monsterName} gains Advantage on attack rolls against ${attackerName} until the end of its next turn. Dismiss the pending ${attackerName} attack popup WITHOUT Done, then re-click ${attackerName}'s attack chip to re-resolve with disadvantage (parry MA-0341 seam). Seen is GM-enforced (no vision model). Recharge 6 spent.</p></div>`;
}

async function refuseLimitedForesight({ monsterName, action, campaignName, log, gate }) {
  if (gate.reason === 'recharge') {
    await log(campaignName, buildRechargeRefusalLog({ monsterName, actionName: action?.name || 'Limited Foresight', rechargeKey: rechargeActionKey(action), threshold: parseRechargeThreshold(action?.recharge) }));
  } else {
    await log(campaignName, {
      type: 'automation',
      characterName: monsterName,
      automationType: 'limited_foresight_refused',
      name: action?.name || 'Limited Foresight',
      description: `Limited Foresight refused (${gate.reason}): ${gate.message}`,
      timestamp: Date.now(),
    });
  }
  return {
    ok: false,
    message: gate.message,
    popupHtml: gate.reason === 'recharge'
      ? buildRechargeRefusalPopup({ monsterName, actionName: action?.name || 'Limited Foresight', threshold: parseRechargeThreshold(action?.recharge) })
      : `<div class="mc-prerequisite-refusal"><h3>Limited Foresight Refused</h3><p>${gate.message} Nothing spent — Recharge kept.</p></div>`,
  };
}

async function resolveMonsterLimitedForesight({ action, monsterName, campaignName, lastAttack, currentRound, usedRound, latchKey, getRV, setRV, log, deps }) {
  const armed = deps.getTarget ? deps.getTarget() : null;
  const gate = limitedForesightGate({ action, lastAttack, monsterName, rechargeMap: getRV(monsterName, MONSTER_RECHARGE_KEY), armed, currentRound, usedRound });
  if (!gate.ok) return refuseLimitedForesight({ monsterName, action, campaignName, log, gate });
  const attackerName = gate.attackerName;
  // Round latch AWAITED before the grants (CLA-361) — the re-click that
  // re-rolls with disadvantage must not find the Reaction refirable.
  await setRV(monsterName, latchKey, currentRound, campaignName);
  registerTargetEffect(campaignName, attackerName, 'disadvantage_attack_rolls', monsterName, { duration: 'until_start_of_next_turn' });
  registerTargetEffect(campaignName, monsterName, 'next_attack_advantage', monsterName, { vexTarget: attackerName, duration: 'until_start_of_next_turn' });
  // ONE merged clock anchored on the cyclops (§38/§39 — two sequential
  // addExpiration calls race; a single list carries both remove entries).
  addExpiration({
    attackerName: monsterName,
    targetName: attackerName,
    effects: [
      { type: 'remove_target_effect', effectKey: 'disadvantage_attack_rolls', source: monsterName, target: attackerName },
      { type: 'remove_target_effect', effectKey: 'next_attack_advantage', source: monsterName, target: monsterName },
    ],
    campaignName,
    rounds: undefined,
    expireOnCreatureName: monsterName,
  });
  await setRV('campaign', 'lastAttack', {
    ...lastAttack,
    limitedForesightResolved: true,
    foresightBy: monsterName,
    foresightTarget: attackerName,
  }, campaignName);
  for (const entry of buildLimitedForesightGrantLogs({ monsterName, attackerName })) {
    await log(campaignName, entry);
  }
  await spendMonsterRecharge({ monsterName, action, campaignName, deps: { getRuntimeValue: getRV, setRuntimeValue: setRV, addEntry: log } });
  const message = `${monsterName} uses Limited Foresight — ${attackerName}'s attack roll is clouded (Disadvantage) and ${monsterName} gains Advantage on attack rolls against ${attackerName} until the end of its next turn. Seen is GM-enforced (no vision model). Recharge 6 spent.`;
  return { ok: true, message, attackerName, popupHtml: buildLimitedForesightPopupHtml({ monsterName, attackerName }) };
}
