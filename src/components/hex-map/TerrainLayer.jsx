import { useMemo } from 'react';
import { HEX_SIZE, TERRAIN_TYPES, DEFAULT_TERRAIN, isKnownTerrain } from '../../config/outdoorConfig.js';
import { getAllHexes, hexKey, hexToPixel, hexToSVGPath } from '../../services/maps/hexMapUtils.js';
import { tintedTerrainFill } from '../../services/maps/hexColors.js';

const terrainLookup = {};
TERRAIN_TYPES.forEach(t => {
    terrainLookup[t.id] = { fill: t.fill, stroke: t.stroke };
});

function TerrainLayer({ hexCols, hexRows, terrain }) {
    const hexes = useMemo(() => {
        const allHexes = getAllHexes(hexCols, hexRows);
        return allHexes.map(({ q, r }) => {
            const key = hexKey(q, r);
            const storedId = terrain[key];
            const terrainId = storedId || DEFAULT_TERRAIN;
            const colors = terrainLookup[terrainId] || terrainLookup[DEFAULT_TERRAIN];
            const center = hexToPixel(q, r, HEX_SIZE);
            const d = hexToSVGPath(center.x, center.y, HEX_SIZE);

            const fill = tintedTerrainFill(colors.fill, q, r);

            // Editor drift signal: a stored id outside TERRAIN_TYPES still fills
            // as plains (byte-identical fallback), but gets a ⚠ glyph so legacy /
            // API-injected unknown ids are visible instead of silent.
            const warning = storedId && !isKnownTerrain(storedId)
                ? { x: center.x, y: center.y }
                : null;

            return {
                key,
                d,
                fill,
                warning,
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
            {hexes.filter(hex => hex.warning).map(({ key, warning }) => (
                <text
                    key={`warn-${key}`}
                    className="terrain-unknown-warning"
                    x={warning.x}
                    y={warning.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                >
                    ⚠
                </text>
            ))}
        </g>
    );
}

export default TerrainLayer;
