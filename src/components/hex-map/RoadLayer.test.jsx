import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RoadLayer from './RoadLayer.jsx';
import { HEX_SIZE } from '../../config/outdoorConfig.js';
import { buildWindingPathDescriptor } from '../../services/maps/hexMapUtils.js';

vi.mock('../../services/maps/hexMapUtils.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        parseHexKey: vi.fn(actual.parseHexKey),
        buildWindingPathDescriptor: vi.fn(actual.buildWindingPathDescriptor),
    };
});

describe('RoadLayer', () => {
    let roads;

    beforeEach(() => {
        vi.clearAllMocks();
        roads = [
            { id: 'road-1', hexes: ['0,0', '1,0', '2,0'] },
            { id: 'road-2', hexes: ['3,0', '4,0', '5,0'] },
        ];
    });

    const renderLayer = (layerProps) => render(<RoadLayer {...layerProps} />);

    const getLayer = (container) => container.querySelector('g.road-layer');
    const getRoadGroups = (container) => container.querySelectorAll('g.road-layer > g');
    const pathInGroupWithStroke = (group, stroke) =>
        [...group.querySelectorAll('path')].find(path => path.getAttribute('stroke') === stroke);

    describe('rendering', () => {
        it('should render the road-layer group', () => {
            const { container } = renderLayer({ roads });
            expect(getLayer(container)).toBeInTheDocument();
        });

        it.each([
            ['null', null],
            ['undefined', undefined],
            ['an empty array', []],
        ])('should render nothing when roads is %s', (_label, value) => {
            const { container } = renderLayer({ roads: value });
            expect(getLayer(container)).not.toBeInTheDocument();
        });

        it('should render one group per valid road with all three path layers sharing the same winding path', () => {
            const { container } = renderLayer({ roads });
            const groups = getRoadGroups(container);
            expect(groups).toHaveLength(2);
            groups.forEach(group => {
                expect(group.querySelectorAll('path')).toHaveLength(3);
                const [shadow, main, centerline] = group.querySelectorAll('path');
                const d = shadow.getAttribute('d');
                expect(d).toBeTruthy();
                expect(main.getAttribute('d')).toBe(d);
                expect(centerline.getAttribute('d')).toBe(d);
            });
        });
    });

    describe('filtering', () => {
        it('should skip roads with fewer than 2 hexes or no hexes property', () => {
            const invalidRoads = [
                { id: 'road-short', hexes: ['0,0'] },
                { id: 'road-empty', hexes: [] },
                { id: 'road-no-hexes' },
                { id: 'road-null', hexes: null },
                { id: 'road-undef', hexes: undefined },
            ];
            const { container } = renderLayer({ roads: invalidRoads });
            expect(getRoadGroups(container)).toHaveLength(0);
        });

        it.each([
            ['null descriptor', null],
            ['empty path descriptor', { path: '', stroke: '#A08060', strokeWidth: 2 }],
        ])('should skip a road when the path descriptor returns %s', (_label, descriptorResult) => {
            vi.mocked(buildWindingPathDescriptor).mockImplementationOnce(() => descriptorResult);
            const mixedRoads = [
                { id: 'road-bad', hexes: ['0,0', '1,0'] },
                { id: 'road-good', hexes: ['2,0', '3,0'] },
            ];
            const { container } = renderLayer({ roads: mixedRoads });
            expect(getRoadGroups(container)).toHaveLength(1);
            expect(buildWindingPathDescriptor).toHaveBeenCalledTimes(2);
            expect(buildWindingPathDescriptor).toHaveBeenCalledWith(
                [{ q: 2, r: 0 }, { q: 3, r: 0 }],
                HEX_SIZE, '#A08060', 2, 10
            );
        });
    });

    describe('road styling', () => {
        it('should render the shadow roadbed offset beneath every road', () => {
            const { container } = renderLayer({ roads });
            getRoadGroups(container).forEach(group => {
                const shadow = pathInGroupWithStroke(group, 'rgba(0,0,0,0.2)');
                expect(shadow).toBeTruthy();
                expect(shadow).toHaveAttribute('stroke-width', '4');
                expect(shadow).toHaveAttribute('transform', 'translate(0, 1)');
                expect(shadow).toHaveAttribute('fill', 'none');
            });
        });

        it('should render the main road stroke over every road', () => {
            const { container } = renderLayer({ roads });
            getRoadGroups(container).forEach(group => {
                const main = pathInGroupWithStroke(group, '#A08060');
                expect(main).toBeTruthy();
                expect(main).toHaveAttribute('stroke-width', '2');
                expect(main).toHaveAttribute('stroke-dasharray', 'none');
                expect(main.hasAttribute('transform')).toBe(false);
            });
        });

        it('should render the dashed centerline over every road', () => {
            const { container } = renderLayer({ roads });
            getRoadGroups(container).forEach(group => {
                const centerline = pathInGroupWithStroke(group, '#C4A882');
                expect(centerline).toBeTruthy();
                expect(centerline).toHaveAttribute('stroke-width', '0.6');
                expect(centerline).toHaveAttribute('stroke-dasharray', '3 4');
                expect(centerline).toHaveAttribute('opacity', '0.5');
            });
        });

        it('should apply round caps and no fill to all paths', () => {
            const { container } = renderLayer({ roads });
            container.querySelectorAll('path').forEach(path => {
                expect(path).toHaveAttribute('stroke-linecap', 'round');
                expect(path).toHaveAttribute('stroke-linejoin', 'round');
                expect(path).toHaveAttribute('fill', 'none');
            });
        });
    });

    describe('memoization', () => {
        it('should reuse the cached rendering when the roads reference is unchanged', () => {
            const sameRoads = [{ id: 'road-1', hexes: ['0,0', '1,0', '2,0'] }];
            const { rerender } = renderLayer({ roads: sameRoads });
            expect(buildWindingPathDescriptor).toHaveBeenCalledTimes(1);

            rerender(<RoadLayer roads={sameRoads} />);
            expect(buildWindingPathDescriptor).toHaveBeenCalledTimes(1);
        });

        it('should recompute when the roads reference changes', () => {
            const firstRoads = [{ id: 'road-1', hexes: ['0,0', '1,0', '2,0'] }];
            const { rerender } = renderLayer({ roads: firstRoads });
            rerender(<RoadLayer roads={[{ id: 'road-2', hexes: ['3,0', '4,0', '5,0'] }]} />);
            expect(buildWindingPathDescriptor).toHaveBeenCalledTimes(2);
        });
    });
});
