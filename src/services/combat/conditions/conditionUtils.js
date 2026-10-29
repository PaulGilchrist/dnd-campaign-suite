const CONDITION_SAVE_DC = 10

const CONDITIONS = [
  { key: 'blinded', label: 'Blinded' },
  { key: 'charmed', label: 'Charmed' },
  { key: 'cursed', label: 'Cursed' },
  { key: 'deafened', label: 'Deafened' },
  { key: 'frightened', label: 'Frightened' },
  { key: 'grappled', label: 'Grappled' },
  { key: 'incapacitated', label: 'Incapacitated' },
  { key: 'paralyzed', label: 'Paralyzed' },
  { key: 'petrified', label: 'Petrified' },
  { key: 'poisoned', label: 'Poisoned' },
  { key: 'prone', label: 'Prone' },
  { key: 'restrained', label: 'Restrained' },
  { key: 'slow', label: 'Slow' },
  { key: 'stunned', label: 'Stunned' },
  { key: 'unconscious', label: 'Unconscious' },
]

const CONDITION_SAVE_MAP = {
  blinded: null,
  charmed: 'wis',
  cursed: 'con',
  deafened: null,
  frightened: 'wis',
  grappled: 'str',
  incapacitated: null,
  paralyzed: 'con',
  petrified: null,
  poisoned: 'con',
  prone: null,
  restrained: 'str',
  slow: 'wis',
  stunned: 'con',
  unconscious: null,
}

import { getAbilitySaveModifier } from '../../shared/abilityLookup.js'

const ABILITY_LABELS = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

function getDefaultAbility(conditionKey) {
  return CONDITION_SAVE_MAP[conditionKey] || null
}

// condition-badge-saveless-dc-noise (2026-10-29-Y): EffectAdder pre-fills the
// default save DC only for conditions that declare a condition-level saving
// throw. Poisoned is excluded: its CON entry in CONDITION_SAVE_MAP names the
// save against BECOMING poisoned (the inflicting source's save), not a save
// wired to the condition itself — stamping a default "Poisoned DC 10" badge
// misled GMs into thinking an escape save existed.
const CONDITIONS_WITHOUT_OWN_SAVE = new Set(['poisoned'])

function conditionDeclaresSave(conditionKey) {
  return CONDITION_SAVE_MAP[conditionKey] != null && !CONDITIONS_WITHOUT_OWN_SAVE.has(conditionKey)
}

function getAbilityLabel(abbr) {
  return ABILITY_LABELS[abbr] || abbr || 'None'
}

function getAbilitySaveBonus(character, abilityAbbr) {
  if (!character?.abilities || !abilityAbbr) return 0
  return getAbilitySaveModifier(character.abilities, abilityAbbr)
}

export {
  CONDITIONS,
  CONDITION_SAVE_DC,
  CONDITION_SAVE_MAP,
  ABILITY_LABELS,
  getDefaultAbility,
  conditionDeclaresSave,
  getAbilityLabel,
  getAbilitySaveBonus,
}
