const FEET_PER_CELL = 5
const MELEE_RANGE_FT = 8 // 8 vs 5 to handle attacking a diagonal square

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

export function computeRangeEffect(attackRange, distanceFt, featEffects = {}) {
  if (distanceFt == null) {
    return { mode: 'normal' }
  }

  if (attackRange <= MELEE_RANGE_FT) {
    if (distanceFt <= MELEE_RANGE_FT) {
      return { mode: 'normal' }
    }
    return {
      mode: 'miss',
      reason: `Target out of melee range (${Math.round(distanceFt)} ft > ${MELEE_RANGE_FT} ft)`,
    }
  }

  const effectiveRange = attackRange * (featEffects.rangeMultiplier || 1)
  const longRange = effectiveRange * 2

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
    const dist = getDistanceFeet(attackerPos, threat)
    if (dist != null && dist <= MELEE_RANGE_FT) {
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
