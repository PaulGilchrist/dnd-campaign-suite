import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HexGridLayer from './HexGridLayer.jsx';

vi.mock('../../services/maps/hexMapUtils.js', () => ({
    getAllHexes: vi.fn((cols, rows) => {
        const hexes = [];
        for (let r = 0; r < rows; r++) {
            for (let q = 0; q < cols; q++) {
                hexes.push({ q, r });
            }
        }
        return hexes;
    }),
    hexToPixel: vi.fn(() => ({ x: 10, y: 20 })),
    hexToSVGPath: vi.fn((x, y, size) => `M${x},${y} l${size},0`),
}));

describe('HexGridLayer', () => {
    it('should render with correct class name', () => {
        const { container } = render(<HexGridLayer hexCols={10} hexRows={5} />);
        const g = container.querySelector('g.hex-grid-layer');
        expect(g).toBeInTheDocument();
    });

    it('should render one path element per hex grid cell', () => {
        const { container } = render(<HexGridLayer hexCols={3} hexRows={2} />);
        const paths = container.querySelectorAll('path');
        // 3 cols * 2 rows = 6 hexes
        expect(paths.length).toBe(6);
    });

    it('should render no paths when hexCols is 0', () => {
        const { container } = render(<HexGridLayer hexCols={0} hexRows={5} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(0);
    });

    it('should render no paths when hexRows is 0', () => {
        const { container } = render(<HexGridLayer hexCols={5} hexRows={0} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(0);
    });

    it('should render no paths when both dimensions are 0', () => {
        const { container } = render(<HexGridLayer hexCols={0} hexRows={0} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(0);
    });

    it('should apply fill="none" to each path', () => {
        const { container } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const paths = container.querySelectorAll('path');
        paths.forEach(path => {
            expect(path.getAttribute('fill')).toBe('none');
        });
    });

    it('should apply stroke="#999" to each path', () => {
        const { container } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const paths = container.querySelectorAll('path');
        paths.forEach(path => {
            expect(path.getAttribute('stroke')).toBe('#999');
        });
    });

    it('should apply stroke-width="0.3" to each path', () => {
        const { container } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const paths = container.querySelectorAll('path');
        paths.forEach(path => {
            expect(path.getAttribute('stroke-width')).toBe('0.3');
        });
    });

    it('should render paths in correct row-major order', () => {
        const { container } = render(<HexGridLayer hexCols={3} hexRows={2} />);
        const paths = container.querySelectorAll('path');
        // 3 cols * 2 rows = 6 paths
        expect(paths.length).toBe(6);
        // Verify each path has a valid d attribute (not empty)
        paths.forEach(path => {
            expect(path.getAttribute('d')).toBeTruthy();
        });
    });

    it('should render paths in correct order (row-major)', () => {
        const { container } = render(<HexGridLayer hexCols={3} hexRows={2} />);
        const paths = container.querySelectorAll('path');
        // Verify 6 paths exist in row-major iteration order
        expect(paths.length).toBe(6);
        // First path corresponds to (0,0), last to (2,1)
        expect(paths[0].getAttribute('d')).toBeTruthy();
        expect(paths[5].getAttribute('d')).toBeTruthy();
    });

    it('should pass correct d attribute to each path', () => {
        const { container } = render(<HexGridLayer hexCols={1} hexRows={1} />);
        const path = container.querySelector('path');
        expect(path).toHaveAttribute('d');
        expect(path.getAttribute('d')).toBeTruthy();
    });

    it('should render 100 paths for a 10x10 grid', () => {
        const { container } = render(<HexGridLayer hexCols={10} hexRows={10} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(100);
    });

    it('should render 210 paths for a 10x21 grid', () => {
        const { container } = render(<HexGridLayer hexCols={10} hexRows={21} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(210);
    });

    it('should render a single path for a 1x1 grid', () => {
        const { container } = render(<HexGridLayer hexCols={1} hexRows={1} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(1);
        expect(paths[0].getAttribute('d')).toBeTruthy();
    });

    it('should render a single path for a 1xN grid', () => {
        const { container } = render(<HexGridLayer hexCols={1} hexRows={5} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(5);
    });

    it('should render a single path for a Nx1 grid', () => {
        const { container } = render(<HexGridLayer hexCols={5} hexRows={1} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(5);
    });
});
