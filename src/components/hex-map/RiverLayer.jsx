import React, { useMemo } from 'react';
import { HEX_SIZE } from '../../config/outdoorConfig.js';
import { hexToPixel, hexNeighbors } from '../../services/hexMapUtils.js';

function parseHexKey(key) {
    const [q, r] = key.split(',');
    return { q: Number(q), r: Number(r) };
}

function RiverLayer({ rivers, gridSize }) {
    const elements = useMemo(() => {
        if (!rivers || rivers.length === 0) return { fills: [], lines: [] };

        const riverSet = new Set(rivers);
        const fills = [];
        const lineSegments = [];

        for (const key of rivers) {
            const { q, r } = parseHexKey(key);
            const center = hexToPixel(q, r, HEX_SIZE);

            fills.push(
                <path
                    key={`fill-${key}`}
                    d={`M${center.x - 4},${center.y} A4,4 0 1,0 ${center.x + 4},${center.y} A4,4 0 1,0 ${center.x - 4},${center.y}`}
                    fill="rgba(60, 130, 210, 0.35)"
                />
            );

            const neighbors = hexNeighbors(q, r);
            for (const n of neighbors) {
                if (n.q < 0 || n.q >= gridSize || n.r < 0 || n.r >= gridSize) continue;
                const nk = `${n.q},${n.r}`;
                if (!riverSet.has(nk)) continue;
                if (nk < key) continue;
                const nc = hexToPixel(n.q, n.r, HEX_SIZE);
                lineSegments.push(`M${center.x},${center.y}L${nc.x},${nc.y}`);
            }
        }

        return {
            fills,
            lines: lineSegments.length > 0
                ? <path d={lineSegments.join('')} fill="none" stroke="#3A82D2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                : null,
        };
    }, [rivers, gridSize]);

    if (!rivers || rivers.length === 0) return null;

    return (
        <g className="river-layer">
            {elements.fills}
            {elements.lines}
        </g>
    );
}

export default RiverLayer;
