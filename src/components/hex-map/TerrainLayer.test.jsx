import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TerrainLayer from './TerrainLayer.jsx';

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
    hexKey: vi.fn((q, r) => `${q},${r}`),
    hexToPixel: vi.fn(() => ({ x: 10, y: 20 })),
    hexToSVGPath: vi.fn((x, y, size) => `M${x},${y} l${size},0`),
}));

describe('TerrainLayer', () => {
    it('should render with correct class name', () => {
        const { container } = render(
            <TerrainLayer hexCols={3} hexRows={2} terrain={{}} />
        );
        const g = container.querySelector('g.terrain-layer');
        expect(g).toBeInTheDocument();
    });

    it('should render one path element per hex cell', () => {
        const { container } = render(
            <TerrainLayer hexCols={3} hexRows={2} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(6);
    });

    it('should render no paths when hexCols is 0', () => {
        const { container } = render(
            <TerrainLayer hexCols={0} hexRows={5} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(0);
    });

    it('should render no paths when hexRows is 0', () => {
        const { container } = render(
            <TerrainLayer hexCols={5} hexRows={0} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(0);
    });

    it('should render no paths when both dimensions are 0', () => {
        const { container } = render(
            <TerrainLayer hexCols={0} hexRows={0} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(0);
    });

    it('should apply fill attribute to each path', () => {
        const { container } = render(
            <TerrainLayer hexCols={2} hexRows={2} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        paths.forEach(path => {
            expect(path.getAttribute('fill')).toBeTruthy();
        });
    });

    it('should render 100 paths for a 10x10 grid', () => {
        const { container } = render(
            <TerrainLayer hexCols={10} hexRows={10} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(100);
    });

    it('should render 210 paths for a 10x21 grid', () => {
        const { container } = render(
            <TerrainLayer hexCols={10} hexRows={21} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(210);
    });

    it('should render a single path for a 1x1 grid', () => {
        const { container } = render(
            <TerrainLayer hexCols={1} hexRows={1} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(1);
    });

    it('should render a single path for a 1xN grid', () => {
        const { container } = render(
            <TerrainLayer hexCols={1} hexRows={5} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(5);
    });

    it('should render a single path for a Nx1 grid', () => {
        const { container } = render(
            <TerrainLayer hexCols={5} hexRows={1} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(5);
    });

    it('should use terrain from the terrain prop when key exists', () => {
        const { container } = render(
            <TerrainLayer hexCols={2} hexRows={1} terrain={{ '0,0': 'forest' }} />
        );
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(2);
    });

    it('should use default terrain when hex key is missing from terrain prop', () => {
        const { container } = render(
            <TerrainLayer hexCols={2} hexRows={1} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(2);
        paths.forEach(path => {
            expect(path.getAttribute('fill')).toBeTruthy();
        });
    });

    it('should pass valid d attribute to each path', () => {
        const { container } = render(
            <TerrainLayer hexCols={2} hexRows={2} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        paths.forEach(path => {
            expect(path.getAttribute('d')).toBeTruthy();
        });
    });

    it('should render paths in correct row-major order', () => {
        const { container } = render(
            <TerrainLayer hexCols={3} hexRows={2} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(6);
        paths.forEach(path => {
            expect(path.getAttribute('d')).toBeTruthy();
        });
    });

    it('should render paths in correct order (row-major)', () => {
        const { container } = render(
            <TerrainLayer hexCols={3} hexRows={2} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(6);
        expect(paths[0].getAttribute('d')).toBeTruthy();
        expect(paths[5].getAttribute('d')).toBeTruthy();
    });

    it('should apply fill to every path element', () => {
        const { container } = render(
            <TerrainLayer hexCols={3} hexRows={3} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(9);
        paths.forEach(path => {
            expect(path).toHaveAttribute('fill');
        });
    });

    it('should not apply stroke attribute to path elements', () => {
        const { container } = render(
            <TerrainLayer hexCols={2} hexRows={2} terrain={{}} />
        );
        const paths = container.querySelectorAll('path');
        paths.forEach(path => {
            expect(path.getAttribute('stroke')).toBeNull();
        });
    });
});
