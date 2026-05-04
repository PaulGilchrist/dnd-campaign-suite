import classRules from './class-rules'
import classRules2024 from './class-rules-2024'

export function getClassFeatures(playerStats) {
  const is2024 = playerStats.rules === '2024'
  const rules = is2024 ? classRules2024 : classRules
  const className = playerStats?.class?.name

  switch (className) {
    case 'Bard':
      if (typeof rules.getBardFeatures === 'function') {
        return rules.getBardFeatures(playerStats)
      }
      break
    case 'Cleric':
      if (typeof rules.getClericFeatures === 'function') {
        return rules.getClericFeatures(playerStats)
      }
      break
    case 'Druid':
      if (typeof rules.getDruidFeatures === 'function') {
        return rules.getDruidFeatures(playerStats)
      }
      break
    case 'Paladin':
      if (typeof rules.getPaladinFeatures === 'function') {
        return rules.getPaladinFeatures(playerStats)
      }
      break
    case 'Sorcerer':
      if (typeof rules.getSorcererFeatures === 'function') {
        return rules.getSorcererFeatures(playerStats)
      }
      break
    case 'Warlock':
      if (typeof rules.getWarlockFeatures === 'function') {
        return rules.getWarlockFeatures(playerStats)
      }
      break
    case 'Wizard':
      if (typeof rules.getWizardFeatures === 'function') {
        return rules.getWizardFeatures(playerStats)
      }
      break
    case 'Monk':
      if (typeof rules.getMonkFeatures === 'function') {
        return rules.getMonkFeatures(playerStats)
      }
      break
    case 'Rogue':
      if (typeof rules.getRogueFeatures === 'function') {
        return rules.getRogueFeatures(playerStats)
      }
      break
    case 'Ranger':
      if (typeof rules.getRangerFeatures === 'function') {
        return rules.getRangerFeatures(playerStats)
      }
      break
    default:
      return null
  }
}
