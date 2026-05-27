
export function bresenham(x0, y0, x1, y1) {
    const cells = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0, y = y0;
    const maxSteps = Math.max(dx, dy) * 2;

    for (let i = 0; i <= maxSteps; i++) {
        cells.push({ x, y });
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
    }
    return cells;
}

export function computeVisibility(players, walls, closedDoors, gridSize) {
    const visible = new Set();

    for (const player of players) {
        const px = player.gridX;
        const py = player.gridY;
        const playerKey = `${px},${py}`;
        visible.add(playerKey);

        for (let tx = 0; tx < gridSize; tx++) {
            for (let ty = 0; ty < gridSize; ty++) {
                if (tx === px && ty === py) continue;

                const line = bresenham(px, py, tx, ty);
                let blocked = false;

                for (let i = 1; i < line.length - 1; i++) {
                    const cellKey = `${line[i].x},${line[i].y}`;
                    if (walls.has(cellKey) || closedDoors.has(cellKey)) {
                        blocked = true;
                        break;
                    }
                }

                if (!blocked) {
                    visible.add(`${tx},${ty}`);
                }
            }
        }
    }

    return visible;
}
