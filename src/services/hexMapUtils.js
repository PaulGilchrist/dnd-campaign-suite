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
 * Returns the total pixel dimensions of a full hex grid.
 * @param {number} width - number of columns
 * @param {number} height - number of rows
 * @param {number} size - hex radius in SVG pixels
 * @returns {{ width: number, height: number }}
 */
export function getHexGridPixelDimensions(width, height, size) {
  const totalWidth = size * Math.sqrt(3) * (width + 0.5);
  const totalHeight = size * 3 / 2 * height + size / 2;
  return { width: totalWidth, height: totalHeight };
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
