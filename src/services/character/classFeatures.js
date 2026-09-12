import classRules from './classRules.js'
import classRules2024 from './classRules2024.js'

const FEATURE_GETTERS = {
  Bard: 'getBardFeatures',
  Cleric: 'getClericFeatures',
  Druid: 'getDruidFeatures',
  Paladin: 'getPaladinFeatures',
  Sorcerer: 'getSorcererFeatures',
  Warlock: 'getWarlockFeatures',
  Wizard: 'getWizardFeatures',
  Monk: 'getMonkFeatures',
  Rogue: 'getRogueFeatures',
  Ranger: 'getRangerFeatures',
}

export function getClassFeatures(playerStats) {
  const is2024 = playerStats.rules === '2024'
  const rules = is2024 ? classRules2024 : classRules
  const getter = FEATURE_GETTERS[playerStats?.class?.name]

  if (!getter) return null
  if (typeof rules[getter] !== 'function') return undefined
  return rules[getter](playerStats)
}
