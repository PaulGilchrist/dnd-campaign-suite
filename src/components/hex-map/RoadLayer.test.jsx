// @maintained-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RoadLayer from './RoadLayer.jsx';
import { HEX_SIZE } from '../../config/outdoorConfig.js';
import { buildWindingPathDescriptor } from '../../services/maps/hexMapUtils.js';

// Oracle discipline: expected geometry is DERIVED from the real converter, never
// hand-computed and never mocked. Converter internals are owned by hexMapUtils tests
// and the A*/repath state that produces roads is owned by the map state hook (#804) —
// this file owns only that RoadLayer wires converted output through verbatim with the
// exact args it authors (HEX_SIZE, '#A08060', 2, wind 10), plus exact styling bytes.
// Oracle inputs are hand-typed { q, r } literals: if parseHexKey ever drifts on the
// 'q,r' fixture strings, rendered bytes will diverge from oracle bytes and we catch it.
const windingOracle = (...points) =>
    buildWindingPathDescriptor(points, HEX_SIZE, '#A08060', 2, 10).path;

describe('RoadLayer', () => {
    const roads = [
        { id: 'road-1', hexes: ['0,0', '1,0', '2,0'] },
        { id: 'road-2', hexes: ['3,0', '4,0', '5,0'] },
    ];
    const roadPoints = [
        [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }],
        [{ q: 3, r: 0 }, { q: 4, r: 0 }, { q: 5, r: 0 }],
    ];

    const renderLayer = (layerProps = {}) =>
        render(<RoadLayer roads={roads} {...layerProps} />);

    const getRoadGroups = (container) => container.querySelectorAll('g.road-layer > g');

    it.each([
        { name: 'an empty array', roads: [] },
        { name: 'null', roads: null },
        { name: 'undefined', roads: undefined },
    ])('renders nothing when roads is $name', ({ roads: value }) => {
        const { container } = renderLayer({ roads: value });
        expect(container.querySelector('g.road-layer')).not.toBeInTheDocument();
    });

    it('renders one group per road, each with three paths byte-identical to the real converter', () => {
        const { container } = renderLayer();
        const groups = getRoadGroups(container);
        expect(groups).toHaveLength(2);
        roadPoints.forEach((points, i) => {
            const paths = groups[i].querySelectorAll('path');
            expect(paths).toHaveLength(3);
            const d = windingOracle(...points);
            paths.forEach(path => {
                expect(path.getAttribute('d')).toBe(d);
            });
        });
    });

    it('applies authored shadow, main, and centerline styling in paint order', () => {
        const { container } = renderLayer();
        getRoadGroups(container).forEach(group => {
            const paths = group.querySelectorAll('path');
            const [shadow, main, centerline] = paths;
            expect(shadow).toHaveAttribute('stroke', 'rgba(0,0,0,0.2)');
            expect(shadow).toHaveAttribute('stroke-width', '4');
            expect(shadow).toHaveAttribute('transform', 'translate(0, 1)');
            expect(main).toHaveAttribute('stroke', '#A08060');
            expect(main).toHaveAttribute('stroke-width', '2');
            expect(main).toHaveAttribute('stroke-dasharray', 'none');
            expect(main.hasAttribute('transform')).toBe(false);
            expect(centerline).toHaveAttribute('stroke', '#C4A882');
            expect(centerline).toHaveAttribute('stroke-width', '0.6');
            expect(centerline).toHaveAttribute('stroke-dasharray', '3 4');
            expect(centerline).toHaveAttribute('opacity', '0.5');
            paths.forEach(path => {
                expect(path).toHaveAttribute('fill', 'none');
                expect(path).toHaveAttribute('stroke-linecap', 'round');
                expect(path).toHaveAttribute('stroke-linejoin', 'round');
            });
        });
    });

    it('skips roads with fewer than two hexes or no hexes and renders valid roads unchanged', () => {
        const mixed = [
            { id: 'road-short', hexes: ['0,0'] },
            { id: 'road-empty', hexes: [] },
            { id: 'road-no-hexes' },
            { id: 'road-null', hexes: null },
            { id: 'road-undef', hexes: undefined },
            ...roads,
        ];
        const { container } = renderLayer({ roads: mixed });
        const groups = getRoadGroups(container);
        expect(groups).toHaveLength(2);
        roadPoints.forEach((points, i) => {
            expect(groups[i].querySelector('path').getAttribute('d')).toBe(
                windingOracle(...points)
            );
        });
    });
});
