// @maintained-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GridAndWalls from './GridAndWalls.jsx';

// GridAndWalls unit lane: square-map grid + wall cells rendered from map-data
// props, exact bytes. Pinned bytes assume CELL_SIZE === 40 (src/config/mapConfig.js).
// Distinct from hex-map GridLayer lanes (different component family — hex grid).
// Not owned (owner cited):
//   - mounted SVG, zoom/pan, wall click-editing .... Map.test.jsx / Map-tool-handlers.test.jsx
//   - fog shape rectangles ........................... FogOverlay.test.jsx
//   - placed items hidden under fog .................. PlacedItems-fog.test.jsx
// Old -> new map: bg fill custom/default + dims -> tests 1-2; line count +
// vertical/horizontal positions -> tests 2-3; wall count/positions/dims ->
// tests 4-5; fog localhost/filter -> test 6; new verbatim + re-render oracles.

const gridElement = (props) => (
    <svg>
        <GridAndWalls walls={new Set()} {...props} />
    </svg>
);

const renderComponent = (props) => render(gridElement(props));

const bgFact = (container) => {
    const rect = container.querySelector('rect.grid-bg');
    return {
        x: rect.getAttribute('x'),
        y: rect.getAttribute('y'),
        width: rect.getAttribute('width'),
        height: rect.getAttribute('height'),
    };
};

const lineFacts = (container) => Array.from(container.querySelectorAll('line.grid-line')).map((line) => ({
    x1: Number(line.getAttribute('x1')),
    y1: Number(line.getAttribute('y1')),
    x2: Number(line.getAttribute('x2')),
    y2: Number(line.getAttribute('y2')),
}));

const wallFacts = (container) => Array.from(container.querySelectorAll('rect.wall-cell')).map((rect) => ({
    x: Number(rect.getAttribute('x')),
    y: Number(rect.getAttribute('y')),
    width: Number(rect.getAttribute('width')),
    height: Number(rect.getAttribute('height')),
}));

describe('GridAndWalls', () => {
    it.each([
        { name: 'a custom color', bgFill: '#ff0000', expected: '#ff0000' },
        { name: 'undefined', bgFill: undefined, expected: '#1a1a1a' },
        { name: 'empty string', bgFill: '', expected: '#1a1a1a' },
    ])('paints the grid background $expected when bgFill is $name', ({ bgFill, expected }) => {
        const { container } = renderComponent({ gridSize: 2, bgFill });
        expect(container.querySelector('rect.grid-bg')).toHaveStyle({ fill: expected });
    });

    it.each([
        { gridSize: 1, size: 40, lines: 4 },
        { gridSize: 2, size: 80, lines: 6 },
        { gridSize: 20, size: 800, lines: 42 },
    ])('renders a $size px background and exactly $lines grid lines at gridSize=$gridSize', ({ gridSize, size, lines }) => {
        const { container } = renderComponent({ gridSize });
        const bg = container.querySelector('rect.grid-bg');
        expect(bg).toHaveAttribute('width', String(size));
        expect(bg).toHaveAttribute('height', String(size));
        expect(container.querySelectorAll('line.grid-line')).toHaveLength(lines);
    });

    it('renders grid geometry verbatim at gridSize=2', () => {
        const { container } = renderComponent({ gridSize: 2 });

        expect(bgFact(container)).toEqual({ x: '0', y: '0', width: '80', height: '80' });
        expect(lineFacts(container)).toEqual([
            { x1: 0, y1: 0, x2: 0, y2: 80 },
            { x1: 40, y1: 0, x2: 40, y2: 80 },
            { x1: 80, y1: 0, x2: 80, y2: 80 },
            { x1: 0, y1: 0, x2: 80, y2: 0 },
            { x1: 0, y1: 40, x2: 80, y2: 40 },
            { x1: 0, y1: 80, x2: 80, y2: 80 },
        ]);
    });

    it('renders wall cells verbatim from "gx,gy" keys', () => {
        const walls = new Set(['0,0', '2,1', '0,3']);
        const { container } = renderComponent({ gridSize: 4, walls });

        expect(wallFacts(container)).toEqual([
            { x: 0, y: 0, width: 40, height: 40 },
            { x: 80, y: 40, width: 40, height: 40 },
            { x: 0, y: 120, width: 40, height: 40 },
        ]);
    });

    it('renders an honest empty grid when walls is empty', () => {
        const { container } = renderComponent({ gridSize: 2, walls: new Set() });

        expect(container.querySelectorAll('rect.wall-cell')).toHaveLength(0);
        expect(container.querySelectorAll('line.grid-line')).toHaveLength(6);
        expect(container.querySelector('rect.grid-bg')).toBeInTheDocument();
    });

    it.each([
        { isLocalhost: true, fog: ['0,0'], expected: ['0,0', '80,0'] },
        { isLocalhost: false, fog: ['0,0'], expected: ['80,0'] },
        { isLocalhost: false, fog: undefined, expected: ['0,0', '80,0'] },
    ])('applies fog filter for isLocalhost=$isLocalhost', ({ isLocalhost, fog, expected }) => {
        const { container } = renderComponent({
            gridSize: 3,
            walls: new Set(['0,0', '2,0']),
            isLocalhost,
            fog: fog ? new Set(fog) : fog,
        });

        expect(wallFacts(container).map((r) => `${r.x},${r.y}`)).toEqual(expected);
    });

    it('re-renders grid and walls exactly when props change (no stale cells)', () => {
        const { container, rerender } = renderComponent({
            gridSize: 2,
            walls: new Set(['0,0']),
            isLocalhost: false,
            fog: new Set(['2,2']),
        });
        expect(container.querySelectorAll('line.grid-line')).toHaveLength(6);
        expect(wallFacts(container).map((r) => `${r.x},${r.y}`)).toEqual(['0,0']);

        rerender(gridElement({
            gridSize: 1,
            walls: new Set(['0,0', '1,1']),
            isLocalhost: true,
            fog: new Set(['0,0']),
        }));
        expect(container.querySelectorAll('line.grid-line')).toHaveLength(4);
        expect(wallFacts(container).map((r) => `${r.x},${r.y}`)).toEqual(['0,0', '40,40']);
    });
});
