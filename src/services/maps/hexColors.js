/**
 * Shared per-hex terrain colour jitter used by BOTH the 2D SVG TerrainLayer
 * and the read-only 3D hex scene, so a hex reads with the same colour in
 * either view. Pure string/math helpers, no DOM, no React.
 */

export function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

export function rgbToString(r, g, b) {
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function applyVariation(r, g, b, factor) {
    const f = 1 + factor;
    return {
        r: r * f,
        g: g * f,
        b: b * f,
    };
}

/**
 * Deterministic ±0.05 brightness factor for a hex, based only on its axial
 * coordinates (stable across reloads, mirrors the SVG paint).
 */
export function hexVariation(q, r) {
    let h = (q ^ (r << 13)) * 0x45D9F3B;
    h = ((h ^ (h >> 13)) * 0x27D4EB2D) & 0x7FFFFFFF;
    const normalized = (h & 0x7FFFFFFF) / 0x7FFFFFFF;
    return (normalized - 0.5) * 0.1;
}

/** Tinted {r,g,b} (0-255, may exceed on the bright side like the SVG did). */
export function tintedTerrainRgb(fill, q, r) {
    const base = hexToRgb(fill);
    return applyVariation(base.r, base.g, base.b, hexVariation(q, r));
}

/** rgb() string form used by the SVG fill attribute. */
export function tintedTerrainFill(fill, q, r) {
    const { r: rr, g: gg, b: bb } = tintedTerrainRgb(fill, q, r);
    return rgbToString(rr, gg, bb);
}
