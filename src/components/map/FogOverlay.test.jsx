// @maintained-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FogOverlay from './FogOverlay.jsx';

// FogOverlay unit lane: props → fog rects, exact bytes.
// Owns: cell count, verbatim geometry from an authored fixture, role class
// string per role, empty/null fog honesty, props-driven re-render.
// Not owned (owner cited):
//   - fog visibility/expansion math ......... useFogOfWar service
//   - hiding placed items under fog ......... PlacedItems-fog.test.jsx
//   - mounted SVG + role wiring ............. Map.test.jsx ("Map - fog of war role rendering")
//   - fill/opacity/pointer-events bytes ..... Map.css (.fog-cell rules)

const rectFacts = (container) => Array.from(container.querySelectorAll('rect')).map((rect) => ({
    x: Number(rect.getAttribute('x')),
    y: Number(rect.getAttribute('y')),
    width: Number(rect.getAttribute('width')),
    height: Number(rect.getAttribute('height')),
    cls: rect.getAttribute('class'),
}));

describe('FogOverlay', () => {
    it.each([
        { name: 'undefined fog', props: {} },
        { name: 'null fog', props: { fog: null } },
        { name: 'empty fog set', props: { fog: new Set() } },
    ])('renders nothing for $name', ({ props }) => {
        const { container } = render(<FogOverlay {...props} isLocalhost />);
        expect(container.innerHTML).toBe('');
    });

    it.each([
        { isLocalhost: true, cellClass: 'fog-cell' },
        { isLocalhost: false, cellClass: 'fog-cell-player' },
    ])('renders one exact rect per fog cell for class "$cellClass"', ({ isLocalhost, cellClass }) => {
        // Authored fixture: CELL_SIZE = 40 px per grid cell.
        const fog = new Set(['0,0', '1,0', '2,1']);
        const { container } = render(<FogOverlay fog={fog} isLocalhost={isLocalhost} />);

        expect(rectFacts(container)).toEqual([
            { x: 0, y: 0, width: 40, height: 40, cls: `no-print ${cellClass}` },
            { x: 40, y: 0, width: 40, height: 40, cls: `no-print ${cellClass}` },
            { x: 80, y: 40, width: 40, height: 40, cls: `no-print ${cellClass}` },
        ]);
    });

    it('re-renders to the new fog exactly when fog changes (no stale cells)', () => {
        const { container, rerender } = render(
            <FogOverlay fog={new Set(['0,0'])} isLocalhost={false} />
        );
        expect(rectFacts(container).map((r) => `${r.x},${r.y}`)).toEqual(['0,0']);

        rerender(<FogOverlay fog={new Set(['1,0', '2,1'])} isLocalhost={false} />);
        expect(rectFacts(container).map((r) => `${r.x},${r.y}`)).toEqual(['40,0', '80,40']);
    });

    it('stamps data-cell="gx,gy" on fog rects for automation lookup', () => {
        const { container } = render(<FogOverlay fog={new Set(['3,7'])} isLocalhost />);

        const fogged = container.querySelector('rect.fog-cell[data-cell="3,7"]');
        expect(fogged).toBeInTheDocument();
        expect(fogged).toHaveAttribute('x', '120');
        expect(fogged).toHaveAttribute('y', '280');
    });
});
