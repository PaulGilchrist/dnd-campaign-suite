import { useMemo } from 'react';
import { HEX_SIZE } from '../../config/outdoorConfig.js';
import { parseHexKey, buildWindingPathDescriptor } from '../../services/maps/hexMapUtils.js';

function RoadLayer({ roads }) {
    const elements = useMemo(() => {
        if (!roads || roads.length === 0) return null;

        const paths = [];

        for (const road of roads) {
            if (!road.hexes || road.hexes.length < 2) continue;

            const ordered = road.hexes.map(h => parseHexKey(h));
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
