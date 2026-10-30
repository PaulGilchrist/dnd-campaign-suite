// @maintained-by-ai: 2026-10-30
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RulerOverlay from './RulerOverlay.jsx';

const CELL_SIZE = 50;

const renderRuler = (start, end, cellSize = CELL_SIZE) => render(
    <svg width={500} height={500}>
        <RulerOverlay start={start} end={end} cellSize={cellSize} />
    </svg>
);

describe('RulerOverlay', () => {
    it('returns null when start is falsy', () => {
        const { container } = renderRuler(null, { gridX: 1, gridY: 1 });
        expect(container.querySelector('g.ruler-group')).not.toBeInTheDocument();
    });

    it('renders a single point with no line or label when end is null', () => {
        const { container } = renderRuler({ gridX: 2, gridY: 3 }, null);
        const group = container.querySelector('g.ruler-group');
        expect(group).toBeInTheDocument();
        expect(container.querySelectorAll('circle.ruler-point').length).toBe(1);
        expect(group.querySelector('line.ruler-line')).not.toBeInTheDocument();
        expect(group.querySelector('g.ruler-label')).not.toBeInTheDocument();
    });

    it('renders line, two points, and centered label with cell-center coordinates', () => {
        const { container } = renderRuler({ gridX: 0, gridY: 0 }, { gridX: 3, gridY: 4 });
        const line = container.querySelector('line.ruler-line');
        expect(line).toBeInTheDocument();
        expect(line).toHaveAttribute('x1', '25');
        expect(line).toHaveAttribute('y1', '25');
        expect(line).toHaveAttribute('x2', '175');
        expect(line).toHaveAttribute('y2', '225');
        expect(container.querySelectorAll('circle.ruler-point').length).toBe(2);

        const label = container.querySelector('g.ruler-label text');
        expect(label.textContent).toBe('25 ft (5 cells)');
        expect(label).toHaveAttribute('x', '100');
        expect(label).toHaveAttribute('y', '129');
    });

    it.each`
        start            | end              | expectedText
        ${{ gridX: 0, gridY: 0 }} | ${{ gridX: 1, gridY: 1 }} | ${'7 ft (1 cell)'}
        ${{ gridX: 0, gridY: 0 }} | ${{ gridX: 2, gridY: 0 }} | ${'10 ft (2 cells)'}
        ${{ gridX: -2, gridY: -1 }} | ${{ gridX: 1, gridY: 2 }} | ${'21 ft (4 cells)'}
        ${{ gridX: 2, gridY: 3 }} | ${{ gridX: 2, gridY: 3 }} | ${'0 ft (0 cells)'}
        ${{ gridX: 5, gridY: 5 }} | ${{ gridX: 5, gridY: 4 }} | ${'5 ft (1 cell)'}
        ${{ gridX: 0, gridY: 0 }} | ${{ gridX: 0, gridY: 4 }} | ${'20 ft (4 cells)'}
    `('displays "$expectedText"', ({ start, end, expectedText }) => {
        const { container } = renderRuler(start, end);
        expect(container.querySelector('g.ruler-label text').textContent).toBe(expectedText);
        expect(container.querySelector('g.ruler-label text').textContent).not.toContain('<1');
    });

    it('scales pixel positions with cellSize without changing the distance label', () => {
        const { container } = renderRuler({ gridX: 1, gridY: 1 }, { gridX: 2, gridY: 1 }, 40);
        const circles = container.querySelectorAll('circle.ruler-point');
        expect(circles[0]).toHaveAttribute('cx', '60');
        expect(circles[1]).toHaveAttribute('cx', '100');
        expect(container.querySelector('g.ruler-label text').textContent).toBe('5 ft (1 cell)');
    });
});
