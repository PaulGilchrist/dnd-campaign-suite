// @cleaned-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RiverLayer from './RiverLayer.jsx';
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

        it.each([
            { name: 'empty array', rivers: [] },
            { name: 'null', rivers: null },
            { name: 'undefined', rivers: undefined },
        ])('should render null when rivers is %(name)s', ({ rivers }) => {
            const { container } = renderLayer({ rivers });
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

        it('should not double-render fills for connected segments', () => {
            const { container } = renderLayer({ rivers: ['0,0', '1,0', '2,0'] });
            const fills = container.querySelectorAll('circle');
            expect(fills.length).toBe(3);
        });

        it('should render multiple disconnected segments', () => {
            const { container } = renderLayer({ rivers: ['0,0', '3,3', '4,3'] });
            const fills = container.querySelectorAll('circle');
            expect(fills.length).toBe(3);
        });
    });
});
