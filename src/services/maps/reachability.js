import { computeEffectiveWalls } from './effectiveWalls.js';

export function computeClosedDoors(placedItems) {
    const closedDoors = new Set();
    for (const item of placedItems || []) {
        if (item.type === 'door' && !item.open) {
            closedDoors.add(`${item.gridX},${item.gridY}`);
        }
    }
    return closedDoors;
}

// Cells that block movement: painted walls, hidden secret doors (disguised as
// walls) and closed doors. Open doors and discovered secret doors pass.
export function computeMovementObstacles(walls, placedItems) {
    const obstacles = computeEffectiveWalls(walls, placedItems);
    for (const key of computeClosedDoors(placedItems)) {
        obstacles.add(key);
    }
    return obstacles;
}

// 4-direction flood fill from the start cell through passable cells. Returns
// the set of "x,y" cells a player could walk to (including the start). If the
// start cell itself is blocked (legacy data) only that cell is returned so
// the player stays pinned instead of escaping.
export function computeReachable(startX, startY, obstacles, gridSize) {
    const reachable = new Set();
    if (!gridSize || gridSize < 1) return reachable;

    const sx = Math.max(0, Math.min(gridSize - 1, startX));
    const sy = Math.max(0, Math.min(gridSize - 1, startY));
    const startKey = `${sx},${sy}`;
    reachable.add(startKey);
    if (obstacles.has(startKey)) return reachable;

    const queue = [[sx, sy]];
    const visited = new Set([startKey]);

    while (queue.length > 0) {
        const [x, y] = queue.shift();
        const neighbors = [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1],
        ];
        for (const [nx, ny] of neighbors) {
            if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
            const key = `${nx},${ny}`;
            if (visited.has(key) || obstacles.has(key)) continue;
            visited.add(key);
            reachable.add(key);
            queue.push([nx, ny]);
        }
    }
    return reachable;
}

// Breadth-first search from (startX, startY) for the first cell that passes
// isValid at the shortest cell distance. Returns { x, y } or null.
export function findNearestValid(startX, startY, isValid, gridSize) {
    if (!gridSize || gridSize < 1) return null;

    const sx = Math.max(0, Math.min(gridSize - 1, startX));
    const sy = Math.max(0, Math.min(gridSize - 1, startY));

    const queue = [[sx, sy]];
    const visited = new Set([`${sx},${sy}`]);

    while (queue.length > 0) {
        const [x, y] = queue.shift();
        if (isValid(x, y)) return { x, y };
        const neighbors = [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1],
        ];
        for (const [nx, ny] of neighbors) {
            if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
            const key = `${nx},${ny}`;
            if (visited.has(key)) continue;
            visited.add(key);
            queue.push([nx, ny]);
        }
    }
    return null;
}
