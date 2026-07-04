// @improved-by-ai
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

    it.each`
        hexCols | hexRows | expectedPaths
        ${0}    | ${3}    | ${0}
        ${3}    | ${0}    | ${0}
        ${0}    | ${0}    | ${0}
        ${1}    | ${1}    | ${1}
        ${3}    | ${2}    | ${6}
        ${5}    | ${4}    | ${20}
    `('should render $expectedPaths paths for grid $hexCols x $hexRows', ({ hexCols, hexRows, expectedPaths }) => {
        const { container } = render(<HexGridLayer hexCols={hexCols} hexRows={hexRows} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(expectedPaths);
    });

    it('should render all paths within the hex-grid-layer group', () => {
        const { container } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const layer = container.querySelector('g.hex-grid-layer');
        const layerPaths = layer.querySelectorAll('path');
        const allPaths = container.querySelectorAll('path');
        expect(layerPaths.length).toBe(allPaths.length);
    });

    it('should set fill, stroke, and strokeWidth on all path elements', () => {
        const { container } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const paths = container.querySelectorAll('path');
        paths.forEach(path => {
            expect(path.getAttribute('fill')).toBe('none');
            expect(path.getAttribute('stroke')).toBe('#999');
            expect(path.getAttribute('stroke-width')).toBe('0.3');
        });
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

    it('should regenerate paths when grid dimensions change', () => {
        const { container: c1 } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        const paths1 = c1.querySelectorAll('path');
        expect(paths1.length).toBe(4);

        const { container: c2 } = render(<HexGridLayer hexCols={4} hexRows={4} />);
        const paths2 = c2.querySelectorAll('path');
        expect(paths2.length).toBe(16);
    });

    it('should not crash with large grid dimensions', () => {
        const { container } = render(<HexGridLayer hexCols={20} hexRows={15} />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(300);
    });
});
// @cleaned-by-ai
