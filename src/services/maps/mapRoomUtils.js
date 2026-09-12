export function hasOpenNeighbor(walls, gx, gy, gridSize) {
    const neighbors = [
        [gx - 1, gy], [gx + 1, gy],
        [gx, gy - 1], [gx, gy + 1],
    ];
    for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
            if (!walls.has(`${nx},${ny}`)) return true;
        }
    }
    return false;
}

export function hasOutsideOpenNeighbor({ walls, gx, gy, minX, maxX, minY, maxY, gridSize }) {
    const neighbors = [
        [gx - 1, gy], [gx + 1, gy],
        [gx, gy - 1], [gx, gy + 1],
    ];
    for (const [nx, ny] of neighbors) {
        if (nx < minX || nx > maxX || ny < minY || ny > maxY) {
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
                if (!walls.has(`${nx},${ny}`)) return true;
            }
        }
    }
    return false;
}

export function buildRoomWalls(walls, minX, maxX, minY, maxY, gridSize) {
    const newWalls = new Set(walls);
    const bounds = { minX, maxX, minY, maxY, gridSize };

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            newWalls.delete(`${x},${y}`);
        }
    }

    for (let x = minX; x <= maxX; x++) {
        if (!hasOutsideOpenNeighbor({ ...bounds, walls: newWalls, gx: x, gy: minY })) {
            newWalls.add(`${x},${minY}`);
        }
    }
    for (let x = minX; x <= maxX; x++) {
        if (!hasOutsideOpenNeighbor({ ...bounds, walls: newWalls, gx: x, gy: maxY })) {
            newWalls.add(`${x},${maxY}`);
        }
    }
    for (let y = minY + 1; y < maxY; y++) {
        if (!hasOutsideOpenNeighbor({ ...bounds, walls: newWalls, gx: minX, gy: y })) {
            newWalls.add(`${minX},${y}`);
        }
    }
    for (let y = minY + 1; y < maxY; y++) {
        if (!hasOutsideOpenNeighbor({ ...bounds, walls: newWalls, gx: maxX, gy: y })) {
            newWalls.add(`${maxX},${y}`);
        }
    }

    return newWalls;
}

export function createRoom(minX, minY, w, h) {
    return {
        id: Date.now(),
        rect: { x: minX, y: minY, w, h },
        type: 'common',
        label: '',
        connectedTo: [],
    };
}
