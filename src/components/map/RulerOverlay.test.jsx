import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RulerOverlay from './RulerOverlay.jsx';

const CELL_SIZE = 50;
const makeStart = (gx, gy) => ({ gridX: gx, gridY: gy });
const makeEnd = (gx, gy) => ({ gridX: gx, gridY: gy });

describe('RulerOverlay', () => {
    describe('falsy inputs', () => {
        it('returns null when start is falsy', () => {
            expect(RulerOverlay({ start: null, end: { gridX: 1, gridY: 1 }, cellSize: CELL_SIZE })).toBeNull();
        });
    });

    describe('single point (end is null)', () => {
        it('renders a group with exactly one circle and no line or label', () => {
            const start = makeStart(2, 3);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={null} cellSize={CELL_SIZE} />
                </svg>
            );
            const group = container.querySelector('g.ruler-group');
            expect(group).toBeInTheDocument();
            const circles = container.querySelectorAll('circle.ruler-point');
            expect(circles.length).toBe(1);
            expect(group.querySelector('line.ruler-line')).not.toBeInTheDocument();
            expect(group.querySelector('g.ruler-label')).not.toBeInTheDocument();
        });
    });

    describe('ruler with start and end', () => {
        it('renders line, two points, and label group with correct coordinates', () => {
            const start = makeStart(0, 0);
            const end = makeEnd(3, 4);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            const group = container.querySelector('g.ruler-group');
            expect(group).toBeInTheDocument();

            const line = container.querySelector('line.ruler-line');
            expect(line).toBeInTheDocument();

            const circles = container.querySelectorAll('circle.ruler-point');
            expect(circles.length).toBe(2);

            const label = container.querySelector('g.ruler-label');
            expect(label).toBeInTheDocument();
            const text = label.querySelector('text');
            expect(text.textContent).toBe('25 ft (5 cells)');
        });

        it.each`
            start      | end        | expectedText
            ${makeStart(0, 0)}  | ${makeEnd(1, 0)}   | ${'5 ft (1 cell)'}
            ${makeStart(0, 0)}  | ${makeEnd(2, 0)}   | ${'10 ft (2 cells)'}
            ${makeStart(0, 0)}  | ${makeEnd(3, 0)}   | ${'15 ft (3 cells)'}
            ${makeStart(0, 0)}  | ${makeEnd(4, 0)}   | ${'20 ft (4 cells)'}
            ${makeStart(0, 0)}  | ${makeEnd(5, 0)}   | ${'25 ft (5 cells)'}
            ${makeStart(0, 0)}  | ${makeEnd(1, 1)}   | ${'7 ft (1 cell)'}
            ${makeStart(0, 0)}  | ${makeEnd(3, 4)}   | ${'25 ft (5 cells)'}
        `('displays "$expectedText"', ({ start, end, expectedText }) => {
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            const label = container.querySelector('g.ruler-label');
            const text = label.querySelector('text');
            expect(text.textContent).toBe(expectedText);
        });

        it('handles negative grid coordinates', () => {
            const start = makeStart(-2, -1);
            const end = makeEnd(1, 2);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            const line = container.querySelector('line.ruler-line');
            expect(line).toBeInTheDocument();
            const label = container.querySelector('g.ruler-label');
            const text = label.querySelector('text');
            expect(text.textContent).toBe('21 ft (4 cells)');
        });

        it('uses different cellSize for coordinate calculations', () => {
            const start = makeStart(1, 1);
            const end = makeEnd(2, 1);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={40} />
                </svg>
            );
            const label = container.querySelector('g.ruler-label');
            const text = label.querySelector('text');
            expect(text.textContent).toBe('5 ft (1 cell)');
        });

        it('displays 0 ft when start and end are identical', () => {
            const point = makeStart(2, 3);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={point} end={point} cellSize={CELL_SIZE} />
                </svg>
            );
            const label = container.querySelector('g.ruler-label');
            const text = label.querySelector('text');
            expect(text.textContent).toBe('0 ft (<1 cells)');
        });
    });
});
