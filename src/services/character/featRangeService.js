import { loadFeatData } from '../ui/dataLoader.js'
import { findFeat } from '../shared/featFinder.js';

function parsePositiveBonus(expression) {
  const bonus = parseInt(expression, 10)
  return isNaN(bonus) ? 0 : bonus
}

// Scan class/race feature passive buffs for extra reach (e.g. Battering Roots)
// and cantrip range bonus (e.g. Improved Elemental Fury)
function applyPassiveRanges(passives, result) {
  for (const passive of passives) {
    if (passive.effect === 'extra_reach' && passive.bonusExpression) {
      const bonus = parsePositiveBonus(passive.bonusExpression)
      if (bonus > result.meleeReachBonus) {
        result.meleeReachBonus = bonus
      }
    }
    if (passive.effect === 'cantrip_range_bonus' && passive.bonusExpression) {
      const bonus = parsePositiveBonus(passive.bonusExpression)
      if (bonus > result.cantripRangeBonus) {
        result.cantripRangeBonus = bonus
      }
    }
  }
}

function applyFeatRangeEffects(featNames, allFeats, result) {
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
}

export async function computeFeatRangeEffects(featNames = [], ruleset = '5e', playerStats = null) {
  const result = {
    ignoresMeleeDisadvantage: false,
    ignoresLongRangeDisadvantage: false,
    spellRangeBonus: 0,
    rangeMultiplier: 1,
    meleeReachBonus: 0,
    cantripRangeBonus: 0,
  }

  if (playerStats?.automation?.passives) {
    applyPassiveRanges(playerStats.automation.passives, result)
  }

  if (!featNames || featNames.length === 0) {
    return result
  }

  const allFeats = await loadFeatData(ruleset)
  if (!allFeats || allFeats.length === 0) {
    return result
  }

  applyFeatRangeEffects(featNames, allFeats, result)

  return result
}
