import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TravelPathLayer from './TravelPathLayer.jsx';

const defaultPath = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 1, r: 1 },
    { q: 0, r: 1 },
    { q: -1, r: 1 },
];

const renderLayer = (overrides = {}) =>
    render(<TravelPathLayer path={defaultPath} pathIndex={2} {...overrides} />);

describe('TravelPathLayer', () => {
    describe('null/empty path handling', () => {
        it.each([
            ['null', null],
            ['undefined', undefined],
            ['an empty array', []],
        ])('returns null when path is %s', (_label, value) => {
            const { container } = render(<TravelPathLayer path={value} pathIndex={2} />);
            expect(container.querySelector('g.travel-path-layer')).not.toBeInTheDocument();
        });
    });

    describe('layer structure', () => {
        it('renders a non-interactive travel-path-layer group', () => {
            const { container } = renderLayer();
            const layer = container.querySelector('g.travel-path-layer');
            expect(layer).toBeInTheDocument();
            expect(layer).toHaveAttribute('pointer-events', 'none');
        });
    });

    describe('path polylines', () => {
        it('renders the behind polyline with reduced opacity and dashed style', () => {
            const { container } = renderLayer();
            const layer = container.querySelector('g.travel-path-layer');
            const polylines = layer.querySelectorAll('polyline');
            const behindPolyline = polylines[0];
            expect(behindPolyline).toHaveAttribute('stroke', '#FFD700');
            expect(behindPolyline).toHaveAttribute('stroke-width', '2');
            expect(behindPolyline).toHaveAttribute('stroke-opacity', '0.4');
            expect(behindPolyline).toHaveAttribute('stroke-dasharray', '4 3');
        });

        it('renders the ahead polyline with full opacity and dashed style', () => {
            const { container } = renderLayer();
            const layer = container.querySelector('g.travel-path-layer');
            const polylines = layer.querySelectorAll('polyline');
            const aheadPolyline = polylines[1];
            expect(aheadPolyline).toHaveAttribute('stroke', '#FFD700');
            expect(aheadPolyline).toHaveAttribute('stroke-width', '3');
            expect(aheadPolyline).toHaveAttribute('stroke-opacity', '0.8');
            expect(aheadPolyline).toHaveAttribute('stroke-dasharray', '6 4');
        });

        it('omits the behind polyline when pathIndex is 0', () => {
            const { container } = renderLayer({ pathIndex: 0 });
            const layer = container.querySelector('g.travel-path-layer');
            const polylines = layer.querySelectorAll('polyline');
            expect(polylines).toHaveLength(1);
            expect(polylines[0]).toHaveAttribute('stroke-opacity', '0.8');
        });

        it.each([5, 10])('omits the ahead polyline when pathIndex (%i) reaches or passes the end', (pathIndex) => {
            const { container } = renderLayer({ pathIndex });
            const layer = container.querySelector('g.travel-path-layer');
            const polylines = layer.querySelectorAll('polyline');
            expect(polylines).toHaveLength(1);
            expect(polylines[0]).toHaveAttribute('stroke-opacity', '0.4');
        });
    });

    describe('current position halo', () => {
        it('renders a halo circle when pathIndex points to a valid hex', () => {
            const { container } = renderLayer();
            const layer = container.querySelector('g.travel-path-layer');
            const circle = layer.querySelector('circle');
            expect(circle).toBeInTheDocument();
            expect(circle).toHaveAttribute('fill', 'rgba(255, 215, 0, 0.15)');
            expect(circle).toHaveAttribute('stroke', '#FFD700');
            expect(circle).toHaveAttribute('stroke-width', '2');
        });

        it.each([-1, 5, 10])('omits the halo circle when pathIndex (%i) is invalid', (pathIndex) => {
            const { container } = renderLayer({ pathIndex });
            const layer = container.querySelector('g.travel-path-layer');
            expect(layer.querySelector('circle')).not.toBeInTheDocument();
        });
    });

    describe('destination marker', () => {
        it.each([0, 2])('renders a dashed square at the last hex (pathIndex %i)', (pathIndex) => {
            const { container } = renderLayer({ pathIndex });
            const layer = container.querySelector('g.travel-path-layer');
            const rect = layer.querySelector('rect[stroke-dasharray="5 3"]');
            expect(rect).toBeInTheDocument();
            expect(rect).toHaveAttribute('fill', 'none');
            expect(rect).toHaveAttribute('stroke', '#FFD700');
        });

        it('renders a "D" label at the destination', () => {
            renderLayer();
            expect(screen.getByText('D')).toBeInTheDocument();
        });
    });

    describe('edge cases', () => {
        it('renders correctly for a single-element path at index 0', () => {
            const { container } = render(<TravelPathLayer path={[{ q: 0, r: 0 }]} pathIndex={0} />);
            const layer = container.querySelector('g.travel-path-layer');
            // No behind polyline, one ahead polyline since pathIndex=0 includes the only hex
            expect(layer.querySelectorAll('polyline')).toHaveLength(1);
            // Halo should appear at the single hex
            expect(layer.querySelector('circle')).toBeInTheDocument();
            // Destination marker should appear at the same hex
            expect(layer.querySelector('rect[stroke-dasharray="5 3"]')).toBeInTheDocument();
        });

        it('renders halo and destination at the same hex when pathIndex is at the end', () => {
            const { container } = renderLayer({ pathIndex: defaultPath.length - 1 });
            const layer = container.querySelector('g.travel-path-layer');
            const polylines = layer.querySelectorAll('polyline');
            // Both polylines visible: behind has 5 hexes, ahead has the last hex
            expect(polylines).toHaveLength(2);
            expect(polylines[0]).toHaveAttribute('stroke-opacity', '0.4');
            expect(polylines[1]).toHaveAttribute('stroke-opacity', '0.8');
            const circle = layer.querySelector('circle');
            expect(circle).toBeInTheDocument();
            expect(circle).toHaveAttribute('fill', 'rgba(255, 215, 0, 0.15)');
            const rect = layer.querySelector('rect[stroke-dasharray="5 3"]');
            expect(rect).toBeInTheDocument();
            expect(rect).toHaveAttribute('stroke', '#FFD700');
        });
    });
});
