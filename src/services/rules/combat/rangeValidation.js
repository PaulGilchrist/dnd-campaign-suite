import { isDistanceInRange } from './rangeCheck.js';

const FEET_PER_CELL = 5
// Exported: shared melee-vs-ranged discriminator (see formatWeaponRange in ui/formatUtils.js)
export const MELEE_RANGE_FT = 8 // 8 vs 5 to handle attacking a diagonal square

function toFeet(gridDistance) {
  return gridDistance * FEET_PER_CELL
}

function gridDistance(x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

export function getDistanceFeet(pos1, pos2) {
  if (!pos1 || !pos2) return null
  return toFeet(gridDistance(pos1.gridX, pos1.gridY, pos2.gridX, pos2.gridY))
}

// Bestiary dual notation "80/320 ft." (normal/long). Optional unit suffix —
// the 79 authored dual range fields all carry "ft." but unit-less "30/120"
// (MA-0436 dual-mode rows) parses here too; band split lives in
// rangePairToFeet, the scalar answer is the NORMAL figure.
const DUAL_RANGE_RE = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(feet|foot|ft\.?)?$/

/**
 * Split a range value into its authoritative { normal, long } feet pair.
 * Dual notation ("80/320 ft.") carries the REAL long figure; a single value
 * keeps the RAW normal = long/2 convention (long = normal × 2).
 * Returns null when no range is derivable (self/special/unparseable/absent).
 */
export function rangePairToFeet(range) {
  if (typeof range === 'number') return { normal: range, long: range * 2 }
  if (!range || typeof range !== 'string') return null

  const normalized = range.toLowerCase().trim().replace(/_/g, ' ')
  if (normalized === 'touch') return { normal: MELEE_RANGE_FT, long: MELEE_RANGE_FT }
  if (normalized === 'sight' || normalized === 'unlimited') return { normal: Infinity, long: Infinity }

  const dualMatch = normalized.match(DUAL_RANGE_RE)
  if (dualMatch) {
    const normal = parseFloat(dualMatch[1])
    return { normal, long: Math.max(parseFloat(dualMatch[2]), normal) }
  }

  const feet = rangeToFeet(range)
  if (feet == null) return null
  return { normal: feet, long: feet * 2 }
}

export function rangeToFeet(range) {
  if (typeof range === 'number') return range
  if (!range || typeof range !== 'string') return null

  const s = range.toLowerCase().trim()
  const normalized = s.replace(/_/g, ' ')

  if (normalized === 'touch') return MELEE_RANGE_FT
  if (normalized === 'self' || normalized.startsWith('self (')) return null
  if (normalized === 'sight') return Infinity
  if (normalized === 'unlimited') return Infinity
  if (normalized === 'special') return null

  const match = normalized.match(/^(-?\d+(?:\.\d+)?)\s*(feet|foot|ft\.?)?$/)
  if (match) return parseFloat(match[1])

  // Dual notation ("80/320 ft.") → the scalar consumers want the normal band;
  // rangePairToFeet above keeps the long figure for range-band adjudication.
  const dualMatch = normalized.match(DUAL_RANGE_RE)
  if (dualMatch) return parseFloat(dualMatch[1])

  // Anchored twin of the feet regex above (fix#1224): same boundary law on
  // both fields — exact full-string unit token only, garbage suffix → null.
  const mileMatch = normalized.match(/^(-?\d+(?:\.\d+)?)\s*(miles|mile)$/)
  if (mileMatch) return parseFloat(mileMatch[1]) * 5280

  return null
}

export function computeRangeEffect(attackRange, distanceFt, featEffects = {}) {
  const pair = rangePairToFeet(attackRange)
  if (pair == null) {
    return { mode: 'normal' }
  }

  if (distanceFt == null) {
    return { mode: 'normal' }
  }

  const { normal: numericRange } = pair
  if (numericRange <= MELEE_RANGE_FT) {
    const meleeReachBonus = featEffects.meleeReachBonus || 0
    const effectiveRange = MELEE_RANGE_FT + meleeReachBonus
    if (distanceFt <= effectiveRange) {
      return { mode: 'normal' }
    }
    return {
      mode: 'miss',
      reason: `Target out of melee range (${Math.round(distanceFt)} ft > ${effectiveRange} ft)`,
    }
  }

  const rangeMultiplier = featEffects.rangeMultiplier || 1
  const effectiveRange = numericRange * rangeMultiplier
  // Authored dual notation (e.g. 80/320) replaces the ×2 model with the REAL
  // long figure; single values already carry long = normal × 2 (rangePairToFeet).
  const longRange = Math.max(pair.long * rangeMultiplier, effectiveRange)

  if (featEffects.ignoresLongRangeDisadvantage) {
    if (distanceFt <= effectiveRange) {
      return { mode: 'normal' }
    }
    if (distanceFt <= longRange) {
      return { mode: 'normal' }
    }
    return {
      mode: 'miss',
      reason: `Out of range (${Math.round(distanceFt)} ft > ${longRange} ft)`,
    }
  }

  if (distanceFt <= effectiveRange) {
    return { mode: 'normal' }
  }
  if (distanceFt <= longRange) {
    return {
      mode: 'disadvantage',
      reason: `Beyond normal range (${Math.round(distanceFt)} ft > ${effectiveRange} ft)`,
    }
  }
  return {
    mode: 'miss',
    reason: `Out of range (${Math.round(distanceFt)} ft > ${longRange} ft)`,
  }
}

export function computeEffectiveSpellRange(spellRange, metaCtx = {}) {
  const baseFeet = rangeToFeet(spellRange)
  if (baseFeet == null) return null

  if (metaCtx.metamagicDistant) {
    if (String(spellRange).toLowerCase().trim() === 'touch') return 30
    return baseFeet * 2
  }

  return baseFeet
}

export function computeMeleeProximityEffect(isRanged, attackerPos, nearbyThreats = [], featEffects = {}) {
  if (!isRanged) {
    return { mode: 'normal' }
  }

  if (featEffects.ignoresMeleeDisadvantage) {
    return { mode: 'normal' }
  }

  if (!attackerPos || nearbyThreats.length === 0) {
    return { mode: 'normal' }
  }

  for (const threat of nearbyThreats) {
    if (isDistanceInRange(getDistanceFeet(attackerPos, threat), MELEE_RANGE_FT)) {
      return {
        mode: 'disadvantage',
        reason: `Firing in melee range of ${threat.name || 'hostile creature'}`,
      }
    }
  }

  return { mode: 'normal' }
}

export function getNearestPlacedItem(placedItems, targetName, attackerPos) {
  const matches = placedItems.filter(i => i.name === targetName || (
    i.name?.startsWith(targetName + ' ') && /^\d+$/.test(i.name.slice(targetName.length + 1))
  ))
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]

  let nearest = matches[0]
  let nearestDist = Infinity
  for (const item of matches) {
    const dx = item.gridX - attackerPos.gridX
    const dy = item.gridY - attackerPos.gridY
    const dist = dx * dx + dy * dy
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = item
    }
  }
  return nearest
}

export function isHostileNPC(npc) {
  if (!npc) return false
  if (npc.attitude == null) return true
  const attitude = npc.attitude.toLowerCase()
  return attitude === 'negative' || attitude === 'extreme opposition'
}
