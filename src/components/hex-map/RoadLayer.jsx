import { useMemo } from 'react';
import { HEX_SIZE } from '../../config/outdoorConfig.js';
import { parseHexKey, buildWindingPathDescriptor } from '../../services/maps/hexMapUtils.js';

// Junk rows in a stored roads array (non-objects, missing/hexes with bad
// keys) must skip themselves, not throw — the whole editor sits behind this
// layer (backlog 2026-11-02 BD).
function cleanRoadHexes(road) {
    const ordered = [];
    for (const hex of road.hexes) {
        const point = parseHexKey(hex); // logs malformed rows fail-soft
        if (point) ordered.push(point);
    }
    return ordered;
}

function RoadLayer({ roads }) {
    const elements = useMemo(() => {
        if (!roads || roads.length === 0) return null;

        const paths = [];

        for (const road of roads) {
            if (!road || typeof road !== 'object' || !Array.isArray(road.hexes)) continue;

            const ordered = cleanRoadHexes(road);
            if (ordered.length < 2) continue;

            const desc = buildWindingPathDescriptor(ordered, HEX_SIZE, '#A08060', 2, 10);
            if (desc && desc.path) {
                paths.push(
                    <g key={road.id}>
                        {/* Shadow / roadbed */}
                        <path
                            d={desc.path}
                            fill="none"
                            stroke="rgba(0,0,0,0.2)"
                            strokeWidth={desc.strokeWidth + 2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            transform="translate(0, 1)"
                        />
                        {/* Main road stroke */}
                        <path
                            d={desc.path}
                            fill="none"
                            stroke={desc.stroke}
                            strokeWidth={desc.strokeWidth}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="none"
                        />
                        {/* Dashed centerline for visual interest */}
                        <path
                            d={desc.path}
                            fill="none"
                            stroke="#C4A882"
                            strokeWidth={0.6}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="3 4"
                            opacity={0.5}
                        />
                    </g>
                );
            }
        }

        return paths;
    }, [roads]);

    if (!elements) return null;

    return (
        <g className="road-layer">
            {elements}
        </g>
    );
}

export default RoadLayer;
