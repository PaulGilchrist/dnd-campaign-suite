// @cleaned-by-ai
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
        it('should apply custom fill color to grid background', () => {
            const customFill = '#ff0000';
            const { container } = renderComponent({ bgFill: customFill });
            const rect = container.querySelector('rect.grid-bg');
            expect(rect.getAttribute('style')).toContain('rgb(255, 0, 0)');
        });
    });

    describe('Grid lines', () => {
        it('should render correct number of grid lines for a given gridSize', () => {
            const customGridSize = 20;
            const { container } = renderComponent({ gridSize: customGridSize });
            const allLines = container.querySelectorAll('line.grid-line');
            expect(allLines.length).toBe((customGridSize + 1) * 2);
        });
    });

    describe('Wall cells', () => {
        it('should render wall cells for each wall in the set', () => {
            const { container } = renderComponent();
            const wallRects = container.querySelectorAll('rect.wall-cell');
            expect(wallRects.length).toBe(DEFAULT_WALLS.size);
        });

        it('should filter out walls present in fog when not on localhost', () => {
            const fogWalls = new Set(['0,0', '1,0']);
            const { container } = renderComponent({
                isLocalhost: false,
                fog: fogWalls,
            });
            const wallRects = container.querySelectorAll('rect.wall-cell');
            expect(wallRects.length).toBe(DEFAULT_WALLS.size - fogWalls.size);
        });
    });
});
