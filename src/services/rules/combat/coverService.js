import { bresenham } from '../../maps/lineOfSight.js'
import { computeEffectiveWalls } from '../../maps/effectiveWalls.js'

export const COVER = {
  FULL: 'full',
  THREE_QUARTER: 'threeQuarter',
  HALF: 'half',
  NONE: 'none',
}

export const COVER_AC_BONUS = {
  [COVER.FULL]: null,
  [COVER.THREE_QUARTER]: 5,
  [COVER.HALF]: 2,
  [COVER.NONE]: 0,
}

const THREE_QUARTER_COVER_TYPES = new Set(['altar', 'table', 'bed', 'bookshelf'])
const HALF_COVER_TYPES = new Set(['barrel', 'chair', 'chest', 'crate', 'fountain', 'pillar', 'statue'])
const TWO_CELL_TYPES = new Set(['table', 'bed', 'altar', 'bookshelf'])

function getOccupiedCells(item) {
  const cells = [{ x: item.gridX, y: item.gridY }]
  if (TWO_CELL_TYPES.has(item.type)) {
    const isVertical = (item.rotation || 0) % 180 === 90
    if (isVertical) {
      cells.push({ x: item.gridX, y: item.gridY + 1 })
    } else {
      cells.push({ x: item.gridX + 1, y: item.gridY })
    }
  }
  return cells
}

// Consumer-facing name for the furniture item that produced a cover tier —
// a GM rename wins; otherwise the capitalized type key reads as the honest
// label ('barrel' → 'Barrel'). Rides computeCover's `sourceLabel` so sheet-lane
// rows can say WHY a target is behind cover (coverReason), not just the bonus.
export function coverSourceLabel(item) {
  const name = typeof item?.name === 'string' ? item.name.trim() : ''
  if (name) return name
  const type = item?.type
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : null
}

function buildCoverMap(placedItems) {
  const coverMap = new Map()
  for (const item of placedItems) {
    let level = null
    if (THREE_QUARTER_COVER_TYPES.has(item.type)) {
      level = COVER.THREE_QUARTER
    } else if (HALF_COVER_TYPES.has(item.type)) {
      level = COVER.HALF
    }
    if (!level) continue
    for (const cell of getOccupiedCells(item)) {
      const key = `${cell.x},${cell.y}`
      if (!coverMap.has(key)) {
        coverMap.set(key, { level, item })
      }
    }
  }
  return coverMap
}

// First interior cell (ray order, so nearest the attacker) covered by `level`.
function firstCoveredCell(cells, coverMap, level) {
  for (const cell of cells) {
    const entry = coverMap.get(`${cell.x},${cell.y}`)
    if (entry && entry.level === level) return entry.item
  }
  return null
}

function buildClosedDoors(placedItems) {
  const closedDoors = new Set()
  for (const item of placedItems) {
    if (item.type === 'door' && !item.open) {
      for (const cell of getOccupiedCells(item)) {
        closedDoors.add(`${cell.x},${cell.y}`)
      }
    }
  }
  return closedDoors
}

function lineHits(cells, test) {
  return cells.some((cell) => test(`${cell.x},${cell.y}`))
}

export function computeCover(attackerPos, targetPos, walls, placedItems) {
  const line = bresenham(attackerPos.gridX, attackerPos.gridY, targetPos.gridX, targetPos.gridY)

    const wallKeys = computeEffectiveWalls(walls, placedItems)
    const coverMap = buildCoverMap(placedItems)
    const closedDoors = buildClosedDoors(placedItems)

  const cells = line.slice(1, -1)

  if (lineHits(cells, (key) => wallKeys.has(key) || closedDoors.has(key))) {
    return { level: COVER.FULL, acBonus: COVER_AC_BONUS[COVER.FULL] }
  }
  const threeQuarterItem = firstCoveredCell(cells, coverMap, COVER.THREE_QUARTER)
  if (threeQuarterItem) {
    return {
      level: COVER.THREE_QUARTER,
      acBonus: COVER_AC_BONUS[COVER.THREE_QUARTER],
      sourceLabel: coverSourceLabel(threeQuarterItem),
    }
  }
  const halfItem = firstCoveredCell(cells, coverMap, COVER.HALF)
  if (halfItem) {
    return {
      level: COVER.HALF,
      acBonus: COVER_AC_BONUS[COVER.HALF],
      sourceLabel: coverSourceLabel(halfItem),
    }
  }

  return { level: COVER.NONE, acBonus: 0 }
}
