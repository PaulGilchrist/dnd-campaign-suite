import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GridAndWalls from './GridAndWalls.jsx';
import { CELL_SIZE } from '../../config/mapConfig.js';

const DEFAULT_GRID_SIZE = 10;
const DEFAULT_WALLS = new Set(['0,0', '1,0', '0,1', '1,1']);

const getWallRects = (container) => container.querySelectorAll('rect.wall-cell');
const getGridLines = (container) => container.querySelectorAll('line.grid-line');
const getGridBg = (container) => container.querySelector('rect.grid-bg');

const renderComponent = (props) =>
    render(
        <svg width={DEFAULT_GRID_SIZE * CELL_SIZE} height={DEFAULT_GRID_SIZE * CELL_SIZE}>
            <GridAndWalls
                gridSize={DEFAULT_GRID_SIZE}
                walls={DEFAULT_WALLS}
                isLocalhost={true}
                fog={undefined}
                bgFill={'#1a1a1a'}
                {...props}
            />
        </svg>
    );

describe('GridAndWalls', () => {
    describe('grid background', () => {
        it('should apply custom fill color to grid background', () => {
            const customFill = '#ff0000';
            const { container } = renderComponent({ bgFill: customFill });
            const rect = getGridBg(container);
            expect(rect).toHaveStyle({ fill: customFill });
        });

        it('should default to #1a1a1a when bgFill is falsy', () => {
            const { container } = renderComponent({ bgFill: undefined });
            const rect = getGridBg(container);
            expect(rect).toHaveStyle({ fill: '#1a1a1a' });
        });

        it('should have correct width and height matching gridSize * CELL_SIZE', () => {
            const customGridSize = 20;
            const { container } = renderComponent({ gridSize: customGridSize });
            const rect = getGridBg(container);
            const expectedSize = customGridSize * CELL_SIZE;
            expect(rect).toHaveAttribute('width', String(expectedSize));
            expect(rect).toHaveAttribute('height', String(expectedSize));
        });
    });

    describe('grid lines', () => {
        it('should render correct number of grid lines for a given gridSize', () => {
            const customGridSize = 20;
            const { container } = renderComponent({ gridSize: customGridSize });
            expect(getGridLines(container).length).toBe((customGridSize + 1) * 2);
        });

        it('should render vertical lines at correct x positions', () => {
            const customGridSize = 5;
            const { container } = renderComponent({ gridSize: customGridSize });
            const lines = getGridLines(container);

            const verticalLines = Array.from(lines).filter((line) =>
                line.getAttribute('x1') === line.getAttribute('x2')
            );

            const xPositions = verticalLines.map((line) => Number(line.getAttribute('x1')));
            const expectedPositions = Array.from({ length: customGridSize + 1 }, (_, i) => i * CELL_SIZE);
            expect(xPositions).toEqual(expectedPositions);
        });

        it('should render horizontal lines at correct y positions', () => {
            const customGridSize = 5;
            const { container } = renderComponent({ gridSize: customGridSize });
            const lines = getGridLines(container);

            const horizontalLines = Array.from(lines).filter((line) =>
                line.getAttribute('y1') === line.getAttribute('y2')
            );

            const yPositions = horizontalLines.map((line) => Number(line.getAttribute('y1')));
            const expectedPositions = Array.from({ length: customGridSize + 1 }, (_, i) => i * CELL_SIZE);
            expect(yPositions).toEqual(expectedPositions);
        });
    });

    describe('wall cells', () => {
        it('should render wall cells for each wall in the set', () => {
            const { container } = renderComponent();
            expect(getWallRects(container).length).toBe(DEFAULT_WALLS.size);
        });

        it('should render no wall cells when walls is an empty set', () => {
            const { container } = renderComponent({ walls: new Set() });
            expect(getWallRects(container).length).toBe(0);
        });

        it('should position wall rects at correct pixel coordinates based on grid keys', () => {
            const walls = new Set(['0,0', '1,0', '0,1']);
            const { container } = renderComponent({ walls });
            const rects = getWallRects(container);

            const positions = Array.from(rects).map((rect) => ({
                x: Number(rect.getAttribute('x')),
                y: Number(rect.getAttribute('y')),
            }));

            expect(positions).toContainEqual({ x: 0, y: 0 });
            expect(positions).toContainEqual({ x: CELL_SIZE, y: 0 });
            expect(positions).toContainEqual({ x: 0, y: CELL_SIZE });
        });

        it('should render wall rects with correct dimensions matching CELL_SIZE', () => {
            const { container } = renderComponent();
            getWallRects(container).forEach((rect) => {
                expect(rect).toHaveAttribute('width', String(CELL_SIZE));
                expect(rect).toHaveAttribute('height', String(CELL_SIZE));
            });
        });

        it('should not filter walls when isLocalhost is true even with fog present', () => {
            const fogWalls = new Set(['0,0', '1,0']);
            const { container } = renderComponent({
                isLocalhost: true,
                fog: fogWalls,
            });
            expect(getWallRects(container).length).toBe(DEFAULT_WALLS.size);
        });

        it('should filter out walls present in fog when not on localhost', () => {
            const fogWalls = new Set(['0,0', '1,0']);
            const { container } = renderComponent({
                isLocalhost: false,
                fog: fogWalls,
            });
            expect(getWallRects(container).length).toBe(DEFAULT_WALLS.size - fogWalls.size);
        });
    });
});
