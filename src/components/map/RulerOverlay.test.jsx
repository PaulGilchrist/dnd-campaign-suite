import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RulerOverlay from './RulerOverlay.jsx';

const CELL_SIZE = 50;

const makeStart = (gx, gy) => ({ gridX: gx, gridY: gy });
const makeEnd = (gx, gy) => ({ gridX: gx, gridY: gy });

const rulerGroup = (container) => container.querySelector('.ruler-group');

describe('RulerOverlay', () => {
    it('should return null when start is not provided', () => {
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={undefined} end={undefined} cellSize={CELL_SIZE} />
            </svg>
        );
        expect(container.querySelector('.ruler-group')).toBeNull();
    });

    it('should return null when start is null', () => {
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={null} end={undefined} cellSize={CELL_SIZE} />
            </svg>
        );
        expect(container.querySelector('.ruler-group')).toBeNull();
    });

    it('should render a single point when only start is provided', () => {
        const start = makeStart(2, 3);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={undefined} cellSize={CELL_SIZE} />
            </svg>
        );
        const group = rulerGroup(container);
        expect(group).not.toBeNull();
        const circles = group.querySelectorAll('circle.ruler-point');
        expect(circles.length).toBe(1);
    });

    it('should render a single point circle at correct center position', () => {
        const start = makeStart(2, 3);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={undefined} cellSize={CELL_SIZE} />
            </svg>
        );
        const circle = container.querySelector('circle.ruler-point');
        const expectedCx = start.gridX * CELL_SIZE + CELL_SIZE / 2;
        const expectedCy = start.gridY * CELL_SIZE + CELL_SIZE / 2;
        expect(Number(circle.getAttribute('cx'))).toBe(expectedCx);
        expect(Number(circle.getAttribute('cy'))).toBe(expectedCy);
    });

    it('should render a single point circle with radius 4', () => {
        const start = makeStart(0, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={undefined} cellSize={CELL_SIZE} />
            </svg>
        );
        const circle = container.querySelector('circle.ruler-point');
        expect(circle.getAttribute('r')).toBe('4');
    });

    it('should render start and end points with a line when both start and end are provided', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(3, 4);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const group = rulerGroup(container);
        expect(group).not.toBeNull();
        const line = group.querySelector('line.ruler-line');
        expect(line).not.toBeNull();
        const circles = group.querySelectorAll('circle.ruler-point');
        expect(circles.length).toBe(2);
    });

    it('should render the ruler line from start center to end center', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(3, 4);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const line = container.querySelector('line.ruler-line');
        const expectedX1 = start.gridX * CELL_SIZE + CELL_SIZE / 2;
        const expectedY1 = start.gridY * CELL_SIZE + CELL_SIZE / 2;
        const expectedX2 = end.gridX * CELL_SIZE + CELL_SIZE / 2;
        const expectedY2 = end.gridY * CELL_SIZE + CELL_SIZE / 2;
        expect(Number(line.getAttribute('x1'))).toBe(expectedX1);
        expect(Number(line.getAttribute('y1'))).toBe(expectedY1);
        expect(Number(line.getAttribute('x2'))).toBe(expectedX2);
        expect(Number(line.getAttribute('y2'))).toBe(expectedY2);
    });

    it('should render start and end circles at correct positions', () => {
        const start = makeStart(1, 1);
        const end = makeEnd(4, 5);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const circles = container.querySelectorAll('circle.ruler-point');
        expect(circles.length).toBe(2);
        const expectedCx1 = start.gridX * CELL_SIZE + CELL_SIZE / 2;
        const expectedCy1 = start.gridY * CELL_SIZE + CELL_SIZE / 2;
        const expectedCx2 = end.gridX * CELL_SIZE + CELL_SIZE / 2;
        const expectedCy2 = end.gridY * CELL_SIZE + CELL_SIZE / 2;
        expect(Number(circles[0].getAttribute('cx'))).toBe(expectedCx1);
        expect(Number(circles[0].getAttribute('cy'))).toBe(expectedCy1);
        expect(Number(circles[1].getAttribute('cx'))).toBe(expectedCx2);
        expect(Number(circles[1].getAttribute('cy'))).toBe(expectedCy2);
    });

    it('should render a label group when both start and end are provided', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(2, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const labelGroup = container.querySelector('g.ruler-label');
        expect(labelGroup).not.toBeNull();
    });

    it('should render a label rect inside the label group', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(2, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const labelGroup = container.querySelector('g.ruler-label');
        const rect = labelGroup.querySelector('rect');
        expect(rect).not.toBeNull();
    });

    it('should render a label text inside the label group', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(2, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const labelGroup = container.querySelector('g.ruler-label');
        const text = labelGroup.querySelector('text');
        expect(text).not.toBeNull();
    });

    it('should label text be centered at midpoint', () => {
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

    it('should display distance in feet for 1 cell', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(1, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        expect(text.textContent).toContain('5 ft');
    });

    it('should display distance in feet for 2 cells', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(2, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        expect(text.textContent).toContain('10 ft');
    });

    it('should display distance in feet for 3 cells', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(3, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        expect(text.textContent).toContain('15 ft');
    });

    it('should display less than 1 cell for fractional distance', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(1, 1);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        // sqrt(2) ≈ 1.414, rounds to 1 cell, so should show "1 cell" not "<1"
        expect(text.textContent).toContain('1 cell');
    });

    it('should show singular "cell" for exactly 1 cell distance', () => {
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

    it('should show plural "cells" for more than 1 cell distance', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(3, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        expect(text.textContent).toContain('3 cells');
    });

    it('should show plural "cells" for 2 cell distance', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(2, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        expect(text.textContent).toContain('2 cells');
    });

    it('should render the correct label text format for 2 cells', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(2, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        expect(text.textContent).toBe('10 ft (2 cells)');
    });

    it('should render the correct label text format for 1 cell', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(1, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        expect(text.textContent).toBe('5 ft (1 cell)');
    });

    it('should render label rect with correct width based on text length', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(2, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        const label = text.textContent;
        const expectedWidth = label.length * 6.5 + 12;
        const labelGroup = container.querySelector('g.ruler-label');
        const rect = labelGroup.querySelector('rect');
        expect(Number(rect.getAttribute('width'))).toBe(expectedWidth);
    });

    it('should render label rect with height 18', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(2, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const labelGroup = container.querySelector('g.ruler-label');
        const rect = labelGroup.querySelector('rect');
        expect(Number(rect.getAttribute('height'))).toBe(18);
    });

    it('should render label rect with rx 3', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(2, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const labelGroup = container.querySelector('g.ruler-label');
        const rect = labelGroup.querySelector('rect');
        expect(Number(rect.getAttribute('rx'))).toBe(3);
    });

    it('should render label rect positioned above the midpoint', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(4, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        const labelGroup = container.querySelector('g.ruler-label');
        const rect = labelGroup.querySelector('rect');
        const textY = Number(text.getAttribute('y'));
        const rectY = Number(rect.getAttribute('y'));
        expect(rectY).toBe(textY - 13);
    });

    it('should render label rect centered horizontally on the midpoint', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(4, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        const labelGroup = container.querySelector('g.ruler-label');
        const rect = labelGroup.querySelector('rect');
        const textX = Number(text.getAttribute('x'));
        const rectX = Number(rect.getAttribute('x'));
        const rectWidth = Number(rect.getAttribute('width'));
        expect(rectX + rectWidth / 2).toBe(textX);
    });

    it('should render diagonal distance for non-axis-aligned ruler', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(3, 4);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        // sqrt(9 + 16) = 5, so 25 ft (5 cells)
        expect(text.textContent).toContain('25 ft');
        expect(text.textContent).toContain('5 cells');
    });

    it('should render diagonal distance with correct feet for 1,1', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(1, 1);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        // sqrt(2) ≈ 1.414, Math.round(1.414 * 5) = Math.round(7.07) = 7 ft
        expect(text.textContent).toContain('7 ft');
        expect(text.textContent).toContain('1 cell');
    });

    it('should use custom cellSize for calculations', () => {
        const start = makeStart(1, 1);
        const end = makeEnd(3, 1);
        const customCellSize = 40;
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={customCellSize} />
            </svg>
        );
        const line = container.querySelector('line.ruler-line');
        const expectedX1 = start.gridX * customCellSize + customCellSize / 2;
        const expectedX2 = end.gridX * customCellSize + customCellSize / 2;
        expect(Number(line.getAttribute('x1'))).toBe(expectedX1);
        expect(Number(line.getAttribute('x2'))).toBe(expectedX2);
    });

    it('should render the ruler-group class on the root group', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(2, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const group = container.querySelector('g.ruler-group');
        expect(group).not.toBeNull();
    });

    it('should render ruler-line with correct class', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(2, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const line = container.querySelector('line.ruler-line');
        expect(line).not.toBeNull();
    });

    it('should render ruler-point with correct class', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(2, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const circles = container.querySelectorAll('circle.ruler-point');
        expect(circles.length).toBe(2);
    });

    it('should render ruler-label with correct class', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(2, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const labelGroup = container.querySelector('g.ruler-label');
        expect(labelGroup).not.toBeNull();
    });

    it('should render zero-length ruler when start equals end', () => {
        const start = makeStart(2, 3);
        const end = makeEnd(2, 3);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const group = rulerGroup(container);
        expect(group).not.toBeNull();
        const line = group.querySelector('line.ruler-line');
        expect(line).not.toBeNull();
        expect(Number(line.getAttribute('x1'))).toBe(Number(line.getAttribute('x2')));
        expect(Number(line.getAttribute('y1'))).toBe(Number(line.getAttribute('y2')));
        const circles = group.querySelectorAll('circle.ruler-point');
        expect(circles.length).toBe(2);
    });

    it('should display 0 ft for zero-length ruler', () => {
        const start = makeStart(2, 3);
        const end = makeEnd(2, 3);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        expect(text.textContent).toContain('0 ft');
    });

    it('should display <1 for fractional cell distance less than 1', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(0, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        expect(text.textContent).toContain('<1');
    });

    it('should render negative grid positions correctly', () => {
        const start = makeStart(-2, -3);
        const end = makeEnd(0, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const line = container.querySelector('line.ruler-line');
        const expectedX1 = start.gridX * CELL_SIZE + CELL_SIZE / 2;
        const expectedY1 = start.gridY * CELL_SIZE + CELL_SIZE / 2;
        expect(Number(line.getAttribute('x1'))).toBe(expectedX1);
        expect(Number(line.getAttribute('y1'))).toBe(expectedY1);
    });

    it('should render large grid positions correctly', () => {
        const start = makeStart(20, 30);
        const end = makeEnd(25, 35);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const line = container.querySelector('line.ruler-line');
        const expectedX1 = start.gridX * CELL_SIZE + CELL_SIZE / 2;
        const expectedY1 = start.gridY * CELL_SIZE + CELL_SIZE / 2;
        const expectedX2 = end.gridX * CELL_SIZE + CELL_SIZE / 2;
        const expectedY2 = end.gridY * CELL_SIZE + CELL_SIZE / 2;
        expect(Number(line.getAttribute('x1'))).toBe(expectedX1);
        expect(Number(line.getAttribute('y1'))).toBe(expectedY1);
        expect(Number(line.getAttribute('x2'))).toBe(expectedX2);
        expect(Number(line.getAttribute('y2'))).toBe(expectedY2);
    });

    it('should render a single ruler-point when end is falsy', () => {
        const start = makeStart(5, 5);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={null} cellSize={CELL_SIZE} />
            </svg>
        );
        const circles = container.querySelectorAll('circle.ruler-point');
        expect(circles.length).toBe(1);
        const line = container.querySelector('line.ruler-line');
        expect(line).toBeNull();
        const labelGroup = container.querySelector('g.ruler-label');
        expect(labelGroup).toBeNull();
    });

    it('should render a single ruler-point when end is undefined', () => {
        const start = makeStart(5, 5);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={undefined} cellSize={CELL_SIZE} />
            </svg>
        );
        const circles = container.querySelectorAll('circle.ruler-point');
        expect(circles.length).toBe(1);
    });

    it('should render 3 cells distance correctly', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(3, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        expect(text.textContent).toBe('15 ft (3 cells)');
    });

    it('should render 4 cells distance correctly', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(4, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        expect(text.textContent).toBe('20 ft (4 cells)');
    });

    it('should render 5 cells distance correctly', () => {
        const start = makeStart(0, 0);
        const end = makeEnd(5, 0);
        const { container } = render(
            <svg width={500} height={500}>
                <RulerOverlay start={start} end={end} cellSize={CELL_SIZE} />
            </svg>
        );
        const text = container.querySelector('text');
        expect(text.textContent).toBe('25 ft (5 cells)');
    });
});
