// @maintained-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HexGridLayer from './HexGridLayer.jsx';
import { HEX_SIZE } from '../../config/outdoorConfig.js';
import { hexToPixel, hexToSVGPath } from '../../services/maps/hexMapUtils.js';

// Converters are exercised via their real implementation; their math is owned
// and tested in services/maps/hexMapUtils.test.js (getAllHexes counts,
// hexToSVGPath shape). Here we pin only the layer's wiring + render output.
function pathForHex(q, r) {
    const center = hexToPixel(q, r, HEX_SIZE);
    return hexToSVGPath(center.x, center.y, HEX_SIZE);
}

describe('HexGridLayer', () => {
    it('renders one outlined hex path per hex, positioned by the converter', () => {
        const { container } = render(<HexGridLayer hexCols={2} hexRows={3} />);

        const group = container.querySelector('g.hex-grid-layer');
        expect(group).toBeInTheDocument();

        const paths = Array.from(group.querySelectorAll('path'));
        expect(paths).toHaveLength(6);

        // Grid lines: unfilled hex outlines with the authored stroke
        expect(paths[0]).toHaveAttribute('fill', 'none');
        expect(paths[0]).toHaveAttribute('stroke', '#999');
        expect(paths[0]).toHaveAttribute('stroke-width', '0.3');

        // Wiring: first/last paths (getAllHexes iterates r then q) sit exactly
        // where the converter owner puts hexes (0,0) and (1,2) at HEX_SIZE
        expect(paths[0]).toHaveAttribute('d', pathForHex(0, 0));
        expect(paths[5]).toHaveAttribute('d', pathForHex(1, 2));

        // Every hex renders at its own position (no collapsed grid)
        const distinctD = new Set(paths.map((p) => p.getAttribute('d')));
        expect(distinctD).toHaveLength(6);
    });

    it('re-renders the full grid when dimensions change', () => {
        const { container, rerender } = render(<HexGridLayer hexCols={2} hexRows={2} />);
        expect(container.querySelectorAll('path')).toHaveLength(4);

        rerender(<HexGridLayer hexCols={3} hexRows={2} />);
        const paths = Array.from(container.querySelectorAll('path'));
        expect(paths).toHaveLength(6);
        expect(paths[5]).toHaveAttribute('d', pathForHex(2, 1));
    });
});
