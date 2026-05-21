import React, { useMemo } from 'react';
import { HEX_SIZE, TERRAIN_TYPES, DEFAULT_TERRAIN } from '../../config/outdoorConfig.js';
import { getAllHexes, hexKey, hexToPixel, hexToSVGPath } from '../../services/hexMapUtils.js';

// Build lookup map: terrain id -> { fill, stroke }
const terrainLookup = {};
TERRAIN_TYPES.forEach(t => {
    terrainLookup[t.id] = { fill: t.fill, stroke: t.stroke };
});

function TerrainLayer({ gridSize, terrain }) {
    const hexes = useMemo(() => {
        const allHexes = getAllHexes(gridSize, gridSize);
        return allHexes.map(({ q, r }) => {
            const key = hexKey(q, r);
            const terrainId = terrain[key] || DEFAULT_TERRAIN;
            const colors = terrainLookup[terrainId] || terrainLookup[DEFAULT_TERRAIN];
            const center = hexToPixel(q, r, HEX_SIZE);
            const d = hexToSVGPath(center.x, center.y, HEX_SIZE);
            return { key, d, fill: colors.fill, stroke: colors.stroke };
        });
    }, [gridSize, terrain]);

    return (
        <g className="terrain-layer">
            {hexes.map(({ key, d, fill, stroke }) => (
                <path
                    key={key}
                    d={d}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="0.8"
                />
            ))}
        </g>
    );
}

export default TerrainLayer;
