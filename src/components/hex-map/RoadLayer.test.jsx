// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RoadLayer from './RoadLayer.jsx';

vi.mock('../../config/outdoorConfig.js', () => ({
    HEX_SIZE: 30,
}));

vi.mock('../../services/maps/hexMapUtils.js', () => ({
    parseHexKey: vi.fn((key) => {
        const [q, r] = key.split(',').map(Number);
        return { q, r };
    }),
    buildWindingPathDescriptor: vi.fn(() => ({
        path: 'M0,0 Q15,10 30,0',
        stroke: '#A08060',
        strokeWidth: 2,
    })),
}));

import { parseHexKey, buildWindingPathDescriptor } from '../../services/maps/hexMapUtils.js';

describe('RoadLayer', () => {
    let roads;

    beforeEach(() => {
        vi.clearAllMocks();
        roads = [
            { id: 'road-1', hexes: ['0,0', '1,0', '2,0'] },
            { id: 'road-2', hexes: ['3,0', '4,0', '5,0'] },
        ];
    });

    const renderLayer = (layerProps) => {
        return render(<RoadLayer {...layerProps} />);
    };

    describe('rendering', () => {
        it('should render the road-layer group', () => {
            const { container } = renderLayer({ roads });
            const layer = container.querySelector('g.road-layer');
            expect(layer).toBeInTheDocument();
        });

        it('should render null when roads is null', () => {
            const { container } = renderLayer({ roads: null });
            expect(container.firstChild).toBeNull();
        });

        it('should render null when roads is undefined', () => {
            const { container } = renderLayer({ roads: undefined });
            expect(container.firstChild).toBeNull();
        });

        it('should render null when roads is empty', () => {
            const { container } = renderLayer({ roads: [] });
            expect(container.firstChild).toBeNull();
        });

        it('should render a group per valid road', () => {
            const { container } = renderLayer({ roads });
            const layer = container.querySelector('g.road-layer');
            const groups = layer.querySelectorAll(':scope > g');
            expect(groups.length).toBe(2);
        });

        it('should render three path elements per road group', () => {
            const { container } = renderLayer({ roads });
            const layer = container.querySelector('g.road-layer');
            const roadGroups = layer.querySelectorAll(':scope > g');
            roadGroups.forEach(group => {
                const paths = group.querySelectorAll('path');
                expect(paths.length).toBe(3);
            });
        });

        it('should render only the road-layer group (no extra wrapper groups)', () => {
            const { container } = renderLayer({ roads });
            const allGroups = container.querySelectorAll('g');
            expect(allGroups.length).toBe(3); // road-layer + 2 road groups
        });
    });

    describe('filtering invalid roads', () => {
        it('should skip roads with fewer than 2 hexes', () => {
            const shortRoads = [{ id: 'road-short', hexes: ['0,0'] }];
            const { container } = renderLayer({ roads: shortRoads });
            const layer = container.querySelector('g.road-layer');
            const groups = layer.querySelectorAll(':scope > g');
            expect(groups.length).toBe(0);
        });

        it('should skip roads with no hexes property', () => {
            const badRoads = [{ id: 'road-no-hexes' }];
            const { container } = renderLayer({ roads: badRoads });
            const layer = container.querySelector('g.road-layer');
            const groups = layer.querySelectorAll(':scope > g');
            expect(groups.length).toBe(0);
        });

        it('should skip roads with null hexes', () => {
            const nullHexes = [{ id: 'road-null', hexes: null }];
            const { container } = renderLayer({ roads: nullHexes });
            const layer = container.querySelector('g.road-layer');
            const groups = layer.querySelectorAll(':scope > g');
            expect(groups.length).toBe(0);
        });

        it('should skip roads with undefined hexes', () => {
            const undefHexes = [{ id: 'road-undef', hexes: undefined }];
            const { container } = renderLayer({ roads: undefHexes });
            const layer = container.querySelector('g.road-layer');
            const groups = layer.querySelectorAll(':scope > g');
            expect(groups.length).toBe(0);
        });

        it('should render only valid road groups when one road returns no path', () => {
            vi.mocked(buildWindingPathDescriptor).mockImplementationOnce(() => null).mockImplementation(() => ({
                path: 'M0,0 Q15,10 30,0',
                stroke: '#A08060',
                strokeWidth: 2,
            }));
            const mixedRoads = [
                { id: 'road-bad', hexes: ['0,0', '1,0'] },
                { id: 'road-good', hexes: ['2,0', '3,0'] },
            ];
            const { container } = renderLayer({ roads: mixedRoads });
            const layer = container.querySelector('g.road-layer');
            const groups = layer.querySelectorAll(':scope > g');
            expect(groups.length).toBe(1);
        });

        it('should render only valid road groups when one road has an empty path', () => {
            vi.mocked(buildWindingPathDescriptor).mockImplementationOnce(() => ({ path: '' })).mockImplementation(() => ({
                path: 'M0,0 Q15,10 30,0',
                stroke: '#A08060',
                strokeWidth: 2,
            }));
            const mixedRoads = [
                { id: 'road-empty', hexes: ['0,0', '1,0'] },
                { id: 'road-good', hexes: ['2,0', '3,0'] },
            ];
            const { container } = renderLayer({ roads: mixedRoads });
            const layer = container.querySelector('g.road-layer');
            const groups = layer.querySelectorAll(':scope > g');
            expect(groups.length).toBe(1);
        });

        it('should handle a mix of valid and invalid roads', () => {
            const mixedRoads = [
                { id: 'road-short', hexes: ['0,0'] },
                { id: 'road-good', hexes: ['1,0', '2,0'] },
                { id: 'road-no-hexes' },
                { id: 'road-also-good', hexes: ['3,0', '4,0'] },
            ];
            const { container } = renderLayer({ roads: mixedRoads });
            const layer = container.querySelector('g.road-layer');
            const groups = layer.querySelectorAll(':scope > g');
            expect(groups.length).toBe(2);
        });
    });

    describe('utility calls', () => {
        it('should call parseHexKey for each hex in every valid road', () => {
            renderLayer({ roads });
            expect(parseHexKey).toHaveBeenCalledWith('0,0');
            expect(parseHexKey).toHaveBeenCalledWith('1,0');
            expect(parseHexKey).toHaveBeenCalledWith('2,0');
            expect(parseHexKey).toHaveBeenCalledWith('3,0');
            expect(parseHexKey).toHaveBeenCalledWith('4,0');
            expect(parseHexKey).toHaveBeenCalledWith('5,0');
        });

        it('should not call parseHexKey for roads with fewer than 2 hexes', () => {
            const shortRoads = [{ id: 'road-short', hexes: ['0,0'] }];
            renderLayer({ roads: shortRoads });
            expect(parseHexKey).not.toHaveBeenCalled();
        });

        it('should call buildWindingPathDescriptor once per valid road', () => {
            renderLayer({ roads });
            expect(buildWindingPathDescriptor).toHaveBeenCalledTimes(2);
        });

        it('should not call buildWindingPathDescriptor for invalid roads', () => {
            const shortRoads = [{ id: 'road-short', hexes: ['0,0'] }];
            renderLayer({ roads: shortRoads });
            expect(buildWindingPathDescriptor).not.toHaveBeenCalled();
        });
    });

    describe('shadow path (roadbed)', () => {
        it('should render shadow path with translate(0, 1) transform', () => {
            const { container } = renderLayer({ roads });
            const shadowPaths = container.querySelectorAll('path[transform="translate(0, 1)"]');
            expect(shadowPaths.length).toBe(2);
        });

        it('should render shadow path with black semi-transparent stroke', () => {
            const { container } = renderLayer({ roads });
            const shadowPaths = container.querySelectorAll('path[stroke="rgba(0,0,0,0.2)"]');
            expect(shadowPaths.length).toBe(2);
        });

        it('should render shadow path with strokeWidth + 2 over base', () => {
            const { container } = renderLayer({ roads });
            const shadowPaths = container.querySelectorAll('path[stroke="rgba(0,0,0,0.2)"]');
            shadowPaths.forEach(path => {
                expect(path.getAttribute('stroke-width')).toBe('4');
            });
        });
    });

    describe('main road path', () => {
        it('should render main road path with correct stroke color', () => {
            const { container } = renderLayer({ roads });
            const mainPaths = container.querySelectorAll('path[stroke="#A08060"]');
            expect(mainPaths.length).toBe(2);
        });

        it('should render main road path without transform', () => {
            const { container } = renderLayer({ roads });
            const mainPaths = container.querySelectorAll('path[stroke="#A08060"]');
            mainPaths.forEach(path => {
                expect(path.hasAttribute('transform')).toBe(false);
            });
        });

        it('should render main road path with strokeDasharray none', () => {
            const { container } = renderLayer({ roads });
            const mainPaths = container.querySelectorAll('path[stroke-dasharray="none"]');
            expect(mainPaths.length).toBe(2);
        });

        it('should render main road path with strokeWidth 2', () => {
            const { container } = renderLayer({ roads });
            const mainPaths = container.querySelectorAll('path[stroke="#A08060"]');
            mainPaths.forEach(path => {
                expect(path.getAttribute('stroke-width')).toBe('2');
            });
        });
    });

    describe('dashed centerline', () => {
        it('should render dashed centerline path', () => {
            const { container } = renderLayer({ roads });
            const centerlines = container.querySelectorAll('path[stroke-dasharray="3 4"]');
            expect(centerlines.length).toBe(2);
        });

        it('should render dashed centerline with correct color', () => {
            const { container } = renderLayer({ roads });
            const centerlines = container.querySelectorAll('path[stroke="#C4A882"]');
            expect(centerlines.length).toBe(2);
        });

        it('should render dashed centerline with opacity 0.5', () => {
            const { container } = renderLayer({ roads });
            const centerlines = container.querySelectorAll('path[opacity="0.5"]');
            expect(centerlines.length).toBe(2);
        });

        it('should render dashed centerline with strokeWidth 0.6', () => {
            const { container } = renderLayer({ roads });
            const centerlines = container.querySelectorAll('path[stroke-width="0.6"]');
            expect(centerlines.length).toBe(2);
        });
    });

    describe('shared path attributes', () => {
        it('should render all paths with strokeLinecap round', () => {
            const { container } = renderLayer({ roads });
            const allPaths = container.querySelectorAll('path');
            allPaths.forEach(path => {
                expect(path.getAttribute('stroke-linecap')).toBe('round');
            });
        });

        it('should render all paths with strokeLinejoin round', () => {
            const { container } = renderLayer({ roads });
            const allPaths = container.querySelectorAll('path');
            allPaths.forEach(path => {
                expect(path.getAttribute('stroke-linejoin')).toBe('round');
            });
        });

        it('should render all paths with fill none', () => {
            const { container } = renderLayer({ roads });
            const allPaths = container.querySelectorAll('path');
            allPaths.forEach(path => {
                expect(path.getAttribute('fill')).toBe('none');
            });
        });
    });

    describe('single road', () => {
        it('should render one group with three paths for a single road', () => {
            const singleRoad = [{ id: 'road-single', hexes: ['0,0', '1,0', '2,0'] }];
            const { container } = renderLayer({ roads: singleRoad });
            const layer = container.querySelector('g.road-layer');
            const groups = layer.querySelectorAll(':scope > g');
            expect(groups.length).toBe(1);
            const paths = groups[0].querySelectorAll('path');
            expect(paths.length).toBe(3);
        });
    });

    describe('memoization', () => {
        it('should memoize elements when roads reference is unchanged', () => {
            const sameRoads = [{ id: 'road-1', hexes: ['0,0', '1,0', '2,0'] }];
            const { rerender } = renderLayer({ roads: sameRoads });
            rerender(<RoadLayer roads={sameRoads} />);
            expect(buildWindingPathDescriptor).toHaveBeenCalledTimes(1);
        });

        it('should recompute when roads reference changes', () => {
            const roads1 = [{ id: 'road-1', hexes: ['0,0', '1,0', '2,0'] }];
            const roads2 = [{ id: 'road-2', hexes: ['3,0', '4,0', '5,0'] }];
            const { rerender } = renderLayer({ roads: roads1 });
            rerender(<RoadLayer roads={roads2} />);
            expect(buildWindingPathDescriptor).toHaveBeenCalledTimes(2);
        });

        it('should not recompute when only unrelated props change', () => {
            // RoadLayer only accepts `roads`, so rerendering with the same roads
            // via a new JSX element but same reference should still memoize.
            const sameRoads = [{ id: 'road-1', hexes: ['0,0', '1,0', '2,0'] }];
            const { rerender } = renderLayer({ roads: sameRoads });
            // Re-render with a new JSX element but same data reference
            rerender(<RoadLayer roads={sameRoads} />);
            expect(buildWindingPathDescriptor).toHaveBeenCalledTimes(1);
        });
    });
});
