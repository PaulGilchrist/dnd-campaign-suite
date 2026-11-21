// @maintained-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CoordinateLegend from './CoordinateLegend.jsx';
import { CELL_SIZE } from '../../config/mapConfig';

// Lane: coordinate legend render gating (backlog 2026-11-21). OFF (default,
// incl. fresh mount) must add ZERO DOM — the untouched board renders byte-
// identical. ON must paint every axis digit in grid units. Geometry contract
// → coordinateLabels.test.js; toolbar toggle → MapToolbar.test.jsx.

describe('CoordinateLegend', () => {
    const svgWrap = (ui) => render(<svg><g>{ui}</g></svg>);

    it('renders NOTHING while disabled — zero legend DOM, zero layout shift', () => {
        const { container } = svgWrap(<CoordinateLegend gridSize={30} enabled={false} />);
        expect(container.querySelector('.coord-legend')).toBeNull();
        expect(container.querySelectorAll('.coord-label')).toHaveLength(0);
        // Control: same props with enabled omitted — the fresh-mount default
        // (Map.jsx useState(false)) — also renders nothing.
        const { container: off } = svgWrap(<CoordinateLegend gridSize={30} />);
        expect(off.querySelector('.coord-legend')).toBeNull();
    });

    it('renders every axis digit as a grid-unit <text> when enabled', () => {
        const { container } = svgWrap(<CoordinateLegend gridSize={30} enabled />);
        const labels = container.querySelectorAll('.coord-label');
        expect(labels).toHaveLength(60);
        const col5 = [...labels].find(t => t.getAttribute('class').includes('coord-col') && t.textContent === '5');
        expect(col5).toBeTruthy();
        // Coordinates are viewBox units — they ride the svg's zoom/pan
        // transform, never fixed pixel offsets.
        expect(Number(col5.getAttribute('x'))).toBe(5 * CELL_SIZE + CELL_SIZE / 2);
        const row10 = [...labels].find(t => t.getAttribute('class').includes('coord-row') && t.textContent === '10');
        // Rendered y = the row-10 centre line nudged by the cap-height
        // baseline so the digit reads vertically centred in the cell.
        expect(Number(row10.getAttribute('y'))).toBe(10 * CELL_SIZE + CELL_SIZE / 2 + 4);
    });

    it('marks the legend aria-hidden (decorative chrome, copy stays the source of truth)', () => {
        const { container } = svgWrap(<CoordinateLegend gridSize={5} enabled />);
        expect(container.querySelector('.coord-legend')).toHaveAttribute('aria-hidden', 'true');
    });
});
