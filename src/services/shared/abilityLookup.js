const ABILITY_MAP = {
  str: 'Strength', dex: 'Dexterity',
  con: 'Constitution', int: 'Intelligence',
  wis: 'Wisdom', cha: 'Charisma',
}

const ABILITY_NAMES = new Set(Object.values(ABILITY_MAP))

function normalizeAbilityName(name) {
  if (!name) return null
  const lower = name.toLowerCase().replace(/\s+/g, '')
  if (ABILITY_MAP[lower]) return ABILITY_MAP[lower]
  for (const long of ABILITY_NAMES) {
    if (long.toLowerCase() === lower) return long
  }
  return null
}

export function getAbilityModifier(abilities, abilityName) {
  const canonical = normalizeAbilityName(abilityName)
  if (!canonical) return 0
  return abilities?.find(a => a.name === canonical)?.bonus ?? 0
}

export function getAbilitySaveModifier(abilities, abilityName) {
  const canonical = normalizeAbilityName(abilityName)
  if (!canonical) return 0
  const ability = abilities?.find(a => a.name === canonical)
  return ability?.save ?? ability?.bonus ?? 0
}

// FT-094: canonical ASI-choice lookup — featAbilityChoices keys are
// "<Feat>-<featListIndex>" with value { assignment: '<Ability>' } or a plain string.
export function resolveFeatChosenAbility(featName, featAbilityChoices) {
  if (!featName || !featAbilityChoices || typeof featAbilityChoices !== 'object') return null
  for (const [key, value] of Object.entries(featAbilityChoices)) {
    if (!key.startsWith(featName)) continue
    if (value && typeof value === 'object' && value.assignment) return value.assignment
    if (typeof value === 'string') return value
  }
  return null
}
