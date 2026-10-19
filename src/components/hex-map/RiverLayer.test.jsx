// @maintained-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RiverLayer from './RiverLayer.jsx';
import { HEX_SIZE } from '../../config/outdoorConfig.js';
import { hexToPixel, buildWindingPathDescriptor } from '../../services/maps/hexMapUtils.js';

// Oracle discipline: expected geometry is DERIVED from the real converter, never
// hand-computed. Converter internals are owned by hexMapUtils.test.js — this file
// owns only that RiverLayer wires the converted output through verbatim, with the
// exact args it authors (HEX_SIZE, '#3A82D2', 2.5, wind 12) and exact styling bytes.
const windingOracle = (...hexes) =>
    buildWindingPathDescriptor(hexes, HEX_SIZE, '#3A82D2', 2.5, 12).path;

const fillAt = (container, q, r) => {
    const { x, y } = hexToPixel(q, r, HEX_SIZE);
    return [...container.querySelectorAll('g.river-layer circle')].find(circle =>
        circle.getAttribute('cx') === String(x) && circle.getAttribute('cy') === String(y)
    );
};

describe('RiverLayer', () => {
    const baseProps = {
        rivers: ['0,0', '1,0', '2,0'],
        hexCols: 10,
        hexRows: 10,
    };

    const renderLayer = (layerProps = {}) =>
        render(<RiverLayer {...baseProps} {...layerProps} />);

    const getPaths = (container) => container.querySelectorAll('g.river-layer path');
    const getFills = (container) => container.querySelectorAll('g.river-layer circle');

    it.each([
        { name: 'an empty array', rivers: [] },
        { name: 'null', rivers: null },
        { name: 'undefined', rivers: undefined },
    ])('renders nothing when rivers is $name', ({ rivers }) => {
        const { container } = renderLayer({ rivers });
        expect(container.querySelector('g.river-layer')).not.toBeInTheDocument();
    });

    it('renders a single winding path byte-identical to the real converter for a connected river', () => {
        const { container } = renderLayer();
        const paths = getPaths(container);
        expect(paths).toHaveLength(1);
        expect(paths[0].getAttribute('d')).toBe(
            windingOracle({ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 })
        );
    });

    it('applies the authored stroke styling to the winding path', () => {
        const { container } = renderLayer();
        const [path] = getPaths(container);
        expect(path).toHaveAttribute('stroke', '#3A82D2');
        expect(path).toHaveAttribute('stroke-width', '2.5');
        expect(path).toHaveAttribute('fill', 'none');
        expect(path).toHaveAttribute('stroke-linecap', 'round');
        expect(path).toHaveAttribute('stroke-linejoin', 'round');
    });

    it('places one soft-fill circle at the converted center of every river hex', () => {
        const { container } = renderLayer();
        expect(getFills(container)).toHaveLength(3);
        for (const q of [0, 1, 2]) {
            const fill = fillAt(container, q, 0);
            expect(fill).toBeTruthy();
            expect(fill).toHaveAttribute('r', '4');
            expect(fill).toHaveAttribute('fill', 'rgba(60, 130, 210, 0.35)');
        }
    });

    it('renders an isolated hex as a standalone circle with distinct styling and no path', () => {
        const { container } = renderLayer({ rivers: ['5,5'] });
        expect(getPaths(container)).toHaveLength(0);
        expect(getFills(container)).toHaveLength(1);
        const fill = fillAt(container, 5, 5);
        expect(fill).toBeTruthy();
        expect(fill).toHaveAttribute('r', '4');
        expect(fill).toHaveAttribute('fill', 'rgba(60, 130, 210, 0.45)');
    });

    it('renders disconnected chains as independent paths and fills', () => {
        const { container } = renderLayer({ rivers: ['0,0', '3,3', '4,3'] });
        const paths = getPaths(container);
        expect(paths).toHaveLength(1);
        expect(paths[0].getAttribute('d')).toBe(
            windingOracle({ q: 3, r: 3 }, { q: 4, r: 3 })
        );
        // The connected chain soft-fills; the isolated hex stands alone.
        expect(getFills(container)).toHaveLength(3);
        expect(fillAt(container, 3, 3)).toHaveAttribute('fill', 'rgba(60, 130, 210, 0.35)');
        expect(fillAt(container, 4, 3)).toHaveAttribute('fill', 'rgba(60, 130, 210, 0.35)');
        expect(fillAt(container, 0, 0)).toHaveAttribute('fill', 'rgba(60, 130, 210, 0.45)');
    });

    it('deduplicates repeated river keys', () => {
        const { container } = renderLayer({ rivers: ['0,0', '0,0', '1,0'] });
        const paths = getPaths(container);
        expect(paths).toHaveLength(1);
        expect(paths[0].getAttribute('d')).toBe(
            windingOracle({ q: 0, r: 0 }, { q: 1, r: 0 })
        );
        expect(getFills(container)).toHaveLength(2);
        expect(fillAt(container, 0, 0)).toBeTruthy();
        expect(fillAt(container, 1, 0)).toBeTruthy();
    });

    it('does not connect river hexes across the grid boundary', () => {
        const { container } = renderLayer({ rivers: ['0,0', '1,0'], hexCols: 1 });
        expect(getPaths(container)).toHaveLength(0);
        expect(getFills(container)).toHaveLength(2);
        expect(fillAt(container, 0, 0)).toHaveAttribute('fill', 'rgba(60, 130, 210, 0.45)');
    });
});
