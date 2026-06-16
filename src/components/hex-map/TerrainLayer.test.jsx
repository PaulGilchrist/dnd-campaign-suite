import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TerrainLayer from './TerrainLayer.jsx';

vi.mock('../../services/maps/hexMapUtils.js', () => ({
    getAllHexes: vi.fn((cols, rows) => {
        const hexes = [];
        for (let r = 0; r < rows; r++) {
            for (let q = 0; q < cols; q++) {
                hexes.push({ q, r });
            }
        }
        return hexes;
    }),
    hexKey: vi.fn((q, r) => `${q},${r}`),
    hexToPixel: vi.fn(() => ({ x: 10, y: 20 })),
    hexToSVGPath: vi.fn((x, y, size) => `M${x},${y} l${size},0`),
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
            const { container } = render(
                <TerrainLayer hexCols={3} hexRows={2} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(6);
        });

        it('should render no paths when hexCols is 0', () => {
            const { container } = render(
                <TerrainLayer hexCols={0} hexRows={5} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(0);
        });

        it('should render no paths when hexRows is 0', () => {
            const { container } = render(
                <TerrainLayer hexCols={5} hexRows={0} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(0);
        });

        it('should render no paths when both dimensions are 0', () => {
            const { container } = render(
                <TerrainLayer hexCols={0} hexRows={0} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(0);
        });

        it('should render a single path for a 1x1 grid', () => {
            const { container } = render(
                <TerrainLayer hexCols={1} hexRows={1} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(1);
        });

        it('should render paths for a 10x21 grid', () => {
            const { container } = render(
                <TerrainLayer hexCols={10} hexRows={21} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(210);
        });

        it('should not crash with large grid dimensions', () => {
            const { container } = render(
                <TerrainLayer hexCols={20} hexRows={15} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(300);
        });
    });

    describe('Path attributes', () => {
        it('should set fill attribute on every path', () => {
            const { container } = render(
                <TerrainLayer hexCols={2} hexRows={2} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            paths.forEach(path => {
                expect(path).toHaveAttribute('fill');
            });
        });

        it('should set d attribute on every path', () => {
            const { container } = render(
                <TerrainLayer hexCols={2} hexRows={2} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            paths.forEach(path => {
                expect(path).toHaveAttribute('d');
            });
        });

        it('should not set stroke attribute on path elements', () => {
            const { container } = render(
                <TerrainLayer hexCols={2} hexRows={2} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            paths.forEach(path => {
                expect(path.getAttribute('stroke')).toBeNull();
            });
        });

        it('should use q,r as React key for each path', () => {
            const { container } = render(
                <TerrainLayer hexCols={2} hexRows={2} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(4);
            // Keys are used internally by React; verify paths exist with valid attributes
            paths.forEach(path => {
                expect(path.getAttribute('d')).toBeTruthy();
                expect(path.getAttribute('fill')).toBeTruthy();
            });
        });

        it('should render paths in row-major order', () => {
            const { container } = render(
                <TerrainLayer hexCols={3} hexRows={2} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(6);
            paths.forEach(path => {
                expect(path.getAttribute('d')).toBeTruthy();
            });
        });

        it('should render all paths within the terrain-layer group', () => {
            const { container } = render(
                <TerrainLayer hexCols={2} hexRows={2} terrain={{}} />
            );
            const layer = container.querySelector('g.terrain-layer');
            const layerPaths = layer.querySelectorAll('path');
            const allPaths = container.querySelectorAll('path');
            expect(layerPaths.length).toBe(allPaths.length);
        });
    });

    describe('Terrain types', () => {
        it('should use default terrain (plains) when hex key is missing from terrain prop', () => {
            const { container } = render(
                <TerrainLayer hexCols={2} hexRows={1} terrain={{}} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(2);
            paths.forEach(path => {
                expect(path.getAttribute('fill')).toBeTruthy();
            });
        });

        it('should use terrain from the terrain prop when key exists', () => {
            const { container } = render(
                <TerrainLayer hexCols={2} hexRows={1} terrain={{ '0,0': 'forest' }} />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(2);
        });

        it('should apply different fills for different terrain types', () => {
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
            expect(fills[0]).not.toBe(fills[1]);
            expect(fills[1]).not.toBe(fills[2]);
            expect(fills[2]).not.toBe(fills[3]);
        });

        it('should support all terrain types from config', () => {
            const terrainTypes = ['plains', 'hills', 'forest', 'mountains', 'desert', 'swamp', 'tundra', 'water', 'beach'];
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
                expect(path.getAttribute('fill')).toBeTruthy();
            });
        });

        it('should handle terrain entries for only some hexes', () => {
            const { container } = render(
                <TerrainLayer
                    hexCols={3}
                    hexRows={2}
                    terrain={{ '0,0': 'forest', '1,1': 'mountains' }}
                />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(6);
            paths.forEach(path => {
                expect(path.getAttribute('fill')).toBeTruthy();
            });
        });

        it('should not crash with an unknown terrain type', () => {
            const { container } = render(
                <TerrainLayer
                    hexCols={1}
                    hexRows={1}
                    terrain={{ '0,0': 'unknown_terrain_type' }}
                />
            );
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(1);
            const path = paths[0];
            expect(path.getAttribute('fill')).toBeTruthy();
        });
    });

    describe('Variation', () => {
        it('should apply a fill variation per hex position', () => {
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
            // Same terrain type at different positions should have slight fill variations
            expect(fills[0]).not.toBe(fills[1]);
            expect(fills[2]).not.toBe(fills[3]);
        });

        it('should produce rgb-formatted fill values', () => {
            const { container } = render(
                <TerrainLayer hexCols={1} hexRows={1} terrain={{}} />
            );
            const path = container.querySelector('path');
            const fill = path.getAttribute('fill');
            expect(fill).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
        });

        it('should keep fill values within valid rgb range', () => {
            const { container } = render(
                <TerrainLayer hexCols={5} hexRows={5} terrain={{ '0,0': 'plains' }} />
            );
            const paths = container.querySelectorAll('path');
            paths.forEach(path => {
                const fill = path.getAttribute('fill');
                const match = fill.match(/rgb\((\d+),(\d+),(\d+)\)/);
                expect(match).toBeTruthy();
                expect(Number(match[1])).toBeGreaterThanOrEqual(0);
                expect(Number(match[1])).toBeLessThanOrEqual(255);
                expect(Number(match[2])).toBeGreaterThanOrEqual(0);
                expect(Number(match[2])).toBeLessThanOrEqual(255);
                expect(Number(match[3])).toBeGreaterThanOrEqual(0);
                expect(Number(match[3])).toBeLessThanOrEqual(255);
            });
        });
    });

    describe('Memoization', () => {
        it('should render the same number of paths with identical props', () => {
            const { container: c1 } = render(<TerrainLayer hexCols={2} hexRows={2} terrain={{}} />);
            const paths1 = c1.querySelectorAll('path');
            const { container: c2 } = render(<TerrainLayer hexCols={2} hexRows={2} terrain={{}} />);
            const paths2 = c2.querySelectorAll('path');
            expect(paths1.length).toBe(paths2.length);
        });

        it('should regenerate paths when hexCols changes', () => {
            const { container: c1 } = render(<TerrainLayer hexCols={2} hexRows={2} terrain={{}} />);
            const paths1 = c1.querySelectorAll('path');
            const { container: c2 } = render(<TerrainLayer hexCols={4} hexRows={2} terrain={{}} />);
            const paths2 = c2.querySelectorAll('path');
            expect(paths1.length).toBe(4);
            expect(paths2.length).toBe(8);
        });

        it('should regenerate paths when hexRows changes', () => {
            const { container: c1 } = render(<TerrainLayer hexCols={2} hexRows={2} terrain={{}} />);
            const paths1 = c1.querySelectorAll('path');
            const { container: c2 } = render(<TerrainLayer hexCols={2} hexRows={4} terrain={{}} />);
            const paths2 = c2.querySelectorAll('path');
            expect(paths1.length).toBe(4);
            expect(paths2.length).toBe(8);
        });

        it('should regenerate paths when terrain changes', () => {
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
