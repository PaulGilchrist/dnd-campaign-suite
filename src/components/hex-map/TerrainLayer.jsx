import React, { useMemo } from 'react';
import { HEX_SIZE, TERRAIN_TYPES, DEFAULT_TERRAIN } from '../../config/outdoorConfig.js';
import { getAllHexes, hexKey, hexToPixel, hexToSVGPath } from '../../services/hexMapUtils.js';

const terrainLookup = {};
TERRAIN_TYPES.forEach(t => {
    terrainLookup[t.id] = { fill: t.fill, stroke: t.stroke };
});

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

function rgbToString(r, g, b) {
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function applyVariation(r, g, b, factor) {
    const f = 1 + factor;
    return {
        r: r * f,
        g: g * f,
        b: b * f,
    };
}

function hexVariation(q, r) {
    let h = (q ^ (r << 13)) * 0x45D9F3B;
    h = ((h ^ (h >> 13)) * 0x27D4EB2D) & 0x7FFFFFFF;
    const normalized = (h & 0x7FFFFFFF) / 0x7FFFFFFF;
    return (normalized - 0.5) * 0.1;
}

function TerrainLayer({ hexCols, hexRows, terrain }) {
    const hexes = useMemo(() => {
        const allHexes = getAllHexes(hexCols, hexRows);
        return allHexes.map(({ q, r }) => {
            const key = hexKey(q, r);
            const terrainId = terrain[key] || DEFAULT_TERRAIN;
            const colors = terrainLookup[terrainId] || terrainLookup[DEFAULT_TERRAIN];
            const center = hexToPixel(q, r, HEX_SIZE);
            const d = hexToSVGPath(center.x, center.y, HEX_SIZE);

            const rgb = hexToRgb(colors.fill);
            const variation = hexVariation(q, r);
            const varied = applyVariation(rgb.r, rgb.g, rgb.b, variation);

            return {
                key,
                d,
                fill: rgbToString(varied.r, varied.g, varied.b),
            };
        });
    }, [hexCols, hexRows, terrain]);

    return (
        <g className="terrain-layer">
            {hexes.map(({ key, d, fill }) => (
                <path
                    key={key}
                    d={d}
                    fill={fill}
                />
            ))}
        </g>
    );
}

export default TerrainLayer;
