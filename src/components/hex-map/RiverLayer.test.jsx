import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RiverLayer from './RiverLayer.jsx';
import { HEX_SIZE } from '../../config/outdoorConfig.js';
import { hexToPixel, buildWindingPathDescriptor } from '../../services/maps/hexMapUtils.js';

vi.mock('../../services/maps/hexMapUtils.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        buildWindingPathDescriptor: vi.fn(actual.buildWindingPathDescriptor),
    };
});

describe('RiverLayer', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        props = {
            rivers: ['0,0', '1,0', '2,0'],
            hexCols: 10,
            hexRows: 10,
        };
    });

    const renderLayer = (layerProps = {}) => {
        return render(<RiverLayer {...props} {...layerProps} />);
    };

    const getLayer = (container) => container.querySelector('g.river-layer');
    const getPaths = (container) => container.querySelectorAll('path');
    const getFills = (container) => container.querySelectorAll('circle');

    const hexCenter = (q, r) => hexToPixel(q, r, HEX_SIZE);

    const fillCenteredAt = (container, q, r) => {
        const { x, y } = hexCenter(q, r);
        return [...getFills(container)].find(circle =>
            Math.abs(parseFloat(circle.getAttribute('cx')) - x) < 0.001 &&
            Math.abs(parseFloat(circle.getAttribute('cy')) - y) < 0.001
        );
    };

    describe('rendering', () => {
        it('should render the river-layer group', () => {
            const { container } = renderLayer();
            expect(getLayer(container)).toBeInTheDocument();
        });

        it.each([
            { name: 'an empty array', rivers: [] },
            { name: 'null', rivers: null },
            { name: 'undefined', rivers: undefined },
        ])('should render nothing when rivers is $name', ({ rivers }) => {
            const { container } = renderLayer({ rivers });
            expect(getLayer(container)).not.toBeInTheDocument();
        });

        it('should render a winding path for a connected segment', () => {
            const { container } = renderLayer();
            expect(getPaths(container)).toHaveLength(1);
        });

        it('should render a fill circle for every hex in a connected segment', () => {
            const { container } = renderLayer();
            expect(getFills(container)).toHaveLength(3);
        });

        it('should render an isolated hex as a fill circle only', () => {
            const { container } = renderLayer({ rivers: ['5,5'] });
            expect(getFills(container)).toHaveLength(1);
            expect(getPaths(container)).toHaveLength(0);
            const [q, r] = '5,5'.split(',').map(Number);
            expect(fillCenteredAt(container, q, r)).toBeTruthy();
        });

        it('should render disconnected segments as separate paths plus fills', () => {
            const { container } = renderLayer({ rivers: ['0,0', '3,3', '4,3'] });
            expect(getPaths(container)).toHaveLength(1);
            expect(getFills(container)).toHaveLength(3);
        });

        it('should not render duplicate fills for duplicate river keys', () => {
            const { container } = renderLayer({ rivers: ['0,0', '0,0', '1,0'] });
            expect(getFills(container)).toHaveLength(2);
            expect(getPaths(container)).toHaveLength(1);
        });

        it('should not connect river hexes across the grid boundary', () => {
            const { container } = renderLayer({ rivers: ['0,0', '1,0'], hexCols: 1 });
            expect(getPaths(container)).toHaveLength(0);
            expect(getFills(container)).toHaveLength(2);
        });
    });

    describe('path styling', () => {
        it('should apply the river stroke styling to winding paths', () => {
            const { container } = renderLayer();
            const [path] = getPaths(container);
            expect(path).toHaveAttribute('d');
            expect(path).toHaveAttribute('stroke', '#3A82D2');
            expect(path).toHaveAttribute('stroke-width', '2.5');
            expect(path).toHaveAttribute('fill', 'none');
            expect(path).toHaveAttribute('stroke-linecap', 'round');
            expect(path).toHaveAttribute('stroke-linejoin', 'round');
        });

        it('should skip the path but keep fills when the descriptor is invalid', () => {
            buildWindingPathDescriptor.mockImplementationOnce(() => null);
            const { container } = renderLayer();
            expect(getPaths(container)).toHaveLength(0);
            expect(getFills(container)).toHaveLength(3);
        });
    });

    describe('fill styling', () => {
        it('should place each fill circle at the axial center of its hex and apply soft-fill styling', () => {
            const { container } = renderLayer();
            expect(fillCenteredAt(container, 0, 0)).toBeTruthy();
            expect(fillCenteredAt(container, 1, 0)).toBeTruthy();
            expect(fillCenteredAt(container, 2, 0)).toBeTruthy();
            getFills(container).forEach(circle => {
                expect(circle).toHaveAttribute('r', '4');
                expect(circle).toHaveAttribute('fill', 'rgba(60, 130, 210, 0.35)');
            });
        });

        it('should apply the isolated fill styling to lone hexes', () => {
            const { container } = renderLayer({ rivers: ['5,5'] });
            const [circle] = getFills(container);
            expect(circle).toHaveAttribute('r', '4');
            expect(circle).toHaveAttribute('fill', 'rgba(60, 130, 210, 0.45)');
        });
    });
});
