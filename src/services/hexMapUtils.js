/**
 * Pure hex math utilities for pointy-top hex grids using axial coordinates (q, r).
 * No React dependencies, no side effects, no DOM access.
 */

/**
 * Returns a "q,r" string for use as object keys.
 * @param {number} q
 * @param {number} r
 * @returns {string}
 */
export function hexKey(q, r) {
  return `${q},${r}`;
}

/**
 * Parses "q,r" back to { q, r } (numbers).
 * @param {string} key
 * @returns {{ q: number, r: number }}
 */
export function parseHexKey(key) {
  const [q, r] = key.split(',');
  return { q: Number(q), r: Number(r) };
}

/**
 * Converts axial coordinates to pixel center coordinates (pointy-top).
 * @param {number} q
 * @param {number} r
 * @param {number} size - hex radius in SVG pixels
 * @returns {{ x: number, y: number }}
 */
export function hexToPixel(q, r, size) {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * 3 / 2 * r;
  return { x, y };
}

/**
 * Converts pixel position to fractional axial coordinates.
 * @param {number} x
 * @param {number} y
 * @param {number} size - hex radius in SVG pixels
 * @returns {{ q: number, r: number }}
 */
export function pixelToHex(x, y, size) {
  const r = (2 / 3 * y) / size;
  const q = (x / (size * Math.sqrt(3))) - r / 2;
  return { q, r };
}

/**
 * Rounds fractional hex coordinates to the nearest integer axial coordinate.
 * @param {number} q
 * @param {number} r
 * @returns {{ q: number, r: number }}
 */
export function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  return { q: rq, r: rr };
}

/**
 * Converts pixel position to snapped integer hex coordinates.
 * @param {number} x
 * @param {number} y
 * @param {number} size - hex radius in SVG pixels
 * @returns {{ q: number, r: number }}
 */
export function pixelToHexSnapped(x, y, size) {
  const frac = pixelToHex(x, y, size);
  return hexRound(frac.q, frac.r);
}

/**
 * Returns the 6 neighboring axial coordinates for a given hex.
 * @param {number} q
 * @param {number} r
 * @returns {Array<{ q: number, r: number }>}
 */
export function hexNeighbors(q, r) {
  return [
    { q: q + 1, r },
    { q: q - 1, r },
    { q, r: r + 1 },
    { q, r: r - 1 },
    { q: q + 1, r: r - 1 },
    { q: q - 1, r: r + 1 },
  ];
}

/**
 * Returns the distance between two hexes in hex steps.
 * @param {{ q: number, r: number }} a
 * @param {{ q: number, r: number }} b
 * @returns {number}
 */
export function hexDistance(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
}

/**
 * Returns the { x, y } offset for one corner of a pointy-top hex.
 * @param {number} cornerIndex - 0 through 5
 * @param {number} size - hex radius in SVG pixels
 * @returns {{ x: number, y: number }}
 */
export function hexCornerOffset(cornerIndex, size) {
  const angleDeg = 60 * cornerIndex - 30;
  const angleRad = angleDeg * Math.PI / 180;
  return {
    x: size * Math.cos(angleRad),
    y: size * Math.sin(angleRad),
  };
}

/**
 * Returns an array of 6 { x, y } corner points for a hexagon centered at (centerX, centerY).
 * @param {number} centerX
 * @param {number} centerY
 * @param {number} size - hex radius in SVG pixels
 * @returns {Array<{ x: number, y: number }>}
 */
export function hexCorners(centerX, centerY, size) {
  const corners = [];
  for (let i = 0; i < 6; i++) {
    const offset = hexCornerOffset(i, size);
    corners.push({
      x: centerX + offset.x,
      y: centerY + offset.y,
    });
  }
  return corners;
}

/**
 * Returns an SVG path "d" attribute string for a hexagon centered at (cx, cy).
 * @param {number} cx
 * @param {number} cy
 * @param {number} size - hex radius in SVG pixels
 * @returns {string}
 */
export function hexToSVGPath(cx, cy, size) {
  const corners = hexCorners(cx, cy, size);
  const d = corners.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ') + ' Z';
  return d;
}

/**
 * Returns an array of all { q, r } axial coordinates in a rectangular grid.
 * @param {number} width - number of columns
 * @param {number} height - number of rows
 * @returns {Array<{ q: number, r: number }>}
 */
export function getAllHexes(width, height) {
  const hexes = [];
  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      hexes.push({ q, r });
    }
  }
  return hexes;
}

/**
 * Returns the total pixel dimensions and offsets of a full hex grid.
 * For axial coordinates (q in 0..width-1, r in 0..height-1) with pointy-top hexes:
 *   Leftmost point: left corner of hex (0, 0) = -size * sqrt(3) / 2
 *   Rightmost point: right corner of hex (width-1, height-1)
 *     = size * sqrt(3) * ((width-1) + (height-1)/2 + 0.5)
 *   Topmost point: top corner of hex (0, 0) = -size
 *   Bottommost point: bottom corner of hex (0, height-1)
 *     = size * (1.5 * (height-1) + 1)
 * @param {number} width - number of columns
 * @param {number} height - number of rows
 * @param {number} size - hex radius in SVG pixels
 * @returns {{ width: number, height: number, offsetX: number, offsetY: number, centerX: number, centerY: number }}
 */
export function getHexGridPixelDimensions(width, height, size) {
  const xMin = -size * Math.sqrt(3) / 2;
  const xMax = size * Math.sqrt(3) * ((width - 1) + (height - 1) / 2 + 0.5);
  const yMin = -size;
  const yMax = size * (1.5 * (height - 1) + 1);

  return {
    width: xMax - xMin,
    height: yMax - yMin,
    offsetX: xMin,
    offsetY: yMin,
    centerX: (xMin + xMax) / 2,
    centerY: (yMin + yMax) / 2,
  };
}

/**
 * Converts offset coordinates to pixel center (pointy-top, odd-row offset).
 * @param {number} col - column index
 * @param {number} row - row index
 * @param {number} size - hex radius in SVG pixels
 * @returns {{ x: number, y: number }}
 */
export function getHexCenterFromOffset(col, row, size) {
  const q = col - (row - (row & 1)) / 2;
  const r = row;
  return hexToPixel(q, r, size);
}

/**
 * Deterministic winding offset for a pair of adjacent hexes, producing
 * a perpendicular offset (in pixels) for smooth river/road curves.
 * Based only on hex coordinates, so it's consistent across reloads.
 * @param {number} q1
 * @param {number} r1
 * @param {number} q2
 * @param {number} r2
 * @param {number} [maxOffset=5]
 * @returns {number}
 */
export function windingOffset(q1, r1, q2, r2, maxOffset = 5) {
  const n = Math.sin(q1 * 127.1 + r1 * 311.7 + q2 * 74.7 + r2 * 243.3) * 43758.5453;
  return (n - Math.floor(n)) * maxOffset * 2 - maxOffset;
}

/**
 * Determines whether two POI types should be connectable by roads.
 * Roads connect cities ↔ cities, cities ↔ settlements, settlements ↔ settlements.
 * @param {string} typeA
 * @param {string} typeB
 * @returns {boolean}
 */
export function isRoadConnectable(typeA, typeB) {
  const roadable = new Set(['city', 'settlement']);
  return roadable.has(typeA) && roadable.has(typeB);
}

/**
 * A* pathfinding on the hex grid between two coordinates.
 * Returns an ordered array of { q, r } waypoints (including start and end).
 * Cost function prefers plains and avoids water/mountains.
 * @param {{ q: number, r: number }} start
 * @param {{ q: number, r: number }} end
 * @param {number} gridSize
 * @param {Record<string, string>} terrain - hex key → terrain id
 * @returns {Array<{ q: number, r: number }> | null}
 */
export function findHexPath(start, end, hexCols, hexRows, terrain = {}) {
  const terrainCost = {
    plains: 1, beach: 1.2, hills: 1.5, forest: 1.5,
    desert: 1.8, tundra: 1.8, swamp: 2.5, mountains: 4, water: 10,
  };

  const key = (q, r) => `${q},${r}`;
  const startKey = key(start.q, start.r);
  const endKey = key(end.q, end.r);
  if (startKey === endKey) return [start];

  const openSet = new Set([startKey]);
  const cameFrom = {};
  const gScore = { [startKey]: 0 };
  const fScore = { [startKey]: hexDistance(start, end) };

  while (openSet.size > 0) {
    // Find node in openSet with lowest fScore
    let current = null;
    let currentF = Infinity;
    for (const k of openSet) {
      const f = fScore[k] ?? Infinity;
      if (f < currentF) {
        currentF = f;
        current = k;
      }
    }

    if (current === endKey) {
      // Reconstruct path
      const path = [{ q: end.q, r: end.r }];
      let c = endKey;
      while (cameFrom[c]) {
        const [pq, pr] = cameFrom[c].split(',').map(Number);
        path.unshift({ q: pq, r: pr });
        c = cameFrom[c];
      }
      return path;
    }

    openSet.delete(current);
    const [cq, cr] = current.split(',').map(Number);

    for (const n of hexNeighbors(cq, cr)) {
      if (n.q < 0 || n.q >= hexCols || n.r < 0 || n.r >= hexRows) continue;
      const nk = key(n.q, n.r);
      const terrainId = terrain[nk] || 'plains';
      const cost = terrainCost[terrainId] ?? 2;
      const tentative = (gScore[current] ?? Infinity) + cost;
      if (tentative < (gScore[nk] ?? Infinity)) {
        cameFrom[nk] = current;
        gScore[nk] = tentative;
        fScore[nk] = tentative + hexDistance(n, end);
        openSet.add(nk);
      }
    }
  }

  return null; // No path found
}

/**
 * Orders a set of connected hex coordinates into a linear path
 * by walking from one endpoint to another.
 * @param {Array<{ q: number, r: number }>} hexes
 * @returns {Array<{ q: number, r: number }>}
 */
export function orderHexPath(hexes) {
  if (hexes.length <= 2) return hexes;

  const hexKeys = new Set(hexes.map(h => `${h.q},${h.r}`));
  const adj = {};
  for (const h of hexes) {
    const k = `${h.q},${h.r}`;
    adj[k] = hexNeighbors(h.q, h.r)
      .filter(n => hexKeys.has(`${n.q},${n.r}`))
      .map(n => `${n.q},${n.r}`);
  }

  // Find endpoints (nodes with exactly 1 neighbor)
  const ends = Object.keys(adj).filter(k => adj[k].length === 1);
  if (ends.length < 2) {
    // Loop or single node — return as-is
    return hexes;
  }

  const ordered = [];
  let current = ends[0];
  let prev = null;
  while (current) {
    const [q, r] = current.split(',').map(Number);
    ordered.push({ q, r });
    const nexts = adj[current].filter(k => k !== prev);
    prev = current;
    current = nexts.length > 0 ? nexts[0] : null;
  }

  return ordered;
}

/**
 * Generates a smooth winding SVG path string through ordered hex centers.
 * Uses cubic beziers with deterministic perpendicular offsets for a natural look.
 * @param {Array<{ q: number, r: number }>} orderedHexes
 * @param {number} size - hex radius in pixels
 * @param {string} color - stroke color
 * @param {number} strokeWidth
 * @param {number} [windAmount=4] - max perpendicular offset in pixels
 * @returns {{ path: string, fill: string, stroke: string, strokeWidth: number }}
 */
export function buildWindingPathDescriptor(orderedHexes, size, color, strokeWidth, windAmount = 4) {
  if (!orderedHexes || orderedHexes.length === 0) return null;

  const centers = orderedHexes.map(h => hexToPixel(h.q, h.r, size));
  if (centers.length === 1) {
    return { path: '', fill: color, stroke: 'none', strokeWidth: 0 };
  }

  // Build a dense series of waypoints with winding offsets, then smooth with bezier
  const subdivisions = 3;
  const rawPoints = [];

  for (let i = 0; i < centers.length - 1; i++) {
    const a = centers[i];
    const b = centers[i + 1];
    const hA = orderedHexes[i];
    const hB = orderedHexes[i + 1];

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / segLen;
    const py = dx / segLen;

    // Accumulated path length for smooth meander
    const overallLength = i * segLen;

    for (let j = 0; j < subdivisions; j++) {
      const t = j / subdivisions;
      const bx = a.x + dx * t;
      const by = a.y + dy * t;

      // Per-segment offset from hex pair hash
      const localOffset = windingOffset(hA.q, hA.r, hB.q, hB.r, windAmount);
      // Larger-scale meander based on overall position along the path
      const globalMeander = Math.sin(overallLength * 0.04) * windAmount * 0.6;

      const offset = localOffset + globalMeander;
      rawPoints.push({ x: bx + px * offset, y: by + py * offset });
    }
  }

  // Last hex center
  const lastC = centers[centers.length - 1];
  rawPoints.push({ x: lastC.x, y: lastC.y });

  // Build smooth quadratic bezier path through all waypoints
  const parts = [`M${rawPoints[0].x},${rawPoints[0].y}`];
  for (let i = 1; i < rawPoints.length - 1; i++) {
    const cur = rawPoints[i];
    const next = rawPoints[i + 1];
    const midX = (cur.x + next.x) / 2;
    const midY = (cur.y + next.y) / 2;
    parts.push(`Q${cur.x},${cur.y} ${midX},${midY}`);
  }
  // Final segment to last point
  const pen = rawPoints[rawPoints.length - 2];
  parts.push(`Q${pen.x},${pen.y} ${lastC.x},${lastC.y}`);

  return {
    path: parts.join(''),
    fill: 'none',
    stroke: color,
    strokeWidth,
  };
}
