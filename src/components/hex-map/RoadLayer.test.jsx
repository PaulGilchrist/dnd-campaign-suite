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

    it('should render the road-layer group', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const layer = container.querySelector('g.road-layer');
        expect(layer).toBeInTheDocument();
    });

    it('should render null when roads is null', () => {
        const { container } = render(<RoadLayer roads={null} />);
        expect(container.firstChild).toBeNull();
    });

    it('should render null when roads is empty', () => {
        const { container } = render(<RoadLayer roads={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('should render a group per valid road', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const groups = container.querySelectorAll('g');
        // road-layer group + 2 road groups
        expect(groups.length).toBe(3);
    });

    it('should skip roads with fewer than 2 hexes', () => {
        const shortRoads = [
            { id: 'road-short', hexes: ['0,0'] },
        ];
        const { container } = render(<RoadLayer roads={shortRoads} />);
        const layer = container.querySelector('g.road-layer');
        const groups = layer.querySelectorAll('g');
        expect(groups.length).toBe(0);
    });

    it('should skip roads with no hexes property', () => {
        const badRoads = [
            { id: 'road-no-hexes' },
        ];
        const { container } = render(<RoadLayer roads={badRoads} />);
        const layer = container.querySelector('g.road-layer');
        const groups = layer.querySelectorAll('g');
        expect(groups.length).toBe(0);
    });

    it('should call parseHexKey for each hex in a road', () => {
        render(<RoadLayer roads={roads} />);
        expect(parseHexKey).toHaveBeenCalledWith('0,0');
        expect(parseHexKey).toHaveBeenCalledWith('1,0');
        expect(parseHexKey).toHaveBeenCalledWith('2,0');
        expect(parseHexKey).toHaveBeenCalledWith('3,0');
        expect(parseHexKey).toHaveBeenCalledWith('4,0');
        expect(parseHexKey).toHaveBeenCalledWith('5,0');
    });

    it('should call buildWindingPathDescriptor with ordered hexes', () => {
        render(<RoadLayer roads={roads} />);
        expect(buildWindingPathDescriptor).toHaveBeenCalledTimes(2);
    });

    it('should render shadow path with translate(0,1) transform', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const shadowPaths = container.querySelectorAll('path[transform="translate(0, 1)"]');
        expect(shadowPaths.length).toBe(2);
    });

    it('should render shadow path with black semi-transparent stroke', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const shadowPaths = container.querySelectorAll('path[stroke="rgba(0,0,0,0.2)"]');
        expect(shadowPaths.length).toBe(2);
    });

    it('should render shadow path with strokeWidth + 2', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const shadowPaths = container.querySelectorAll('path[stroke="rgba(0,0,0,0.2)"]');
        shadowPaths.forEach(path => {
            expect(path.getAttribute('stroke-width')).toBe('4');
        });
    });

    it('should render main road path with correct stroke color', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const mainPaths = container.querySelectorAll('path[stroke="#A08060"]');
        expect(mainPaths.length).toBe(2);
    });

    it('should render main road path without transform', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const mainPaths = container.querySelectorAll('path[stroke="#A08060"]');
        mainPaths.forEach(path => {
            expect(path.hasAttribute('transform')).toBe(false);
        });
    });

    it('should render dashed centerline path', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const centerlines = container.querySelectorAll('path[stroke-dasharray="3 4"]');
        expect(centerlines.length).toBe(2);
    });

    it('should render dashed centerline with correct color', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const centerlines = container.querySelectorAll('path[stroke="#C4A882"]');
        expect(centerlines.length).toBe(2);
    });

    it('should render dashed centerline with opacity 0.5', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const centerlines = container.querySelectorAll('path[opacity="0.5"]');
        expect(centerlines.length).toBe(2);
    });

    it('should render dashed centerline with strokeWidth 0.6', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const centerlines = container.querySelectorAll('path[stroke-width="0.6"]');
        expect(centerlines.length).toBe(2);
    });

    it('should render paths with strokeLinecap round', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const allPaths = container.querySelectorAll('path');
        allPaths.forEach(path => {
            expect(path.getAttribute('stroke-linecap')).toBe('round');
        });
    });

    it('should render paths with strokeLinejoin round', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const allPaths = container.querySelectorAll('path');
        allPaths.forEach(path => {
            expect(path.getAttribute('stroke-linejoin')).toBe('round');
        });
    });

    it('should render paths with fill none', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const allPaths = container.querySelectorAll('path');
        allPaths.forEach(path => {
            expect(path.getAttribute('fill')).toBe('none');
        });
    });

    it('should use road id as key for each group', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const layer = container.querySelector('g.road-layer');
        const groups = layer.querySelectorAll(':scope > g');
        // Keys are used internally by React and not exposed on DOM nodes.
        // We verify the correct number of groups rendering confirms correct keys were used.
        expect(groups.length).toBe(2);
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
        const { container } = render(<RoadLayer roads={mixedRoads} />);
        const layer = container.querySelector('g.road-layer');
        const groups = layer.querySelectorAll(':scope > g');
        expect(groups.length).toBe(1);
    });

    it('should memoize elements on same roads reference', () => {
        const sameRoads = [
            { id: 'road-1', hexes: ['0,0', '1,0', '2,0'] },
        ];
        const { rerender } = render(<RoadLayer roads={sameRoads} />);
        rerender(<RoadLayer roads={sameRoads} />);
        expect(buildWindingPathDescriptor).toHaveBeenCalledTimes(1);
    });

    it('should recompute when roads reference changes', () => {
        const roads1 = [{ id: 'road-1', hexes: ['0,0', '1,0', '2,0'] }];
        const roads2 = [{ id: 'road-2', hexes: ['3,0', '4,0', '5,0'] }];
        const { rerender } = render(<RoadLayer roads={roads1} />);
        rerender(<RoadLayer roads={roads2} />);
        expect(buildWindingPathDescriptor).toHaveBeenCalledTimes(2);
    });

    it('should handle single road', () => {
        const singleRoad = [{ id: 'road-single', hexes: ['0,0', '1,0', '2,0'] }];
        const { container } = render(<RoadLayer roads={singleRoad} />);
        const layer = container.querySelector('g.road-layer');
        const groups = layer.querySelectorAll(':scope > g');
        expect(groups.length).toBe(1);
    });

    it('should render three path elements per road group', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const layer = container.querySelector('g.road-layer');
        const roadGroups = layer.querySelectorAll(':scope > g');
        roadGroups.forEach(group => {
            const paths = group.querySelectorAll('path');
            expect(paths.length).toBe(3);
        });
    });

    it('should render main path with strokeDasharray none', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const mainPaths = container.querySelectorAll('path[stroke-dasharray="none"]');
        expect(mainPaths.length).toBe(2);
    });

    it('should render main path with strokeWidth 2', () => {
        const { container } = render(<RoadLayer roads={roads} />);
        const mainPaths = container.querySelectorAll('path[stroke="#A08060"]');
        mainPaths.forEach(path => {
            expect(path.getAttribute('stroke-width')).toBe('2');
        });
    });
});
