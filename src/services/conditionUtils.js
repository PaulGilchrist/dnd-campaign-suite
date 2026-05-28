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
  stunned: 'con',
  unconscious: null,
}

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

function getAbilityLabel(abbr) {
  return ABILITY_LABELS[abbr] || abbr || 'None'
}

function getAbilitySaveBonus(character, abilityAbbr) {
  if (!character?.abilities || !abilityAbbr) return 0
  const fullName = getAbilityLabel(abilityAbbr)
  const ability = character.abilities.find(a => a.name === fullName)
  return ability?.save ?? ability?.bonus ?? 0
}

export {
  CONDITIONS,
  CONDITION_SAVE_MAP,
  ABILITY_LABELS,
  getDefaultAbility,
  getAbilityLabel,
  getAbilitySaveBonus,
}
