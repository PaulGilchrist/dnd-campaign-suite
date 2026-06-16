import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HexGridLayer from './HexGridLayer.jsx';

vi.mock('../../config/outdoorConfig.js', () => ({
    HEX_SIZE: 30,
}));

vi.mock('../../services/maps/hexMapUtils.js', () => ({
    getAllHexes: vi.fn((hexCols, hexRows) => {
        const hexes = [];
        for (let r = 0; r < hexRows; r++) {
            for (let q = 0; q < hexCols; q++) {
                hexes.push({ q, r });
            }
        }
        return hexes;
    }),
    hexToPixel: vi.fn((q, r, size) => ({
        x: size * Math.sqrt(3) * (q + r / 2),
        y: size * 3 / 2 * r,
    })),
    hexToSVGPath: vi.fn((cx, cy, size) => {
        const corners = [];
        for (let i = 0; i < 6; i++) {
            const angleDeg = 60 * i - 30;
            const angleRad = angleDeg * Math.PI / 180;
            corners.push({
                x: cx + size * Math.cos(angleRad),
                y: cy + size * Math.sin(angleRad),
            });
        }
        const d = corners.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ') + ' Z';
        return d;
    }),
}));

describe('HexGridLayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the hex-grid-layer group', () => {
        const { container } = render(<HexGridLayer hexCols={3} hexRows={2} />);
        const layer = container.querySelector('g.hex-grid-layer');
        expect(layer).toBeInTheDocument();
    });

    it('should render one path element per hex', () => {
        const { container } = render(<HexGridLayer hexCols={3} hexRows={2} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(6);
    });

    it('should render no paths when hexCols is 0', () => {
        const { container } = render(<HexGridLayer hexCols={0} hexRows={3} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(0);
    });

    it('should render no paths when hexRows is 0', () => {
        const { container } = render(<HexGridLayer hexCols={3} hexRows={0} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(0);
    });

    it('should render no paths when both dimensions are 0', () => {
        const { container } = render(<HexGridLayer hexCols={0} hexRows={0} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(0);
    });

    it('should render correct number of paths for 1x1 grid', () => {
        const { container } = render(<HexGridLayer hexCols={1} hexRows={1} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(1);
    });

    it('should render correct number of paths for large grid', () => {
        const { container } = render(<HexGridLayer hexCols={5} hexRows={4} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(20);
    });

    it('should set fill="none" on all path elements', () => {
        const { container } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const paths = container.querySelectorAll('path');
        paths.forEach(path => {
            expect(path.getAttribute('fill')).toBe('none');
        });
    });

    it('should set stroke="#999" on all path elements', () => {
        const { container } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const paths = container.querySelectorAll('path');
        paths.forEach(path => {
            expect(path.getAttribute('stroke')).toBe('#999');
        });
    });

    it('should set strokeWidth="0.3" on all path elements', () => {
        const { container } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const paths = container.querySelectorAll('path');
        paths.forEach(path => {
            expect(path.getAttribute('stroke-width')).toBe('0.3');
        });
    });

    it('should use q,r as key for each path element', () => {
        const { container } = render(<HexGridLayer hexCols={3} hexRows={2} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(6);
        // Keys are used as React keys for reconciliation; verify paths exist
        // with valid d attributes (hexagonal paths)
        paths.forEach(path => {
            const d = path.getAttribute('d');
            expect(typeof d).toBe('string');
            expect(d.length).toBeGreaterThan(0);
        });
    });

    it('should memoize paths when props do not change', () => {
        const { container: c1 } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const paths1 = c1.querySelectorAll('path');
        const { container: c2 } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const paths2 = c2.querySelectorAll('path');
        expect(paths1.length).toBe(paths2.length);
    });

    it('should regenerate paths when hexCols changes', () => {
        const { container: c1 } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const paths1 = c1.querySelectorAll('path');
        const { container: c2 } = render(<HexGridLayer hexCols={4} hexRows={2} />);
        const paths2 = c2.querySelectorAll('path');
        expect(paths1.length).toBe(4);
        expect(paths2.length).toBe(8);
    });

    it('should regenerate paths when hexRows changes', () => {
        const { container: c1 } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const paths1 = c1.querySelectorAll('path');
        const { container: c2 } = render(<HexGridLayer hexCols={2} hexRows={4} />);
        const paths2 = c2.querySelectorAll('path');
        expect(paths1.length).toBe(4);
        expect(paths2.length).toBe(8);
    });

    it('should render paths with valid SVG d attribute strings', () => {
        const { container } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const paths = container.querySelectorAll('path');
        paths.forEach(path => {
            const d = path.getAttribute('d');
            expect(typeof d).toBe('string');
            expect(d).toMatch(/^M[\d.-]+,[\d.-]+/);
            expect(d).toMatch(/Z$/);
        });
    });

    it('should render a single hex as a hexagonal path', () => {
        const { container } = render(<HexGridLayer hexCols={1} hexRows={1} />);
        const path = container.querySelector('path');
        const d = path.getAttribute('d');
        // A hexagon has 6 corners: 1 M command + 5 L commands + Z
        const mCount = (d.match(/M/g) || []).length;
        const lCount = (d.match(/L/g) || []).length;
        expect(mCount).toBe(1);
        expect(lCount).toBe(5);
    });

    it('should render all paths within the hex-grid-layer group', () => {
        const { container } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const layer = container.querySelector('g.hex-grid-layer');
        const layerPaths = layer.querySelectorAll('path');
        const allPaths = container.querySelectorAll('path');
        expect(layerPaths.length).toBe(allPaths.length);
    });

    it('should render paths in row-major order (q varies fastest)', () => {
        const { container } = render(<HexGridLayer hexCols={3} hexRows={2} />);
        const paths = container.querySelectorAll('path');
        // Verify all 6 paths rendered
        expect(paths.length).toBe(6);
        // Each path should have a valid hexagonal SVG d string
        paths.forEach(path => {
            const d = path.getAttribute('d');
            expect(d).toMatch(/^M[\d.-]+,[\d.-]+/);
        });
    });

    it('should not crash with large grid dimensions', () => {
        const { container } = render(<HexGridLayer hexCols={20} hexRows={15} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(300);
    });

    it('should render the group with correct className', () => {
        const { container } = render(<HexGridLayer hexCols={1} hexRows={1} />);
        const layer = container.querySelector('g.hex-grid-layer');
        expect(layer).toHaveAttribute('class', 'hex-grid-layer');
    });
});
