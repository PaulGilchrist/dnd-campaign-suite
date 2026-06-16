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

    it('should render the river-layer group', () => {
        const { container } = render(<RiverLayer {...props} />);
        const layer = container.querySelector('g.river-layer');
        expect(layer).toBeInTheDocument();
    });

    it('should render null when rivers is empty', () => {
        const { container } = render(<RiverLayer {...props} rivers={[]} />);
        const layer = container.querySelector('g.river-layer');
        expect(layer).not.toBeInTheDocument();
    });

    it('should render null when rivers is null', () => {
        const { container } = render(<RiverLayer {...props} rivers={null} />);
        const layer = container.querySelector('g.river-layer');
        expect(layer).not.toBeInTheDocument();
    });

    it('should render null when rivers is undefined', () => {
        const { container } = render(<RiverLayer {...props} rivers={undefined} />);
        const layer = container.querySelector('g.river-layer');
        expect(layer).not.toBeInTheDocument();
    });

    it('should render a path element for a connected river segment', () => {
        const { container } = render(<RiverLayer {...props} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBeGreaterThan(0);
    });

    it('should render fill circles for each river hex', () => {
        const { container } = render(<RiverLayer {...props} />);
        const fills = container.querySelectorAll('circle');
        expect(fills.length).toBe(3);
    });

    it('should call hexToPixel for each river hex', () => {
        render(<RiverLayer {...props} />);
        expect(hexMapUtils.hexToPixel).toHaveBeenCalled();
    });

    it('should call orderHexPath for multi-hex segments', () => {
        render(<RiverLayer {...props} />);
        expect(hexMapUtils.orderHexPath).toHaveBeenCalled();
    });

    it('should call buildWindingPathDescriptor for multi-hex segments', () => {
        render(<RiverLayer {...props} />);
        expect(hexMapUtils.buildWindingPathDescriptor).toHaveBeenCalled();
    });

    it('should render an isolated river hex as a circle fill only', () => {
        const { container } = render(<RiverLayer {...props} rivers={['5,5']} />);
        const fills = container.querySelectorAll('circle');
        expect(fills.length).toBe(1);
        const path = container.querySelector('path');
        expect(path).not.toBeInTheDocument();
    });

    it('should render multiple disconnected segments', () => {
        const { container } = render(<RiverLayer {...props} rivers={['0,0', '3,3', '4,3']} />);
        const fills = container.querySelectorAll('circle');
        expect(fills.length).toBe(3);
    });

    it('should pass correct color to buildWindingPathDescriptor', () => {
        render(<RiverLayer {...props} />);
        expect(hexMapUtils.buildWindingPathDescriptor).toHaveBeenCalledWith(
            expect.any(Array),
            30,
            '#3A82D2',
            2.5,
            12
        );
    });

    it('should use correct stroke attributes on path elements', () => {
        const { container } = render(<RiverLayer {...props} />);
        const paths = container.querySelectorAll('path');
        for (const path of paths) {
            expect(path.getAttribute('stroke')).toBe('#3A82D2');
            expect(path.getAttribute('stroke-width')).toBe('2.5');
            expect(path.getAttribute('stroke-linecap')).toBe('round');
            expect(path.getAttribute('stroke-linejoin')).toBe('round');
            expect(path.getAttribute('fill')).toBe('none');
        }
    });

    it('should use correct fill colors for river hex circles', () => {
        const { container } = render(<RiverLayer {...props} />);
        const fills = container.querySelectorAll('circle');
        const validColors = ['rgba(60, 130, 210, 0.45)', 'rgba(60, 130, 210, 0.35)'];
        for (const fill of fills) {
            expect(validColors).toContain(fill.getAttribute('fill'));
        }
    });

    it('should render circle radius 4 for isolated hex fills', () => {
        const { container } = render(<RiverLayer {...props} rivers={['5,5']} />);
        const fill = container.querySelector('circle');
        expect(fill.getAttribute('r')).toBe('4');
    });

    it('should render circle radius 4 for connected hex fills', () => {
        const { container } = render(<RiverLayer {...props} />);
        const fills = container.querySelectorAll('circle');
        for (const fill of fills) {
            expect(fill.getAttribute('r')).toBe('4');
        }
    });

    it('should not render paths when buildWindingPathDescriptor returns null', () => {
        vi.mocked(hexMapUtils.buildWindingPathDescriptor).mockReturnValue(null);
        const { container } = render(<RiverLayer {...props} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(0);
    });

    it('should not crash when buildWindingPathDescriptor returns object without path', () => {
        vi.mocked(hexMapUtils.buildWindingPathDescriptor).mockReturnValue({});
        const { container } = render(<RiverLayer {...props} />);
        const layer = container.querySelector('g.river-layer');
        expect(layer).toBeInTheDocument();
    });

    it('should handle large number of river hexes', () => {
        const largeRivers = Array.from({ length: 50 }, (_, i) => `${i},0`);
        const { container } = render(<RiverLayer {...props} rivers={largeRivers} />);
        const fills = container.querySelectorAll('circle');
        expect(fills.length).toBe(50);
    });

    it('should handle boundary-constrained neighbor checks', () => {
        const { container } = render(<RiverLayer {...props} rivers={['0,0', '1,0']} />);
        const fills = container.querySelectorAll('circle');
        expect(fills.length).toBe(2);
    });

    it('should render river-layer class on the group element', () => {
        const { container } = render(<RiverLayer {...props} />);
        const layer = container.querySelector('g.river-layer');
        expect(layer).toHaveClass('river-layer');
    });

    it('should produce consistent element counts across renders', () => {
        const { container } = render(<RiverLayer {...props} />);
        const { container: container2 } = render(<RiverLayer {...props} />);
        expect(container.querySelectorAll('circle').length).toBe(
            container2.querySelectorAll('circle').length
        );
    });

    it('should recompute when hexCols changes', () => {
        const { container } = render(<RiverLayer {...props} hexCols={10} />);
        const { container: container2 } = render(<RiverLayer {...props} hexCols={20} />);
        expect(container.querySelectorAll('circle').length).toBe(
            container2.querySelectorAll('circle').length
        );
    });

    it('should recompute when hexRows changes', () => {
        const { container } = render(<RiverLayer {...props} hexRows={10} />);
        const { container: container2 } = render(<RiverLayer {...props} hexRows={20} />);
        expect(container.querySelectorAll('circle').length).toBe(
            container2.querySelectorAll('circle').length
        );
    });

    it('should handle single hex at boundary (0,0)', () => {
        const { container } = render(<RiverLayer {...props} rivers={['0,0']} />);
        const fills = container.querySelectorAll('circle');
        expect(fills.length).toBe(1);
    });

    it('should handle river hexes near boundary', () => {
        const { container } = render(<RiverLayer {...props} rivers={['9,9']} />);
        const fills = container.querySelectorAll('circle');
        expect(fills.length).toBe(1);
    });

    it('should not double-render fills for connected segments', () => {
        const { container } = render(<RiverLayer {...props} rivers={['0,0', '1,0', '2,0']} />);
        const fills = container.querySelectorAll('circle');
        expect(fills.length).toBe(3);
    });
});
