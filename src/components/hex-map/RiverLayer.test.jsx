// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RiverLayer from './RiverLayer.jsx';
import * as hexMapUtils from '../../services/maps/hexMapUtils.js';

vi.mock('../../config/outdoorConfig.js', () => ({
    HEX_SIZE: 30,
}));

vi.mock('../../services/maps/hexMapUtils.js', () => ({
    hexToPixel: vi.fn((q, r, size) => ({
        x: size * Math.sqrt(3) * (q + r / 2),
        y: size * 3 / 2 * r,
    })),
    hexNeighbors: vi.fn((q, r) => [
        { q: q + 1, r },
        { q: q - 1, r },
        { q, r: r + 1 },
        { q, r: r - 1 },
        { q: q + 1, r: r - 1 },
        { q: q - 1, r: r + 1 },
    ]),
    orderHexPath: vi.fn((hexes) => hexes),
    buildWindingPathDescriptor: vi.fn((ordered, size, color, strokeWidth, _windAmount) => ({
        path: `M0,0 L${size},${size}`,
        stroke: color,
        strokeWidth,
    })),
}));

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

    describe('rendering', () => {
        it('should render the river-layer group', () => {
            const { container } = renderLayer();
            const layer = container.querySelector('g.river-layer');
            expect(layer).toBeInTheDocument();
        });

        it('should render null when rivers is empty', () => {
            const { container } = renderLayer({ rivers: [] });
            const layer = container.querySelector('g.river-layer');
            expect(layer).not.toBeInTheDocument();
        });

        it('should render null when rivers is null', () => {
            const { container } = renderLayer({ rivers: null });
            const layer = container.querySelector('g.river-layer');
            expect(layer).not.toBeInTheDocument();
        });

        it('should render null when rivers is undefined', () => {
            const { container } = renderLayer({ rivers: undefined });
            const layer = container.querySelector('g.river-layer');
            expect(layer).not.toBeInTheDocument();
        });

        it('should render a path element for a connected river segment', () => {
            const { container } = renderLayer();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBeGreaterThan(0);
        });

        it('should render fill circles for each river hex', () => {
            const { container } = renderLayer();
            const fills = container.querySelectorAll('circle');
            expect(fills.length).toBe(3);
        });
    });

    describe('utility calls', () => {
        it('should call hexToPixel for each river hex', () => {
            renderLayer();
            expect(hexMapUtils.hexToPixel).toHaveBeenCalled();
        });

        it('should call orderHexPath for multi-hex segments', () => {
            renderLayer();
            expect(hexMapUtils.orderHexPath).toHaveBeenCalled();
        });

        it('should call buildWindingPathDescriptor for multi-hex segments', () => {
            renderLayer();
            expect(hexMapUtils.buildWindingPathDescriptor).toHaveBeenCalled();
        });

        it('should pass correct color to buildWindingPathDescriptor', () => {
            renderLayer();
            expect(hexMapUtils.buildWindingPathDescriptor).toHaveBeenCalledWith(
                expect.any(Array),
                30,
                '#3A82D2',
                2.5,
                12
            );
        });
    });

    describe('isolated hexes', () => {
        it('should render an isolated river hex as a circle fill only', () => {
            const { container } = renderLayer({ rivers: ['5,5'] });
            const fills = container.querySelectorAll('circle');
            expect(fills.length).toBe(1);
            const path = container.querySelector('path');
            expect(path).not.toBeInTheDocument();
        });

        it('should handle single hex at boundary (0,0)', () => {
            const { container } = renderLayer({ rivers: ['0,0'] });
            const fills = container.querySelectorAll('circle');
            expect(fills.length).toBe(1);
        });
    });

    describe('multiple segments', () => {
        it('should render multiple disconnected segments', () => {
            const { container } = renderLayer({ rivers: ['0,0', '3,3', '4,3'] });
            const fills = container.querySelectorAll('circle');
            expect(fills.length).toBe(3);
        });

        it('should not double-render fills for connected segments', () => {
            const { container } = renderLayer({ rivers: ['0,0', '1,0', '2,0'] });
            const fills = container.querySelectorAll('circle');
            expect(fills.length).toBe(3);
        });
    });

    describe('edge cases', () => {
        it('should not render paths when buildWindingPathDescriptor returns null', () => {
            vi.mocked(hexMapUtils.buildWindingPathDescriptor).mockReturnValue(null);
            const { container } = renderLayer();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(0);
        });

        it('should not crash when buildWindingPathDescriptor returns object without path', () => {
            vi.mocked(hexMapUtils.buildWindingPathDescriptor).mockReturnValue({});
            const { container } = renderLayer();
            const layer = container.querySelector('g.river-layer');
            expect(layer).toBeInTheDocument();
        });

        it('should handle large number of river hexes', () => {
            const largeRivers = Array.from({ length: 50 }, (_, i) => `${i},0`);
            const { container } = renderLayer({ rivers: largeRivers });
            const fills = container.querySelectorAll('circle');
            expect(fills.length).toBe(50);
        });

        it('should handle boundary-constrained neighbor checks', () => {
            const { container } = renderLayer({ rivers: ['0,0', '1,0'] });
            const fills = container.querySelectorAll('circle');
            expect(fills.length).toBe(2);
        });

        it('should handle river hexes near boundary', () => {
            const { container } = renderLayer({ rivers: ['9,9'] });
            const fills = container.querySelectorAll('circle');
            expect(fills.length).toBe(1);
        });
    });
});
