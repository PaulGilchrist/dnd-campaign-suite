import { loadFeatData } from '../ui/dataLoader.js'
import { findFeat } from '../shared/featFinder.js';

function parsePositiveBonus(expression) {
  const bonus = parseInt(expression, 10)
  return isNaN(bonus) ? 0 : bonus
}

// Condition tokens gating per-attack extra reach grants (e.g. Battering Roots:
// "heavy_or_versatile_melee_weapon"). Unknown tokens match nothing — fail closed.
const MELEE_REACH_CONDITIONS = {
  heavy_or_versatile_melee_weapon: (props) => props.has('heavy') || props.has('versatile'),
}

export function matchesExtraReachCondition(condition, attack) {
  if (!condition) return true
  const matcher = MELEE_REACH_CONDITIONS[String(condition).toLowerCase()]
  if (!matcher) return false
  const props = new Set((attack?.properties || []).map(p => String(p).toLowerCase()))
  return matcher(props)
}

// Resolve per-attack melee reach: unconditional grants stay in meleeReachBonus;
// conditional grants only raise it when the attack satisfies the condition.
export function resolveMeleeReachBonus(feats, attack) {
  if (!feats) return feats
  const grants = feats.meleeReachGrants
  if (!grants || grants.length === 0) return feats
  let bonus = feats.meleeReachBonus || 0
  for (const grant of grants) {
    if (matchesExtraReachCondition(grant.condition, attack)) {
      bonus = Math.max(bonus, grant.bonus)
    }
  }
  return { ...feats, meleeReachBonus: bonus }
}

// Scan class/race feature passive buffs for extra reach (e.g. Battering Roots)
// and cantrip range bonus (e.g. Improved Elemental Fury)
function applyPassiveRanges(passives, result) {
  for (const passive of passives) {
    if (passive.effect === 'extra_reach' && passive.bonusExpression) {
      const bonus = parsePositiveBonus(passive.bonusExpression)
      if (passive.condition) {
        result.meleeReachGrants.push({ bonus, condition: passive.condition, source: passive.name || '' })
      } else if (bonus > result.meleeReachBonus) {
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
    meleeReachGrants: [],
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
