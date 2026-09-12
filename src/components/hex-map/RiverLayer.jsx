import { useMemo } from 'react';
import { HEX_SIZE } from '../../config/outdoorConfig.js';
import { hexToPixel, hexNeighbors, orderHexPath, buildWindingPathDescriptor } from '../../services/maps/hexMapUtils.js';

function parseHexKey(key) {
    const [q, r] = key.split(',');
    return { q: Number(q), r: Number(r) };
}

function inBounds(n, hexCols, hexRows) {
    return n.q >= 0 && n.q < hexCols && n.r >= 0 && n.r < hexRows;
}

function buildRiverChains(rivers, hexCols, hexRows) {
    const riverSet = new Set(rivers);
    const visited = new Set();
    const chains = [];

    // Group into connected chains
    for (const key of rivers) {
        if (visited.has(key)) continue;
        const chain = [];
        const stack = [key];
        visited.add(key);
        while (stack.length > 0) {
            const cur = stack.pop();
            const { q, r } = parseHexKey(cur);
            chain.push({ q, r });
            for (const n of hexNeighbors(q, r)) {
                if (!inBounds(n, hexCols, hexRows)) continue;
                const nk = `${n.q},${n.r}`;
                if (riverSet.has(nk) && !visited.has(nk)) {
                    visited.add(nk);
                    stack.push(nk);
                }
            }
        }
        chains.push(chain);
    }

    return chains;
}

function buildRiverGraphics(chains) {
    const paths = [];
    const fills = [];

    // Build winding path for each chain plus circle fills for isolated hexes
    for (const chain of chains) {
        if (chain.length === 1) {
            // Isolated hex — just draw a circle fill
            const { q, r } = chain[0];
            const c = hexToPixel(q, r, HEX_SIZE);
            fills.push(
                <circle key={`fill-${q},${r}`} cx={c.x} cy={c.y} r={4} fill="rgba(60, 130, 210, 0.45)" />
            );
            continue;
        }

        const ordered = orderHexPath(chain);
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
        for (const h of chain) {
            const c = hexToPixel(h.q, h.r, HEX_SIZE);
            fills.push(
                <circle key={`fill-${h.q},${h.r}`} cx={c.x} cy={c.y} r={4} fill="rgba(60, 130, 210, 0.35)" />
            );
        }
    }

    return { paths, fills };
}

function RiverLayer({ rivers, hexCols, hexRows }) {
    const elements = useMemo(() => {
        if (!rivers || rivers.length === 0) return null;
        return buildRiverGraphics(buildRiverChains(rivers, hexCols, hexRows));
    }, [rivers, hexCols, hexRows]);

    if (!elements) return null;

    return (
        <g className="river-layer">
            {elements.paths}
            {elements.fills}
        </g>
    );
}

export default RiverLayer;
