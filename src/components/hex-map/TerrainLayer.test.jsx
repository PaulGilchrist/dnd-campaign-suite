// @maintained-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TerrainLayer from './TerrainLayer.jsx';
import { getAllHexes, hexToPixel, hexToSVGPath } from '../../services/maps/hexMapUtils.js';
import { HEX_SIZE, TERRAIN_TYPES, DEFAULT_TERRAIN } from '../../config/outdoorConfig.js';

// Oracle discipline: ZERO module mocks. Expected geometry is derived verbatim from the
// real converter (hexToPixel + hexToSVGPath at the HEX_SIZE this layer authors), which
// catches wrong args and non-verbatim passthrough. Converter internals are owned by
// hexMapUtils tests, grid geometry by HexGridLayer (#791), terrain paint STATE by the
// terrain hook (#805), and prop forwarding by the container (#793). This file owns
// TerrainLayer's rendered output only: one path per grid hex, verbatim `d` bytes, and
// fills = terrain-id→colour-map lookup held within the layer's deterministic ±5%
// per-position variation band of its base colour (exact golden byte pinned once).

const TERRAIN_FILLS = Object.fromEntries(TERRAIN_TYPES.map(t => [t.id, t.fill]));
const DEFAULT_FILL = TERRAIN_FILLS[DEFAULT_TERRAIN];

// The layer scales each base channel by (1 + variation) where |variation| <= 0.05.
const VARIATION_BAND = 0.05;

function hexChannels(hex) {
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

function expectFillWithinBand(fill, baseHex) {
    const match = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(fill);
    expect(match, `expected rgb() fill, got: ${fill}`).not.toBeNull();
    hexChannels(baseHex).forEach((base, i) => {
        const actual = Number(match[i + 1]);
        expect(actual).toBeGreaterThanOrEqual(Math.floor(base * (1 - VARIATION_BAND)));
        expect(actual).toBeLessThanOrEqual(Math.ceil(base * (1 + VARIATION_BAND)));
    });
}

function fillsOf(container) {
    return [...container.querySelectorAll('g.terrain-layer path')].map(p => p.getAttribute('fill'));
}

describe('TerrainLayer', () => {
    const renderLayer = (props) => render(<TerrainLayer {...props} />);

    it('renders one path per grid hex with verbatim converter geometry inside g.terrain-layer', () => {
        const { container } = renderLayer({ hexCols: 3, hexRows: 2, terrain: {} });
        const group = container.querySelector('g.terrain-layer');
        expect(group).toBeInTheDocument();

        const expectedHexes = getAllHexes(3, 2); // 1:1 wiring checked here; geometry owned by #791
        const paths = group.querySelectorAll('path');
        expect(paths).toHaveLength(expectedHexes.length);
        expect(paths).toHaveLength(6);
        paths.forEach((path, i) => {
            const { q, r } = expectedHexes[i];
            const center = hexToPixel(q, r, HEX_SIZE);
            expect(path.getAttribute('d')).toBe(hexToSVGPath(center.x, center.y, HEX_SIZE));
        });
    });

    it('renders an empty group when the grid has no hexes', () => {
        const { container } = renderLayer({ hexCols: 0, hexRows: 0, terrain: { '0,0': 'forest' } });
        expect(container.querySelector('g.terrain-layer')).toBeInTheDocument();
        expect(container.querySelectorAll('g.terrain-layer path')).toHaveLength(0);
    });

    it('paints every terrain id within its base colour band, falling back to default for missing and unknown ids', () => {
        const terrain = {};
        TERRAIN_TYPES.forEach((t, i) => {
            terrain[`${i},0`] = t.id;
        });
        const cols = TERRAIN_TYPES.length + 2; // last two hexes: missing id, unknown id
        const { container } = renderLayer({ hexCols: cols, hexRows: 1, terrain });

        const fills = fillsOf(container);
        expect(fills).toHaveLength(cols);
        // Golden byte once: hex (0,0) is deterministic — default base pinned exactly.
        expect(fills[0]).toBe('rgb(186,206,157)');
        TERRAIN_TYPES.forEach((t, i) => expectFillWithinBand(fills[i], t.fill));
        expectFillWithinBand(fills[cols - 2], DEFAULT_FILL); // no terrain key → default
        expectFillWithinBand(fills[cols - 1], DEFAULT_FILL); // 'lava' unknown id → default
    });

    it('is deterministic per position and repaints when the terrain reference changes', () => {
        const terrain = { '1,0': 'forest' };
        const { container, rerender } = renderLayer({ hexCols: 3, hexRows: 1, terrain });
        const first = fillsOf(container);
        expect(first).toHaveLength(3);
        expect(first[0]).not.toBe(first[2]); // same default terrain varies by hex position

        rerender(<TerrainLayer hexCols={3} hexRows={1} terrain={terrain} />);
        expect(fillsOf(container)).toEqual(first); // same props → byte-identical output

        rerender(<TerrainLayer hexCols={3} hexRows={1} terrain={{ '1,0': 'water' }} />);
        const after = fillsOf(container);
        expect(after[1]).not.toBe(first[1]);
        expectFillWithinBand(after[1], TERRAIN_FILLS.water);
        expect(after[0]).toBe(first[0]); // unpainted hexes keep their bytes
    });
});
