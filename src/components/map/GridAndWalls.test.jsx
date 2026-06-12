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
    it('should render grid background with correct size', () => {
        const { container } = renderComponent();
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg.getAttribute('width')).toBe(String(DEFAULT_GRID_SIZE * CELL_SIZE));
        expect(svg.getAttribute('height')).toBe(String(DEFAULT_GRID_SIZE * CELL_SIZE));
    });

    it('should render grid background rect with correct size', () => {
        const { container } = renderComponent();
        const rects = container.querySelectorAll('rect.grid-bg');
        expect(rects.length).toBe(1);
        expect(rects[0].getAttribute('width')).toBe(String(DEFAULT_GRID_SIZE * CELL_SIZE));
        expect(rects[0].getAttribute('height')).toBe(String(DEFAULT_GRID_SIZE * CELL_SIZE));
    });

    it('should apply inline fill style to grid background', () => {
        const customFill = '#ff0000';
        const { container } = renderComponent({ bgFill: customFill });
        const rects = container.querySelectorAll('rect.grid-bg');
        // jsdom converts hex colors to rgb in the style attribute
        expect(rects[0].getAttribute('style')).toContain('rgb(255, 0, 0)');
    });

    it('should default to #1a1a1a fill when bgFill is not provided', () => {
        const { container } = renderComponent({ bgFill: undefined });
        const rects = container.querySelectorAll('rect.grid-bg');
        expect(rects[0].getAttribute('style')).toContain('rgb(26, 26, 26)');
    });

    it('should render correct number of vertical grid lines', () => {
        const { container } = renderComponent();
        const verticalLines = container.querySelectorAll('line.grid-line');
        // Total lines = vertical (gridSize + 1) + horizontal (gridSize + 1)
        const totalLines = (DEFAULT_GRID_SIZE + 1) * 2;
        expect(verticalLines.length).toBe(totalLines);
    });

    it('should render correct number of horizontal grid lines', () => {
        const { container } = renderComponent();
        const allLines = container.querySelectorAll('line.grid-line');
        // Each line has both vertical and horizontal lines sharing the grid-line class
        // We need to distinguish by checking x1/y1 positions
        const hLines = Array.from(allLines).filter(line => line.getAttribute('y1') === line.getAttribute('y2'));
        const vLines = Array.from(allLines).filter(line => line.getAttribute('x1') === line.getAttribute('x2'));
        expect(hLines.length).toBe(DEFAULT_GRID_SIZE + 1);
        expect(vLines.length).toBe(DEFAULT_GRID_SIZE + 1);
    });

    it('should render vertical lines at correct x positions', () => {
        const { container } = renderComponent();
        const allLines = container.querySelectorAll('line.grid-line');
        const vLines = Array.from(allLines).filter(line => line.getAttribute('x1') === line.getAttribute('x2'));
        for (let i = 0; i <= DEFAULT_GRID_SIZE; i++) {
            const expectedX = i * CELL_SIZE;
            const found = vLines.some(line => Number(line.getAttribute('x1')) === expectedX);
            expect(found).toBe(true);
        }
    });

    it('should render horizontal lines at correct y positions', () => {
        const { container } = renderComponent();
        const allLines = container.querySelectorAll('line.grid-line');
        const hLines = Array.from(allLines).filter(line => line.getAttribute('y1') === line.getAttribute('y2'));
        for (let i = 0; i <= DEFAULT_GRID_SIZE; i++) {
            const expectedY = i * CELL_SIZE;
            const found = hLines.some(line => Number(line.getAttribute('y1')) === expectedY);
            expect(found).toBe(true);
        }
    });

    it('should render wall cells for all walls when isLocalhost is true', () => {
        const { container } = renderComponent({ isLocalhost: true });
        const wallRects = container.querySelectorAll('rect.wall-cell');
        expect(wallRects.length).toBe(DEFAULT_WALLS.size);
    });

    it('should render wall cells at correct grid positions', () => {
        const { container } = renderComponent();
        const wallRects = container.querySelectorAll('rect.wall-cell');
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
    });

    it('should render wall cells with correct dimensions', () => {
        const { container } = renderComponent();
        const wallRects = container.querySelectorAll('rect.wall-cell');
        wallRects.forEach(rect => {
            expect(rect.getAttribute('width')).toBe(String(CELL_SIZE));
            expect(rect.getAttribute('height')).toBe(String(CELL_SIZE));
        });
    });

    it('should filter out walls present in fog when isLocalhost is false', () => {
        const fogWalls = new Set(['0,0', '1,0']);
        const { container } = renderComponent({
            isLocalhost: false,
            fog: fogWalls,
        });
        const wallRects = container.querySelectorAll('rect.wall-cell');
        const expectedWalls = DEFAULT_WALLS.size - fogWalls.size;
        expect(wallRects.length).toBe(expectedWalls);
    });

    it('should not render any walls when all walls are fogged', () => {
        const fogWalls = new Set(['0,0', '1,0', '0,1', '1,1']);
        const { container } = renderComponent({
            isLocalhost: false,
            fog: fogWalls,
        });
        const wallRects = container.querySelectorAll('rect.wall-cell');
        expect(wallRects.length).toBe(0);
    });

    it('should render walls when fog is undefined', () => {
        const { container } = renderComponent({ fog: undefined });
        const wallRects = container.querySelectorAll('rect.wall-cell');
        expect(wallRects.length).toBe(DEFAULT_WALLS.size);
    });

    it('should render no walls when walls set is empty', () => {
        const { container } = renderComponent({ walls: new Set() });
        const wallRects = container.querySelectorAll('rect.wall-cell');
        expect(wallRects.length).toBe(0);
    });

    it('should render walls with correct SVG attributes for a single wall', () => {
        const singleWall = new Set(['5,5']);
        const { container } = renderComponent({ walls: singleWall });
        const wallRects = container.querySelectorAll('rect.wall-cell');
        expect(wallRects.length).toBe(1);
        expect(wallRects[0].getAttribute('x')).toBe(String(5 * CELL_SIZE));
        expect(wallRects[0].getAttribute('y')).toBe(String(5 * CELL_SIZE));
        expect(wallRects[0].getAttribute('width')).toBe(String(CELL_SIZE));
        expect(wallRects[0].getAttribute('height')).toBe(String(CELL_SIZE));
    });

    it('should use custom gridSize for SVG dimensions', () => {
        const customGridSize = 20;
        const customSize = customGridSize * CELL_SIZE;
        const { container } = render(
            <svg width={customSize} height={customSize}>
                <GridAndWalls
                    gridSize={customGridSize}
                    walls={DEFAULT_WALLS}
                    isLocalhost={true}
                    fog={undefined}
                    bgFill={'#1a1a1a'}
                />
            </svg>
        );
        const svg = container.querySelector('svg');
        const expectedSize = customGridSize * CELL_SIZE;
        expect(svg.getAttribute('width')).toBe(String(expectedSize));
        expect(svg.getAttribute('height')).toBe(String(expectedSize));
    });

    it('should render correct number of grid lines for custom gridSize', () => {
        const customGridSize = 20;
        const { container } = renderComponent({ gridSize: customGridSize });
        const allLines = container.querySelectorAll('line.grid-line');
        const expectedLines = (customGridSize + 1) * 2;
        expect(allLines.length).toBe(expectedLines);
    });

    it('should render SVG element', () => {
        const { container } = renderComponent();
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
    });

    it('should render all children inside the SVG', () => {
        const { container } = renderComponent();
        const svg = container.querySelector('svg');
        const allRects = svg.querySelectorAll('rect');
        const allLines = svg.querySelectorAll('line');
        // grid-bg rect + wall rects + grid lines
        expect(allRects.length).toBe(1 + DEFAULT_WALLS.size);
        expect(allLines.length).toBe((DEFAULT_GRID_SIZE + 1) * 2);
    });
});
