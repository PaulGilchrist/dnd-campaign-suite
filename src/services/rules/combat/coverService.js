import { bresenham } from '../../maps/lineOfSight.js'

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

export function computeCover(attackerPos, targetPos, walls, placedItems) {
  const line = bresenham(attackerPos.gridX, attackerPos.gridY, targetPos.gridX, targetPos.gridY)

  const wallKeys = walls?.has ? walls : new Set(walls || [])

  const coverMap = new Map()
  for (const item of placedItems) {
    const cells = getOccupiedCells(item)
    let level = null
    if (THREE_QUARTER_COVER_TYPES.has(item.type)) {
      level = COVER.THREE_QUARTER
    } else if (HALF_COVER_TYPES.has(item.type)) {
      level = COVER.HALF
    }
    if (level) {
      for (const cell of cells) {
        const key = `${cell.x},${cell.y}`
        if (!coverMap.has(key)) {
          coverMap.set(key, level)
        }
      }
    }
  }

  const closedDoors = new Set()
  for (const item of placedItems) {
    if (item.type === 'door' && !item.open) {
      for (const cell of getOccupiedCells(item)) {
        closedDoors.add(`${cell.x},${cell.y}`)
      }
    }
  }

  const cells = line.slice(1, -1)

  for (const cell of cells) {
    const key = `${cell.x},${cell.y}`
    if (wallKeys.has(key) || closedDoors.has(key)) {
      return { level: COVER.FULL, acBonus: COVER_AC_BONUS[COVER.FULL] }
    }
  }

  for (const cell of cells) {
    const key = `${cell.x},${cell.y}`
    if (coverMap.get(key) === COVER.THREE_QUARTER) {
      return { level: COVER.THREE_QUARTER, acBonus: COVER_AC_BONUS[COVER.THREE_QUARTER] }
    }
  }

  for (const cell of cells) {
    const key = `${cell.x},${cell.y}`
    if (coverMap.get(key) === COVER.HALF) {
      return { level: COVER.HALF, acBonus: COVER_AC_BONUS[COVER.HALF] }
    }
  }

  return { level: COVER.NONE, acBonus: 0 }
}
