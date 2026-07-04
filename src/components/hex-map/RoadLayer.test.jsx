// @cleaned-by-ai
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

        it('should render null when roads is null, undefined, or empty', () => {
            expect(renderLayer({ roads: null }).container.firstChild).toBeNull();
            expect(renderLayer({ roads: undefined }).container.firstChild).toBeNull();
            expect(renderLayer({ roads: [] }).container.firstChild).toBeNull();
        });

        it('should render a group per valid road', () => {
            const { container } = renderLayer({ roads });
            const layer = container.querySelector('g.road-layer');
            const groups = layer.querySelectorAll(':scope > g');
            expect(groups.length).toBe(2);
        });
    });

    describe('filtering invalid roads', () => {
        it('should skip roads with fewer than 2 hexes, no hexes property, null hexes, or undefined hexes', () => {
            const invalidRoads = [
                { id: 'road-short', hexes: ['0,0'] },
                { id: 'road-no-hexes' },
                { id: 'road-null', hexes: null },
                { id: 'road-undef', hexes: undefined },
            ];
            const { container } = renderLayer({ roads: invalidRoads });
            const layer = container.querySelector('g.road-layer');
            const groups = layer.querySelectorAll(':scope > g');
            expect(groups.length).toBe(0);
        });

        it('should skip roads when buildWindingPathDescriptor returns no path', () => {
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
        it('should render shadow path with correct attributes', () => {
            const { container } = renderLayer({ roads });
            const shadowPaths = container.querySelectorAll('path[stroke="rgba(0,0,0,0.2)"]');
            expect(shadowPaths.length).toBe(2);
            shadowPaths.forEach(path => {
                expect(path.getAttribute('stroke-width')).toBe('4');
                expect(path.getAttribute('transform')).toBe('translate(0, 1)');
            });
        });
    });

    describe('main road path', () => {
        it('should render main road path with correct attributes', () => {
            const { container } = renderLayer({ roads });
            const mainPaths = container.querySelectorAll('path[stroke="#A08060"]');
            expect(mainPaths.length).toBe(2);
            mainPaths.forEach(path => {
                expect(path.getAttribute('stroke-width')).toBe('2');
                expect(path.hasAttribute('transform')).toBe(false);
                expect(path.getAttribute('stroke-dasharray')).toBe('none');
            });
        });
    });

    describe('dashed centerline', () => {
        it('should render dashed centerline with correct attributes', () => {
            const { container } = renderLayer({ roads });
            const centerlines = container.querySelectorAll('path[stroke="#C4A882"]');
            expect(centerlines.length).toBe(2);
            centerlines.forEach(path => {
                expect(path.getAttribute('stroke-dasharray')).toBe('3 4');
                expect(path.getAttribute('opacity')).toBe('0.5');
                expect(path.getAttribute('stroke-width')).toBe('0.6');
            });
        });
    });

    describe('shared path attributes', () => {
        it('should render all paths with common SVG attributes', () => {
            const { container } = renderLayer({ roads });
            const allPaths = container.querySelectorAll('path');
            allPaths.forEach(path => {
                expect(path.getAttribute('stroke-linecap')).toBe('round');
                expect(path.getAttribute('stroke-linejoin')).toBe('round');
                expect(path.getAttribute('fill')).toBe('none');
            });
        });
    });

    describe('memoization', () => {
        it('should memoize when roads reference is unchanged and recompute when it changes', () => {
            const sameRoads = [{ id: 'road-1', hexes: ['0,0', '1,0', '2,0'] }];
            const { rerender } = renderLayer({ roads: sameRoads });
            rerender(<RoadLayer roads={sameRoads} />);
            expect(buildWindingPathDescriptor).toHaveBeenCalledTimes(1);

            const roads2 = [{ id: 'road-2', hexes: ['3,0', '4,0', '5,0'] }];
            rerender(<RoadLayer roads={roads2} />);
            expect(buildWindingPathDescriptor).toHaveBeenCalledTimes(2);
        });
    });
});
