import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TerrainLayer from './TerrainLayer.jsx';
import { getAllHexes } from '../../services/maps/hexMapUtils.js';
import { TERRAIN_TYPES, DEFAULT_TERRAIN } from '../../config/outdoorConfig.js';

vi.mock('../../services/maps/hexMapUtils.js', () => ({
    getAllHexes: vi.fn(() => []),
    hexKey: vi.fn((q, r) => `${q},${r}`),
    hexToPixel: vi.fn(() => ({ x: 10, y: 20 })),
    hexToSVGPath: vi.fn(() => 'M10,20 l30,0'),
}));

const TERRAIN_FILLS = Object.fromEntries(TERRAIN_TYPES.map(t => [t.id, t.fill]));
const DEFAULT_FILL = TERRAIN_FILLS[DEFAULT_TERRAIN];

function makeHexes(hexCols, hexRows) {
    const hexes = [];
    for (let r = 0; r < hexRows; r++) {
        for (let q = 0; q < hexCols; q++) {
            hexes.push({ q, r });
        }
    }
    return hexes;
}

function getPaths(container) {
    return container.querySelectorAll('path');
}

function getFills(container) {
    return [...getPaths(container)].map(path => path.getAttribute('fill'));
}

function parseRgb(fill) {
    const match = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(fill);
    if (!match) {
        throw new Error(`Unexpected fill format: ${fill}`);
    }
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function hexToRgb(hex) {
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
    };
}

function expectFillNear(fill, baseHex) {
    const base = hexToRgb(baseHex);
    const actual = parseRgb(fill);
    const deviation = channel => Math.ceil(channel * 0.05) + 1;
    expect(actual.r).toBeGreaterThanOrEqual(base.r - deviation(base.r));
    expect(actual.r).toBeLessThanOrEqual(base.r + deviation(base.r));
    expect(actual.g).toBeGreaterThanOrEqual(base.g - deviation(base.g));
    expect(actual.g).toBeLessThanOrEqual(base.g + deviation(base.g));
    expect(actual.b).toBeGreaterThanOrEqual(base.b - deviation(base.b));
    expect(actual.b).toBeLessThanOrEqual(base.b + deviation(base.b));
}

describe('TerrainLayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render the terrain-layer group', () => {
            const { container } = render(<TerrainLayer hexCols={3} hexRows={2} terrain={{}} />);
            expect(container.querySelector('g.terrain-layer')).toBeInTheDocument();
        });

        it.each`
            hexCols | hexRows | expectedPaths
            ${0}    | ${3}    | ${0}
            ${3}    | ${0}    | ${0}
            ${0}    | ${0}    | ${0}
            ${1}    | ${1}    | ${1}
            ${3}    | ${2}    | ${6}
            ${5}    | ${4}    | ${20}
        `('should render one path per hex ($expectedPaths paths for $hexCols x $hexRows grid)', ({ hexCols, hexRows, expectedPaths }) => {
            vi.mocked(getAllHexes).mockReturnValue(makeHexes(hexCols, hexRows));
            const { container } = render(
                <TerrainLayer hexCols={hexCols} hexRows={hexRows} terrain={{}} />
            );
            expect(getPaths(container)).toHaveLength(expectedPaths);
        });

        it('should render every path inside the terrain-layer group with fill and d attributes', () => {
            vi.mocked(getAllHexes).mockReturnValue(makeHexes(2, 2));
            const { container } = render(<TerrainLayer hexCols={2} hexRows={2} terrain={{}} />);
            const paths = getPaths(container);
            expect(paths.length).toBeGreaterThan(0);
            paths.forEach(path => {
                expect(path).toHaveAttribute('fill');
                expect(path).toHaveAttribute('d');
            });
        });

    });

    describe('Terrain colors', () => {
        it('should apply the default terrain fill to hexes missing from the terrain prop', () => {
            vi.mocked(getAllHexes).mockReturnValue(makeHexes(2, 1));
            const { container } = render(<TerrainLayer hexCols={2} hexRows={1} terrain={{}} />);
            const fills = getFills(container);
            expect(fills).toHaveLength(2);
            fills.forEach(fill => expectFillNear(fill, DEFAULT_FILL));
        });

        it('should color each hex from the terrain prop', () => {
            vi.mocked(getAllHexes).mockReturnValue(makeHexes(3, 1));
            const { container } = render(
                <TerrainLayer
                    hexCols={3}
                    hexRows={1}
                    terrain={{ '0,0': 'forest', '1,0': 'plains', '2,0': 'water' }}
                />
            );
            const fills = getFills(container);
            expect(fills).toHaveLength(3);
            expectFillNear(fills[0], TERRAIN_FILLS.forest);
            expectFillNear(fills[1], TERRAIN_FILLS.plains);
            expectFillNear(fills[2], TERRAIN_FILLS.water);
        });

        it('should apply a distinct base color for every terrain type', () => {
            const ids = TERRAIN_TYPES.map(t => t.id);
            vi.mocked(getAllHexes).mockReturnValue(makeHexes(ids.length, 1));
            const terrain = {};
            ids.forEach((id, i) => {
                terrain[`${i},0`] = id;
            });

            const { container } = render(
                <TerrainLayer hexCols={ids.length} hexRows={1} terrain={terrain} />
            );
            const fills = getFills(container);
            expect(fills).toHaveLength(ids.length);
            fills.forEach((fill, i) => {
                expectFillNear(fill, TERRAIN_FILLS[ids[i]]);
            });
        });

        it('should fall back to the default terrain for unknown terrain ids', () => {
            vi.mocked(getAllHexes).mockReturnValue(makeHexes(1, 1));
            const { container } = render(
                <TerrainLayer hexCols={1} hexRows={1} terrain={{ '0,0': 'lava' }} />
            );
            expectFillNear(getFills(container)[0], DEFAULT_FILL);
        });
    });

    describe('Variation', () => {
        it('should vary the fill by hex position within the terrain base color', () => {
            vi.mocked(getAllHexes).mockReturnValue(makeHexes(4, 1));
            const { container } = render(<TerrainLayer hexCols={4} hexRows={1} terrain={{}} />);
            const fills = getFills(container);
            expect(fills).toHaveLength(4);
            fills.forEach(fill => expectFillNear(fill, DEFAULT_FILL));
            expect(fills[0]).not.toBe(fills[1]);
        });

        it('should produce the same fill for the same hex across renders', () => {
            vi.mocked(getAllHexes).mockReturnValue(makeHexes(2, 2));
            const terrain = {};
            const { container, rerender } = render(
                <TerrainLayer hexCols={2} hexRows={2} terrain={terrain} />
            );
            const first = getFills(container);
            rerender(<TerrainLayer hexCols={2} hexRows={2} terrain={terrain} />);
            expect(getFills(container)).toEqual(first);
        });

    });

    describe('Updates', () => {
        it('should re-render the correct number of paths when grid dimensions change', () => {
            vi.mocked(getAllHexes).mockImplementation((cols, rows) => makeHexes(cols, rows));
            const { container, rerender } = render(
                <TerrainLayer hexCols={2} hexRows={2} terrain={{}} />
            );
            expect(getPaths(container)).toHaveLength(4);

            rerender(<TerrainLayer hexCols={3} hexRows={3} terrain={{}} />);
            expect(getPaths(container)).toHaveLength(9);
        });

        it('should recompute hexes when the terrain reference changes', () => {
            vi.mocked(getAllHexes).mockReturnValue(makeHexes(2, 1));
            const { container, rerender } = render(
                <TerrainLayer hexCols={2} hexRows={1} terrain={{ '0,0': 'plains' }} />
            );
            const before = getFills(container);

            rerender(<TerrainLayer hexCols={2} hexRows={1} terrain={{ '0,0': 'forest' }} />);
            const after = getFills(container);

            expect(after[0]).not.toBe(before[0]);
            expectFillNear(after[0], TERRAIN_FILLS.forest);
            expect(getAllHexes).toHaveBeenCalledTimes(2);
        });

        it('should not recompute hexes when props are unchanged', () => {
            vi.mocked(getAllHexes).mockReturnValue(makeHexes(1, 1));
            const terrain = {};
            const { rerender } = render(<TerrainLayer hexCols={1} hexRows={1} terrain={terrain} />);
            expect(getAllHexes).toHaveBeenCalledTimes(1);

            rerender(<TerrainLayer hexCols={1} hexRows={1} terrain={terrain} />);
            expect(getAllHexes).toHaveBeenCalledTimes(1);
        });
    });
});
