import { useMemo } from 'react';
import { HEX_SIZE } from '../../config/outdoorConfig.js';
import { hexToPixel, hexNeighbors, orderHexPath, buildWindingPathDescriptor } from '../../services/hexMapUtils.js';

function parseHexKey(key) {
    const [q, r] = key.split(',');
    return { q: Number(q), r: Number(r) };
}

function RiverLayer({ rivers, gridSize }) {
    const elements = useMemo(() => {
        if (!rivers || rivers.length === 0) return null;

        const riverSet = new Set(rivers);
        const visited = new Set();
        const segments = [];

        // Group into connected chains
        for (const key of rivers) {
            if (visited.has(key)) continue;
            const segment = [];
            const stack = [key];
            visited.add(key);
            while (stack.length > 0) {
                const cur = stack.pop();
                const { q, r } = parseHexKey(cur);
                segment.push({ q, r });
                for (const n of hexNeighbors(q, r)) {
                    if (n.q < 0 || n.q >= gridSize || n.r < 0 || n.r >= gridSize) continue;
                    const nk = `${n.q},${n.r}`;
                    if (riverSet.has(nk) && !visited.has(nk)) {
                        visited.add(nk);
                        stack.push(nk);
                    }
                }
            }
            segments.push(segment);
        }

        // Build winding path for each segment plus circle fills for isolated hexes
        const paths = [];
        const fills = [];

        for (const segment of segments) {
            if (segment.length === 1) {
                // Isolated hex — just draw a circle fill
                const { q, r } = segment[0];
                const c = hexToPixel(q, r, HEX_SIZE);
                fills.push(
                    <circle key={`fill-${q},${r}`} cx={c.x} cy={c.y} r={4} fill="rgba(60, 130, 210, 0.45)" />
                );
                continue;
            }

            const ordered = orderHexPath(segment);
            const desc = buildWindingPathDescriptor(ordered, HEX_SIZE, '#3A82D2', 2.5, 12);
            if (desc && desc.path) {
                paths.push(
                    <path
                        key={`river-${ordered[0].q},${ordered[0].r}`}
                        d={desc.path}
                        fill="none"
                        stroke={desc.stroke}
                        strokeWidth={desc.strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                );
            }

            // Soft fill under each river hex
            for (const h of segment) {
                const c = hexToPixel(h.q, h.r, HEX_SIZE);
                fills.push(
                    <circle key={`fill-${h.q},${h.r}`} cx={c.x} cy={c.y} r={4} fill="rgba(60, 130, 210, 0.35)" />
                );
            }
        }

        return { paths, fills };
    }, [rivers, gridSize]);

    if (!elements) return null;

    return (
        <g className="river-layer">
            {elements.paths}
            {elements.fills}
        </g>
    );
}

export default RiverLayer;
