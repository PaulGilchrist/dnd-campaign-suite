// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GridAndWalls from './GridAndWalls.jsx';
import { CELL_SIZE } from '../../config/mapConfig.js';

const DEFAULT_GRID_SIZE = 10;
const DEFAULT_WALLS = new Set(['0,0', '1,0', '0,1', '1,1']);

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
    describe('Grid background', () => {
        it('should apply inline fill style to grid background', () => {
            const customFill = '#ff0000';
            const { container } = renderComponent({ bgFill: customFill });
            const rect = container.querySelector('rect.grid-bg');
            // jsdom converts hex colors to rgb in the style attribute
            expect(rect.getAttribute('style')).toContain('rgb(255, 0, 0)');
        });

        it('should default to #1a1a1a fill when bgFill is not provided', () => {
            const { container } = renderComponent({ bgFill: undefined });
            const rect = container.querySelector('rect.grid-bg');
            expect(rect.getAttribute('style')).toContain('rgb(26, 26, 26)');
        });
    });

    describe('Grid lines', () => {
        it('should render correct number of grid lines', () => {
            const { container } = renderComponent();
            const allLines = container.querySelectorAll('line.grid-line');
            const expectedLines = (DEFAULT_GRID_SIZE + 1) * 2;
            expect(allLines.length).toBe(expectedLines);
        });

        it('should render correct number of grid lines for custom gridSize', () => {
            const customGridSize = 20;
            const { container } = renderComponent({ gridSize: customGridSize });
            const allLines = container.querySelectorAll('line.grid-line');
            const expectedLines = (customGridSize + 1) * 2;
            expect(allLines.length).toBe(expectedLines);
        });

        it('should render lines at correct positions', () => {
            const { container } = renderComponent();
            const allLines = container.querySelectorAll('line.grid-line');
            const vLines = Array.from(allLines).filter(line => line.getAttribute('x1') === line.getAttribute('x2'));
            const hLines = Array.from(allLines).filter(line => line.getAttribute('y1') === line.getAttribute('y2'));

            for (let i = 0; i <= DEFAULT_GRID_SIZE; i++) {
                const expectedPos = i * CELL_SIZE;
                const foundV = vLines.some(line => Number(line.getAttribute('x1')) === expectedPos);
                expect(foundV).toBe(true);
                const foundH = hLines.some(line => Number(line.getAttribute('y1')) === expectedPos);
                expect(foundH).toBe(true);
            }
        });
    });

    describe('Wall cells', () => {
        it('should render wall cells at correct grid positions with correct dimensions', () => {
            const { container } = renderComponent();
            const wallRects = container.querySelectorAll('rect.wall-cell');

            expect(wallRects.length).toBe(DEFAULT_WALLS.size);

            for (const wallKey of DEFAULT_WALLS) {
                const [gx, gy] = wallKey.split(',').map(Number);
                const expectedX = gx * CELL_SIZE;
                const expectedY = gy * CELL_SIZE;
                const found = Array.from(wallRects).some(
                    rect =>
                        Number(rect.getAttribute('x')) === expectedX &&
                        Number(rect.getAttribute('y')) === expectedY
                );
                expect(found).toBe(true);
            }

            wallRects.forEach(rect => {
                expect(rect).toHaveAttribute('width', String(CELL_SIZE));
                expect(rect).toHaveAttribute('height', String(CELL_SIZE));
            });
        });

        it('should render no walls when walls set is empty', () => {
            const { container } = renderComponent({ walls: new Set() });
            const wallRects = container.querySelectorAll('rect.wall-cell');
            expect(wallRects.length).toBe(0);
        });

        it('should filter out walls present in fog', () => {
            const fogWalls = new Set(['0,0', '1,0']);
            const { container } = renderComponent({
                isLocalhost: false,
                fog: fogWalls,
            });
            const wallRects = container.querySelectorAll('rect.wall-cell');
            const expectedWalls = DEFAULT_WALLS.size - fogWalls.size;
            expect(wallRects.length).toBe(expectedWalls);
        });

        it('should render no walls when all walls are fogged', () => {
            const fogWalls = new Set(['0,0', '1,0', '0,1', '1,1']);
            const { container } = renderComponent({
                isLocalhost: false,
                fog: fogWalls,
            });
            const wallRects = container.querySelectorAll('rect.wall-cell');
            expect(wallRects.length).toBe(0);
        });

        it('should render all walls when fog is undefined', () => {
            const { container } = renderComponent({ fog: undefined });
            const wallRects = container.querySelectorAll('rect.wall-cell');
            expect(wallRects.length).toBe(DEFAULT_WALLS.size);
        });
    });
});
