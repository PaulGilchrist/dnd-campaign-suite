// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RulerOverlay from './RulerOverlay.jsx';

const CELL_SIZE = 50;
const makeStart = (gx, gy) => ({ gridX: gx, gridY: gy });
const makeEnd = (gx, gy) => ({ gridX: gx, gridY: gy });

describe('RulerOverlay', () => {
    describe('falsy inputs', () => {
        it('returns null when start is falsy', () => {
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={null} end={undefined} cellSize={CELL_SIZE} />
                </svg>
            );
            expect(container.querySelector('.ruler-group')).toBeNull();
        });

        it('renders a single point when end is null', () => {
            const start = makeStart(2, 3);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={null} cellSize={CELL_SIZE} />
                </svg>
            );
            const circles = container.querySelectorAll('circle.ruler-point');
            expect(circles.length).toBe(1);
            expect(container.querySelector('line.ruler-line')).toBeNull();
            expect(container.querySelector('g.ruler-label')).toBeNull();
        });
    });

    describe('ruler with start and end', () => {
        it('renders line, two points, and label group', () => {
            const start = makeStart(0, 0);
            const end = makeEnd(3, 4);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            expect(container.querySelector('.ruler-group')).toBeInTheDocument();
            expect(container.querySelector('line.ruler-line')).toBeInTheDocument();
            const circles = container.querySelectorAll('circle.ruler-point');
            expect(circles.length).toBeGreaterThanOrEqual(2);
            expect(container.querySelector('g.ruler-label')).toBeInTheDocument();
        });
    });

    describe('label text content', () => {
        it.each`
            cells | expectedText
            ${1}  | ${'5 ft (1 cell)'}
            ${2}  | ${'10 ft (2 cells)'}
            ${3}  | ${'15 ft (3 cells)'}
            ${4}  | ${'20 ft (4 cells)'}
            ${5}  | ${'25 ft (5 cells)'}
        `('displays "$expectedText" for $cells cells', ({ cells, expectedText }) => {
            const start = makeStart(0, 0);
            const end = makeEnd(cells, 0);
            render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            expect(screen.getByText(expectedText)).toBeInTheDocument();
        });

        it('displays 0 ft for zero-length ruler', () => {
            const start = makeStart(2, 3);
            const end = makeEnd(2, 3);
            render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            expect(screen.getByText(/0 ft/)).toBeInTheDocument();
        });

        it('shows singular "cell" for exactly 1 cell distance', () => {
            const start = makeStart(0, 0);
            const end = makeEnd(1, 0);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            const text = container.querySelector('text');
            expect(text.textContent).toContain('1 cell');
            expect(text.textContent).not.toContain('cells');
        });
    });

    describe('diagonal distances', () => {
        it('renders diagonal distance for 3,4 (5 cells, 25 ft)', () => {
            const start = makeStart(0, 0);
            const end = makeEnd(3, 4);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            const text = container.querySelector('text');
            expect(text.textContent).toContain('25 ft');
            expect(text.textContent).toContain('5 cells');
        });

        it('renders diagonal distance for 1,1 (7 ft, 1 cell)', () => {
            const start = makeStart(0, 0);
            const end = makeEnd(1, 1);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            const text = container.querySelector('text');
            expect(text.textContent).toContain('7 ft');
            expect(text.textContent).toContain('1 cell');
        });
    });
});
