/**
 * Level 5 (L5-002) — movement budget math, pure (plan §7.3).
 *
 * Grid cost model: 4-directional steps (mirrors computeReachable's 4-dir BFS
 * in services/maps/reachability.js) at FEET_PER_CELL each, multiplied by the
 * terrain factor of the ENTERED cell. Terrain is read from the map JSON's
 * already-round-tripped `terrain` key: { "x,y": "difficult" | "rough" | … }.
 *
 * Graceful degradation (mirrors isWithinRange's fallback): no enforcement /
 * no map / no terrain ⇒ callers skip the clamp entirely; these helpers never
 * invent obstacles.
 */
import { remainingMovement } from './turnState.js'

export const FEET_PER_CELL = 5

// Difficult terrain costs 2×; greater terrain 4× (current rules text).
export const TERRAIN_MULTIPLIERS = Object.freeze({
    difficult: 2, rough: 2, swamp: 2, dense: 2, snow: 2, sand: 2,
    greater: 4,
})

export function terrainMultiplier(terrain, x, y) {
    const v = terrain && terrain[`${x},${y}`]
    return TERRAIN_MULTIPLIERS[String(v || '').toLowerCase()] || 1
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

function inBounds(x, y, gridSize) {
    return x >= 0 && y >= 0 && x < gridSize && y < gridSize
}

/**
 * Shared Dijkstra over the battle grid (4-dir, difficult-terrain weighted).
 * Returns a Map of "x,y" → cheapest cost-feet for every cell reachable within
 * `budgetFeet` (default unlimited). Origin cell is always cost 0 (free to
 * leave). `obstacles` cells are impassable. Small grids ⇒ array-scan is fine.
 */
function traverseGrid({ from, obstacles, terrain, gridSize, budgetFeet = Infinity }) {
    const blocked = obstacles || new Set()
    const cost = new Map()
    cost.set(`${from.gridX},${from.gridY}`, 0)
    const settled = new Set()
    const frontier = [{ x: from.gridX, y: from.gridY, c: 0 }]
    while (frontier.length) {
        let bestIdx = 0
        for (let i = 1; i < frontier.length; i++) if (frontier[i].c < frontier[bestIdx].c) bestIdx = i
        const { x, y, c } = frontier.splice(bestIdx, 1)[0]
        const key = `${x},${y}`
        if (settled.has(key)) continue
        settled.add(key)
        for (const [dx, dy] of DIRS) {
            const nx = x + dx
            const ny = y + dy
            if (!inBounds(nx, ny, gridSize)) continue
            const nKey = `${nx},${ny}`
            if (settled.has(nKey) || blocked.has(nKey)) continue
            const nc = c + FEET_PER_CELL * terrainMultiplier(terrain, nx, ny)
            if (nc > budgetFeet) continue
            if (nc < (cost.get(nKey) ?? Infinity)) {
                cost.set(nKey, nc)
                frontier.push({ x: nx, y: ny, c: nc })
            }
        }
    }
    return cost
}

/**
 * Cheapest movement cost (feet) from → to via 4-dir weighted search.
 * Returns Infinity when unreachable.
 */
export function computePathCost({ from, to, obstacles, terrain, gridSize }) {
    if (!from || !to) return Infinity
    if (from.gridX === to.gridX && from.gridY === to.gridY) return 0
    if (!inBounds(to.gridX, to.gridY, gridSize)) return Infinity
    const cost = traverseGrid({ from, obstacles, terrain, gridSize })
    return cost.get(`${to.gridX},${to.gridY}`) ?? Infinity
}

/**
 * Best cell reachable within budgetFeet that is nearest to `to`
 * (ties → fewer steps). Returns { x, y, costFeet }. Origin always qualifies.
 */
export function snapToBudget({ from, to, budgetFeet, obstacles, terrain, gridSize }) {
    const cost = traverseGrid({ from, obstacles, terrain, gridSize, budgetFeet })
    let best = { x: from.gridX, y: from.gridY, costFeet: 0, steps: 0 }
    let bestDist = (to.gridX - from.gridX) ** 2 + (to.gridY - from.gridY) ** 2
    for (const [key, c] of cost) {
        const [x, y] = key.split(',').map(Number)
        const dist = (to.gridX - x) ** 2 + (to.gridY - y) ** 2
        const steps = Math.abs(x - from.gridX) + Math.abs(y - from.gridY)
        if (dist < bestDist || (dist === bestDist && steps < best.steps)) {
            best = { x, y, costFeet: c, steps }
            bestDist = dist
        }
    }
    return best
}

/**
 * Clamp a drag drop to the creature's remaining movement budget.
 * Returns { target: { gridX, gridY }, costFeet, snapped }.
 */
export function clampMovementDrop({ turnState, creatureName, speedFeet, from, to, obstacles, terrain, gridSize }) {
    const budget = remainingMovement(turnState, creatureName, speedFeet)
    const cost = computePathCost({ from, to, obstacles, terrain, gridSize })
    if (cost === Infinity) return { target: from, costFeet: 0, snapped: true, unreachable: true }
    if (cost <= budget) return { target: to, costFeet: cost, snapped: false }
    if (budget <= 0) return { target: from, costFeet: 0, snapped: true }
    const snapped = snapToBudget({ from, to, budgetFeet: budget, obstacles, terrain, gridSize })
    return { target: { gridX: snapped.x, gridY: snapped.y }, costFeet: snapped.costFeet, snapped: true }
}

/**
 * Rigid multi-select offset clamp (GM select-drag, §7.3): the whole group
 * moves together, so the binding budget is the MINIMUM remaining movement
 * across the selected creatures. Scales dx/dy down proportionally (integer
 * cells) until (|dx|+|dy|)×FEET_PER_CELL fits; returns { dx, dy, costFeet }.
 */
export function clampSelectionOffset({ dx, dy, minBudgetFeet }) {
    let cells = Math.abs(dx) + Math.abs(dy)
    if (cells === 0) return { dx: 0, dy: 0, costFeet: 0 }
    const maxCells = Math.floor(Math.max(0, minBudgetFeet) / FEET_PER_CELL)
    if (cells <= maxCells) return { dx, dy, costFeet: cells * FEET_PER_CELL }
    if (maxCells === 0) return { dx: 0, dy: 0, costFeet: 0 }
    const ratio = maxCells / cells
    let sx = Math.trunc(dx * ratio)
    let sy = Math.trunc(dy * ratio)
    // Distribute any leftover cells along the dominant axis.
    let left = maxCells - (Math.abs(sx) + Math.abs(sy))
    if (left > 0) {
        if (Math.abs(dx) >= Math.abs(dy)) sx += Math.sign(dx) * left
        else sy += Math.sign(dy) * left
    }
    return { dx: sx, dy: sy, costFeet: (Math.abs(sx) + Math.abs(sy)) * FEET_PER_CELL }
}
