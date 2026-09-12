import { getAbilitySaveModifier } from '../../services/shared/abilityLookup.js';

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
