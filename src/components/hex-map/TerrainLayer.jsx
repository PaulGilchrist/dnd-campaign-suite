import { useMemo } from 'react';
import { HEX_SIZE, TERRAIN_TYPES, DEFAULT_TERRAIN } from '../../config/outdoorConfig.js';
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
            const terrainId = terrain[key] || DEFAULT_TERRAIN;
            const colors = terrainLookup[terrainId] || terrainLookup[DEFAULT_TERRAIN];
            const center = hexToPixel(q, r, HEX_SIZE);
            const d = hexToSVGPath(center.x, center.y, HEX_SIZE);

            const fill = tintedTerrainFill(colors.fill, q, r);

            return {
                key,
                d,
                fill,
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
