// @cleaned-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TerrainLayer from './TerrainLayer.jsx';
import { getAllHexes, hexToPixel, hexToSVGPath } from '../../services/maps/hexMapUtils.js';

vi.mock('../../services/maps/hexMapUtils.js', () => ({
    getAllHexes: vi.fn(() => []),
    hexKey: vi.fn((q, r) => `${q},${r}`),
    hexToPixel: vi.fn(() => ({ x: 10, y: 20 })),
    hexToSVGPath: vi.fn(() => 'M10,20 l30,0'),
}));

describe('TerrainLayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render the terrain-layer group', () => {
            const { container } = render(
                <TerrainLayer hexCols={3} hexRows={2} terrain={{}} />
            );
            const g = container.querySelector('g.terrain-layer');
            expect(g).toBeInTheDocument();
        });

        it('should render one path element per hex cell', () => {
            const hexCols = 3;
            const hexRows = 2;
            const expectedCount = hexCols * hexRows;

            const hexes = [];
            for (let r = 0; r < hexRows; r++) {
                for (let q = 0; q < hexCols; q++) {
                    hexes.push({ q, r });
                }
            }
            vi.mocked(getAllHexes).mockReturnValue(hexes);

            const { container } = render(
                <TerrainLayer hexCols={hexCols} hexRows={hexRows} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(expectedCount);
        });

        it('should render no paths when hex grid is empty', () => {
            vi.mocked(getAllHexes).mockReturnValue([]);

            const { container } = render(
                <TerrainLayer hexCols={0} hexRows={5} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(0);
        });

        it('should render a single path for a 1x1 grid', () => {
            vi.mocked(getAllHexes).mockReturnValue([{ q: 0, r: 0 }]);

            const { container } = render(
                <TerrainLayer hexCols={1} hexRows={1} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(1);
        });

        it('should not crash with large grid dimensions', () => {
            const hexCols = 20;
            const hexRows = 15;
            const hexes = [];
            for (let r = 0; r < hexRows; r++) {
                for (let q = 0; q < hexCols; q++) {
                    hexes.push({ q, r });
                }
            }
            vi.mocked(getAllHexes).mockReturnValue(hexes);

            expect(() => {
                render(<TerrainLayer hexCols={hexCols} hexRows={hexRows} terrain={{}} />);
            }).not.toThrow();
        });

        it('should set required attributes on every path', () => {
            vi.mocked(getAllHexes).mockReturnValue([
                { q: 0, r: 0 }, { q: 1, r: 0 },
                { q: 0, r: 1 }, { q: 1, r: 1 },
            ]);

            const { container } = render(
                <TerrainLayer hexCols={2} hexRows={2} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            paths.forEach(path => {
                expect(path).toHaveAttribute('fill');
                expect(path).toHaveAttribute('d');
            });
        });

        it('should render all paths within the terrain-layer group', () => {
            vi.mocked(getAllHexes).mockReturnValue([
                { q: 0, r: 0 }, { q: 1, r: 0 },
                { q: 0, r: 1 }, { q: 1, r: 1 },
            ]);

            const { container } = render(
                <TerrainLayer hexCols={2} hexRows={2} terrain={{}} />
            );
            const layer = container.querySelector('g.terrain-layer');
            expect(layer).toBeInTheDocument();
            expect(layer.querySelectorAll('path').length).toBe(4);
        });

        it('should pass hex coordinates through to hexToPixel and hexToSVGPath', () => {
            vi.mocked(getAllHexes).mockReturnValue([
                { q: 2, r: 3 },
            ]);
            vi.mocked(hexToPixel).mockReturnValue({ x: 100, y: 200 });
            vi.mocked(hexToSVGPath).mockReturnValue('M100,200 l30,0');

            render(<TerrainLayer hexCols={1} hexRows={1} terrain={{}} />);

            expect(hexToPixel).toHaveBeenCalledWith(2, 3, expect.any(Number));
            expect(hexToSVGPath).toHaveBeenCalledWith(100, 200, expect.any(Number));
        });
    });

    describe('Terrain types', () => {
        it('should use default terrain when hex key is missing from terrain prop', () => {
            vi.mocked(getAllHexes).mockReturnValue([
                { q: 0, r: 0 }, { q: 1, r: 0 },
            ]);

            const { container } = render(
                <TerrainLayer hexCols={2} hexRows={1} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(2);
            // Both hexes use default plains terrain but have position-based variation
            const fills = [...paths].map(p => p.getAttribute('fill'));
            fills.forEach(fill => {
                expect(fill).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
            });
        });

        it('should use terrain from the terrain prop when key exists', () => {
            vi.mocked(getAllHexes).mockReturnValue([
                { q: 0, r: 0 }, { q: 1, r: 0 },
            ]);

            const { container } = render(
                <TerrainLayer hexCols={2} hexRows={1} terrain={{ '0,0': 'forest' }} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(2);
            // The '0,0' hex should have a different fill (forest) than '1,0' (default plains)
            const fills = [...paths].map(p => p.getAttribute('fill'));
            expect(fills[0]).not.toBe(fills[1]);
        });

        it('should apply different fills for each terrain type', () => {
            vi.mocked(getAllHexes).mockReturnValue([
                { q: 0, r: 0 }, { q: 1, r: 0 },
                { q: 2, r: 0 }, { q: 3, r: 0 },
            ]);

            const { container } = render(
                <TerrainLayer
                    hexCols={4}
                    hexRows={1}
                    terrain={{
                        '0,0': 'plains',
                        '1,0': 'forest',
                        '2,0': 'mountains',
                        '3,0': 'water',
                    }}
                />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(4);
            const fills = [...paths].map(p => p.getAttribute('fill'));
            // Each terrain type should produce a unique fill
            expect(new Set(fills).size).toBe(4);
        });

        it('should support all terrain types from config', () => {
            const terrainTypes = ['plains', 'hills', 'forest', 'mountains', 'desert', 'swamp', 'tundra', 'water', 'beach'];
            vi.mocked(getAllHexes).mockReturnValue(
                terrainTypes.map((_, i) => ({ q: i, r: 0 }))
            );

            const terrain = {};
            terrainTypes.forEach((type, i) => {
                terrain[`${i},0`] = type;
            });

            const { container } = render(
                <TerrainLayer hexCols={terrainTypes.length} hexRows={1} terrain={terrain} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(terrainTypes.length);
            paths.forEach(path => {
                const fill = path.getAttribute('fill');
                expect(fill).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
            });
        });

        it('should handle partial terrain entries with defaults for missing keys', () => {
            vi.mocked(getAllHexes).mockReturnValue([
                { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 },
                { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 },
            ]);

            const { container } = render(
                <TerrainLayer
                    hexCols={3}
                    hexRows={2}
                    terrain={{ '0,0': 'forest', '1,1': 'mountains' }}
                />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(6);
            const fills = [...paths].map(p => p.getAttribute('fill'));
            // All fills should be valid rgb
            fills.forEach(fill => {
                expect(fill).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
            });
            // Explicitly set terrain should differ from defaults
            expect(fills[0]).not.toBe(fills[1]);
        });
    });

    describe('Variation', () => {
        it('should apply a fill variation per hex position', () => {
            vi.mocked(getAllHexes).mockReturnValue([
                { q: 0, r: 0 }, { q: 1, r: 0 },
                { q: 2, r: 0 }, { q: 3, r: 0 },
            ]);

            const { container } = render(
                <TerrainLayer
                    hexCols={4}
                    hexRows={1}
                    terrain={{ '0,0': 'plains', '1,0': 'plains', '2,0': 'plains', '3,0': 'plains' }}
                />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(4);
            const fills = [...paths].map(p => p.getAttribute('fill'));
            // Same terrain at different positions should produce different fills due to hex variation
            expect(fills[0]).not.toBe(fills[1]);
            expect(fills[2]).not.toBe(fills[3]);
        });

        it('should keep fill values within valid rgb range', () => {
            vi.mocked(getAllHexes).mockReturnValue([
                { q: 0, r: 0 }, { q: 1, r: 0 },
                { q: 0, r: 1 }, { q: 1, r: 1 },
                { q: 2, r: 2 },
            ]);

            const { container } = render(
                <TerrainLayer hexCols={5} hexRows={5} terrain={{ '0,0': 'plains' }} />
            );
            const paths = container.querySelectorAll('path');
            paths.forEach(path => {
                const fill = path.getAttribute('fill');
                const match = fill.match(/rgb\((\d+),(\d+),(\d+)\)/);
                expect(match).not.toBeNull();
                const r = Number(match[1]);
                const g = Number(match[2]);
                const b = Number(match[3]);
                expect(r).toBeGreaterThanOrEqual(0);
                expect(r).toBeLessThanOrEqual(255);
                expect(g).toBeGreaterThanOrEqual(0);
                expect(g).toBeLessThanOrEqual(255);
                expect(b).toBeGreaterThanOrEqual(0);
                expect(b).toBeLessThanOrEqual(255);
            });
        });
    });

    describe('Memoization', () => {
        it('should regenerate paths when grid dimensions change', () => {
            vi.mocked(getAllHexes).mockImplementation((cols, rows) => {
                const hexes = [];
                for (let r = 0; r < rows; r++) {
                    for (let q = 0; q < cols; q++) {
                        hexes.push({ q, r });
                    }
                }
                return hexes;
            });

            const { container: c1 } = render(<TerrainLayer hexCols={2} hexRows={2} terrain={{}} />);
            const paths1 = c1.querySelectorAll('path');
            const { container: c2 } = render(<TerrainLayer hexCols={4} hexRows={4} terrain={{}} />);
            const paths2 = c2.querySelectorAll('path');
            expect(paths1.length).toBe(4);
            expect(paths2.length).toBe(16);
        });

        it('should regenerate paths when terrain changes', () => {
            vi.mocked(getAllHexes).mockReturnValue([
                { q: 0, r: 0 }, { q: 1, r: 0 },
            ]);

            const { container: c1 } = render(
                <TerrainLayer hexCols={2} hexRows={1} terrain={{ '0,0': 'plains' }} />
            );
            const paths1 = c1.querySelectorAll('path');
            const { container: c2 } = render(
                <TerrainLayer hexCols={2} hexRows={1} terrain={{ '0,0': 'forest' }} />
            );
            const paths2 = c2.querySelectorAll('path');
            expect(paths1.length).toBe(2);
            expect(paths2.length).toBe(2);
            expect(paths1[0].getAttribute('fill')).not.toBe(paths2[0].getAttribute('fill'));
        });
    });
});
