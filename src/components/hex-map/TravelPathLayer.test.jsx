// @maintained-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TravelPathLayer from './TravelPathLayer.jsx';
import { HEX_SIZE } from '../../config/outdoorConfig';
import { hexToPixel } from '../../services/maps/hexMapUtils.js';

// Oracle: this layer converts hexes with the plain hexToPixel(q, r, HEX_SIZE)
// it imports itself — build the expected point strings with that same real,
// un-mocked converter and compare bytes verbatim.
const pointsFor = (hexes) =>
    hexes.map(({ q, r }) => {
        const { x, y } = hexToPixel(q, r, HEX_SIZE);
        return `${x},${y}`;
    }).join(' ');

const centerOf = (hex) => hexToPixel(hex.q, hex.r, HEX_SIZE);

const defaultPath = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 1, r: 1 },
    { q: 0, r: 1 },
    { q: -1, r: 1 },
];

const renderLayer = (overrides = {}) =>
    render(<TravelPathLayer path={defaultPath} pathIndex={2} {...overrides} />);

const polylinesIn = (container) =>
    Array.from(container.querySelectorAll('g.travel-path-layer polyline'));

describe('TravelPathLayer', () => {
    it.each([
        ['null', null],
        ['undefined', undefined],
        ['an empty array', []],
    ])('renders nothing when path is %s', (_label, value) => {
        const { container } = render(<TravelPathLayer path={value} pathIndex={2} />);
        expect(container.querySelector('g.travel-path-layer')).not.toBeInTheDocument();
    });

    it('splits traversed vs remaining path exactly at pathIndex, verbatim vs the oracle', () => {
        const { container } = renderLayer();
        const layer = container.querySelector('g.travel-path-layer');
        expect(layer).toHaveAttribute('pointer-events', 'none');

        const polylines = polylinesIn(container);
        expect(polylines).toHaveLength(2);

        const [behind, ahead] = polylines;
        expect(behind).toHaveAttribute('points', pointsFor(defaultPath.slice(0, 2)));
        expect(behind).toHaveAttribute('stroke', '#FFD700');
        expect(behind).toHaveAttribute('stroke-width', '2');
        expect(behind).toHaveAttribute('stroke-opacity', '0.4');
        expect(behind).toHaveAttribute('stroke-dasharray', '4 3');

        expect(ahead).toHaveAttribute('points', pointsFor(defaultPath.slice(2)));
        expect(ahead).toHaveAttribute('stroke', '#FFD700');
        expect(ahead).toHaveAttribute('stroke-width', '3');
        expect(ahead).toHaveAttribute('stroke-opacity', '0.8');
        expect(ahead).toHaveAttribute('stroke-dasharray', '6 4');
    });

    it.each([0, 1, 3, 4])('marks the current position with a halo at the oracle center of path[%i]', (pathIndex) => {
        const { container } = renderLayer({ pathIndex });
        const oracle = centerOf(defaultPath[pathIndex]);
        const circle = container.querySelector('g.travel-path-layer circle');
        expect(circle).toBeInTheDocument();
        expect(circle).toHaveAttribute('cx', String(oracle.x));
        expect(circle).toHaveAttribute('cy', String(oracle.y));
        expect(circle).toHaveAttribute('r', String(HEX_SIZE * 0.6));
        expect(circle).toHaveAttribute('fill', 'rgba(255, 215, 0, 0.15)');
        expect(circle).toHaveAttribute('stroke', '#FFD700');
    });

    it.each([0, defaultPath.length, defaultPath.length + 1])(
        'keeps exactly one polyline across the whole progress range (pathIndex %i)',
        (pathIndex) => {
            const { container } = renderLayer({ pathIndex });
            const polylines = polylinesIn(container);
            expect(polylines).toHaveLength(1);

            if (pathIndex === 0) {
                expect(polylines[0]).toHaveAttribute('points', pointsFor(defaultPath));
                expect(polylines[0]).toHaveAttribute('stroke-opacity', '0.8');
                expect(container.querySelector('g.travel-path-layer circle')).toBeInTheDocument();
            } else {
                expect(polylines[0]).toHaveAttribute('points', pointsFor(defaultPath));
                expect(polylines[0]).toHaveAttribute('stroke-opacity', '0.4');
                expect(container.querySelector('g.travel-path-layer circle')).not.toBeInTheDocument();
            }
        }
    );

    it('anchors the destination marker on the oracle center of the last hex', () => {
        const { container } = renderLayer({ pathIndex: 0 });
        const oracle = centerOf(defaultPath[defaultPath.length - 1]);

        const rect = container.querySelector('g.travel-path-layer rect');
        expect(rect).toHaveAttribute('x', String(oracle.x - 18));
        expect(rect).toHaveAttribute('y', String(oracle.y - 18));
        expect(rect).toHaveAttribute('width', '36');
        expect(rect).toHaveAttribute('height', '36');
        expect(rect).toHaveAttribute('stroke-dasharray', '5 3');

        const label = screen.getByText('D');
        expect(label).toHaveAttribute('x', String(oracle.x));
    });

    it('renders a lone-hex path as one ahead point, halo, and destination at the same hex', () => {
        const hex = { q: 2, r: -1 };
        const { container } = render(<TravelPathLayer path={[hex]} pathIndex={0} />);
        const oracle = centerOf(hex);

        const polylines = polylinesIn(container);
        expect(polylines).toHaveLength(1);
        expect(polylines[0]).toHaveAttribute('points', `${oracle.x},${oracle.y}`);

        const circle = container.querySelector('g.travel-path-layer circle');
        expect(circle).toHaveAttribute('cx', String(oracle.x));
        expect(circle).toHaveAttribute('cy', String(oracle.y));

        const rect = container.querySelector('g.travel-path-layer rect');
        expect(rect).toHaveAttribute('x', String(oracle.x - 18));
    });
});
