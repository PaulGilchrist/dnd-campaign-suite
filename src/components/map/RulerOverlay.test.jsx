// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RulerOverlay from './RulerOverlay.jsx';

const CELL_SIZE = 50;
const makeStart = (gx, gy) => ({ gridX: gx, gridY: gy });
const makeEnd = (gx, gy) => ({ gridX: gx, gridY: gy });

describe('RulerOverlay', () => {
    describe('null/undefined start', () => {
        it('returns null when start is falsy', () => {
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={null} end={undefined} cellSize={CELL_SIZE} />
                </svg>
            );
            expect(container.querySelector('.ruler-group')).toBeNull();
        });
    });

    describe('single point (no end)', () => {
        it('renders a single ruler-point circle at the correct grid position', () => {
            const start = makeStart(2, 3);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={undefined} cellSize={CELL_SIZE} />
                </svg>
            );
            expect(container.querySelector('.ruler-group')).toBeInTheDocument();
            const circles = container.querySelectorAll('circle.ruler-point');
            expect(circles.length).toBe(1);
            const circle = circles[0];
            expect(Number(circle.getAttribute('cx'))).toBe(start.gridX * CELL_SIZE + CELL_SIZE / 2);
            expect(Number(circle.getAttribute('cy'))).toBe(start.gridY * CELL_SIZE + CELL_SIZE / 2);
            expect(circle.getAttribute('r')).toBe('4');
        });

        it('renders a single ruler-point when end is null', () => {
            const start = makeStart(5, 5);
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

        it('renders the line from start center to end center', () => {
            const start = makeStart(0, 0);
            const end = makeEnd(3, 4);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            const line = container.querySelector('line.ruler-line');
            expect(Number(line.getAttribute('x1'))).toBe(start.gridX * CELL_SIZE + CELL_SIZE / 2);
            expect(Number(line.getAttribute('y1'))).toBe(start.gridY * CELL_SIZE + CELL_SIZE / 2);
            expect(Number(line.getAttribute('x2'))).toBe(end.gridX * CELL_SIZE + CELL_SIZE / 2);
            expect(Number(line.getAttribute('y2'))).toBe(end.gridY * CELL_SIZE + CELL_SIZE / 2);
        });

        it('renders circles at correct start and end positions', () => {
            const start = makeStart(1, 1);
            const end = makeEnd(4, 5);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            const circles = container.querySelectorAll('circle.ruler-point');
            expect(circles.length).toBeGreaterThanOrEqual(2);
            expect(Number(circles[0].getAttribute('cx'))).toBe(start.gridX * CELL_SIZE + CELL_SIZE / 2);
            expect(Number(circles[0].getAttribute('cy'))).toBe(start.gridY * CELL_SIZE + CELL_SIZE / 2);
            expect(Number(circles[1].getAttribute('cx'))).toBe(end.gridX * CELL_SIZE + CELL_SIZE / 2);
            expect(Number(circles[1].getAttribute('cy'))).toBe(end.gridY * CELL_SIZE + CELL_SIZE / 2);
        });

        it('centers label text at midpoint', () => {
            const start = makeStart(0, 0);
            const end = makeEnd(4, 0);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            const text = container.querySelector('text');
            const expectedMx = (start.gridX * CELL_SIZE + CELL_SIZE / 2 + end.gridX * CELL_SIZE + CELL_SIZE / 2) / 2;
            expect(Number(text.getAttribute('x'))).toBe(expectedMx);
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

        it('displays <1 cell for zero-length ruler', () => {
            const start = makeStart(0, 0);
            const end = makeEnd(0, 0);
            render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            expect(screen.getByText(/<1/)).toBeInTheDocument();
        });

        it('displays less than 1 cell for fractional distance', () => {
            const start = makeStart(0, 0);
            const end = makeEnd(1, 1);
            render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            expect(screen.getByText(/1 cell/)).toBeInTheDocument();
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

        it('shows plural "cells" for more than 1 cell distance', () => {
            const start = makeStart(0, 0);
            const end = makeEnd(3, 0);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            const text = container.querySelector('text');
            expect(text.textContent).toContain('cells');
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

    describe('zero-length ruler', () => {
        it('renders line and two overlapping circles when start equals end', () => {
            const start = makeStart(2, 3);
            const end = makeEnd(2, 3);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            expect(container.querySelector('.ruler-group')).toBeInTheDocument();
            const line = container.querySelector('line.ruler-line');
            expect(line).toBeInTheDocument();
            expect(Number(line.getAttribute('x1'))).toBe(Number(line.getAttribute('x2')));
            expect(Number(line.getAttribute('y1'))).toBe(Number(line.getAttribute('y2')));
            const circles = container.querySelectorAll('circle.ruler-point');
            expect(circles.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('grid position edge cases', () => {
        it('renders negative grid positions correctly', () => {
            const start = makeStart(-2, -3);
            const end = makeEnd(0, 0);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            const line = container.querySelector('line.ruler-line');
            expect(Number(line.getAttribute('x1'))).toBe(start.gridX * CELL_SIZE + CELL_SIZE / 2);
            expect(Number(line.getAttribute('y1'))).toBe(start.gridY * CELL_SIZE + CELL_SIZE / 2);
        });

        it('renders large grid positions correctly', () => {
            const start = makeStart(20, 30);
            const end = makeEnd(25, 35);
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
                </svg>
            );
            const line = container.querySelector('line.ruler-line');
            expect(Number(line.getAttribute('x1'))).toBe(start.gridX * CELL_SIZE + CELL_SIZE / 2);
            expect(Number(line.getAttribute('y1'))).toBe(start.gridY * CELL_SIZE + CELL_SIZE / 2);
            expect(Number(line.getAttribute('x2'))).toBe(end.gridX * CELL_SIZE + CELL_SIZE / 2);
            expect(Number(line.getAttribute('y2'))).toBe(end.gridY * CELL_SIZE + CELL_SIZE / 2);
        });
    });

    describe('custom cellSize', () => {
        it('uses custom cellSize for line coordinates', () => {
            const start = makeStart(1, 1);
            const end = makeEnd(3, 1);
            const customCellSize = 40;
            const { container } = render(
                <svg width={500} height={500}>
                    <RulerOverlay start={start} end={end} cellSize={customCellSize} />
                </svg>
            );
            const line = container.querySelector('line.ruler-line');
            expect(Number(line.getAttribute('x1'))).toBe(start.gridX * customCellSize + customCellSize / 2);
            expect(Number(line.getAttribute('x2'))).toBe(end.gridX * customCellSize + customCellSize / 2);
        });
    });
});
