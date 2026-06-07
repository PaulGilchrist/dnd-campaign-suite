import { loadFeatData } from '../ui/dataLoader.js'
import { findFeat } from '../shared/featFinder.js';

export async function computeFeatRangeEffects(featNames = [], ruleset = '5e') {
  const result = {
    ignoresMeleeDisadvantage: false,
    ignoresLongRangeDisadvantage: false,
    spellRangeBonus: 0,
    rangeMultiplier: 1,
  }

  if (!featNames || featNames.length === 0) {
    return result
  }

  const allFeats = await loadFeatData(ruleset)
  if (!allFeats || allFeats.length === 0) {
    return result
  }

  for (const featName of featNames) {
    const feat = findFeat(featName, allFeats)
    if (!feat) continue

    const re = feat.rangeEffects
    if (!re) continue

    if (re.ignoresMeleeDisadvantage) {
      result.ignoresMeleeDisadvantage = true
    }
    if (re.ignoresLongRangeDisadvantage) {
      result.ignoresLongRangeDisadvantage = true
    }
    if (re.spellRangeBonus) {
      result.spellRangeBonus = Math.max(result.spellRangeBonus, re.spellRangeBonus)
    }
  }

  return result
}
