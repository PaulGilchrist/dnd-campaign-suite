import { getAbilityBonus } from './abilityLookup.js'

export function computeSaveDc(playerStats, ability, proficiency) {
  return 8 + getAbilityBonus(playerStats, ability) + (proficiency || 0)
}
