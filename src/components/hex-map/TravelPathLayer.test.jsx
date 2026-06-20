// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as hexMapUtils from '../../services/maps/hexMapUtils.js';
import TravelPathLayer from './TravelPathLayer.jsx';

vi.mock('../../config/outdoorConfig.js', () => ({
    HEX_SIZE: 30,
}));

vi.mock('../../services/maps/hexMapUtils.js', () => ({
    hexToPixel: vi.fn((q, r, size) => ({
        x: size * Math.sqrt(3) * (q + r / 2),
        y: size * 3 / 2 * r,
    })),
}));

const defaultPath = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 1, r: 1 },
    { q: 0, r: 1 },
    { q: -1, r: 1 },
];

function renderTravelPathLayer(overrideProps = {}) {
    return render(<TravelPathLayer path={defaultPath} pathIndex={2} {...overrideProps} />);
}

describe('TravelPathLayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('null/empty path handling', () => {
        it('should return null when path is null', () => {
            const { container } = renderTravelPathLayer({ path: null });
            expect(container.querySelector('g.travel-path-layer')).not.toBeInTheDocument();
        });

        it('should return null when path is undefined', () => {
            const { container } = render(<TravelPathLayer path={undefined} />);
            expect(container.querySelector('g.travel-path-layer')).not.toBeInTheDocument();
        });

        it('should return null when path is empty', () => {
            const { container } = render(<TravelPathLayer path={[]} />);
            expect(container.querySelector('g.travel-path-layer')).not.toBeInTheDocument();
        });
    });

    describe('rendering', () => {
        it('should render the travel-path-layer group', () => {
            const { container } = renderTravelPathLayer();
            expect(container.querySelector('g.travel-path-layer')).toBeInTheDocument();
        });

        it('should render the destination marker text "D"', () => {
            renderTravelPathLayer();
            expect(screen.getByText('D')).toBeInTheDocument();
        });
    });

    describe('path polylines', () => {
        it('should render 2 polylines (behind + ahead) for pathIndex=2', () => {
            const { container } = renderTravelPathLayer();
            const polylines = container.querySelectorAll('polyline');
            expect(polylines.length).toBe(2);
        });

        it('should render behind polyline with stroke-opacity 0.4', () => {
            const { container } = renderTravelPathLayer();
            const behind = container.querySelector('polyline[stroke-opacity="0.4"]');
            expect(behind).toBeInTheDocument();
        });

        it('should render ahead polyline with stroke-opacity 0.8', () => {
            const { container } = renderTravelPathLayer();
            const ahead = container.querySelector('polyline[stroke-opacity="0.8"]');
            expect(ahead).toBeInTheDocument();
        });

        it('should render behind polyline with stroke #FFD700', () => {
            const { container } = renderTravelPathLayer();
            const behind = container.querySelector('polyline[stroke-opacity="0.4"]');
            expect(behind.getAttribute('stroke')).toBe('#FFD700');
        });

        it('should render ahead polyline with stroke #FFD700', () => {
            const { container } = renderTravelPathLayer();
            const ahead = container.querySelector('polyline[stroke-opacity="0.8"]');
            expect(ahead.getAttribute('stroke')).toBe('#FFD700');
        });

        it('should render behind polyline with strokeWidth 2', () => {
            const { container } = renderTravelPathLayer();
            const behind = container.querySelector('polyline[stroke-opacity="0.4"]');
            expect(behind.getAttribute('stroke-width')).toBe('2');
        });

        it('should render ahead polyline with strokeWidth 3', () => {
            const { container } = renderTravelPathLayer();
            const ahead = container.querySelector('polyline[stroke-opacity="0.8"]');
            expect(ahead.getAttribute('stroke-width')).toBe('3');
        });

        it('should render behind polyline with dasharray "4 3"', () => {
            const { container } = renderTravelPathLayer();
            const behind = container.querySelector('polyline[stroke-opacity="0.4"]');
            expect(behind.getAttribute('stroke-dasharray')).toBe('4 3');
        });

        it('should render ahead polyline with dasharray "6 4"', () => {
            const { container } = renderTravelPathLayer();
            const ahead = container.querySelector('polyline[stroke-opacity="0.8"]');
            expect(ahead.getAttribute('stroke-dasharray')).toBe('6 4');
        });

        it('should render behind polyline with correct point count based on pathIndex', () => {
            const { container } = renderTravelPathLayer({ pathIndex: 2 });
            const behind = container.querySelector('polyline[stroke-opacity="0.4"]');
            const points = behind.getAttribute('points').split(' ').map(p => p.split(',').map(Number));
            expect(points.length).toBe(2);
        });

        it('should render ahead polyline with correct point count based on pathIndex', () => {
            const { container } = renderTravelPathLayer({ pathIndex: 2 });
            const ahead = container.querySelector('polyline[stroke-opacity="0.8"]');
            const points = ahead.getAttribute('points').split(' ').map(p => p.split(',').map(Number));
            expect(points.length).toBe(3);
        });

        it('should render no behind path when pathIndex is 0', () => {
            const { container } = renderTravelPathLayer({ pathIndex: 0 });
            const behind = container.querySelectorAll('polyline[stroke-opacity="0.4"]');
            expect(behind.length).toBe(0);
        });

        it('should render no ahead path when pathIndex equals path length', () => {
            const { container } = renderTravelPathLayer({ pathIndex: 5 });
            const ahead = container.querySelectorAll('polyline[stroke-opacity="0.8"]');
            expect(ahead.length).toBe(0);
        });

        it('should render behind path with 1 element when pathIndex is 1', () => {
            const { container } = renderTravelPathLayer({ pathIndex: 1 });
            const behind = container.querySelector('polyline[stroke-opacity="0.4"]');
            expect(behind).toBeInTheDocument();
        });

        it('should render ahead path with remaining elements when pathIndex is 1', () => {
            const { container } = renderTravelPathLayer({ pathIndex: 1 });
            const ahead = container.querySelector('polyline[stroke-opacity="0.8"]');
            expect(ahead).toBeInTheDocument();
        });
    });

    describe('current position circle', () => {
        it('should render 1 circle for current position when pathIndex is valid', () => {
            const { container } = renderTravelPathLayer();
            const circles = container.querySelectorAll('circle');
            expect(circles.length).toBe(1);
        });

        it('should render current circle with stroke #FFD700', () => {
            const { container } = renderTravelPathLayer();
            const circle = container.querySelector('circle');
            expect(circle.getAttribute('stroke')).toBe('#FFD700');
        });

        it('should render current circle with correct radius (HEX_SIZE * 0.6 = 18)', () => {
            const { container } = renderTravelPathLayer();
            const circle = container.querySelector('circle');
            expect(circle.getAttribute('r')).toBe('18');
        });

        it('should render current circle with fill rgba(255, 215, 0, 0.15)', () => {
            const { container } = renderTravelPathLayer();
            const circle = container.querySelector('circle');
            expect(circle.getAttribute('fill')).toBe('rgba(255, 215, 0, 0.15)');
        });

        it('should render current circle with strokeWidth 2', () => {
            const { container } = renderTravelPathLayer();
            const circle = container.querySelector('circle');
            expect(circle.getAttribute('stroke-width')).toBe('2');
        });

        it('should render no current position circle when pathIndex equals path length', () => {
            const { container } = renderTravelPathLayer({ pathIndex: 5 });
            const circles = container.querySelectorAll('circle');
            expect(circles.length).toBe(0);
        });

        it('should render no current position circle when pathIndex is out of bounds', () => {
            const { container } = renderTravelPathLayer({ pathIndex: 10 });
            const circles = container.querySelectorAll('circle');
            expect(circles.length).toBe(0);
        });
    });

    describe('destination marker', () => {
        it('should always render destination marker regardless of pathIndex', () => {
            renderTravelPathLayer({ pathIndex: 0 });
            expect(screen.getByText('D')).toBeInTheDocument();
        });

        it('should always render destination marker at end of path', () => {
            renderTravelPathLayer({ pathIndex: 5 });
            expect(screen.getByText('D')).toBeInTheDocument();
        });

        it('should render destination rect with correct dimensions (36x36)', () => {
            const { container } = renderTravelPathLayer();
            const destRect = container.querySelector('rect[stroke="#FFD700"]');
            expect(destRect.getAttribute('width')).toBe('36');
            expect(destRect.getAttribute('height')).toBe('36');
        });

        it('should render destination rect with strokeWidth 2.5 and rx 4', () => {
            const { container } = renderTravelPathLayer();
            const destRect = container.querySelector('rect[stroke="#FFD700"]');
            expect(destRect.getAttribute('stroke-width')).toBe('2.5');
            expect(destRect.getAttribute('rx')).toBe('4');
        });

        it('should render destination rect with dasharray "5 3"', () => {
            const { container } = renderTravelPathLayer();
            const destRect = container.querySelector('rect[stroke="#FFD700"]');
            expect(destRect.getAttribute('stroke-dasharray')).toBe('5 3');
        });

        it('should render destination text with correct styling', () => {
            renderTravelPathLayer();
            const text = screen.getByText('D');
            expect(text.getAttribute('fill')).toBe('#FFD700');
            expect(text.getAttribute('font-size')).toBe('9');
            expect(text.getAttribute('font-weight')).toBe('bold');
            expect(text.getAttribute('text-anchor')).toBe('middle');
        });

        it('should render destination text at correct x and y coordinates', () => {
            const { container } = renderTravelPathLayer();
            const text = container.querySelector('text');
            const destHex = defaultPath[defaultPath.length - 1];
            const destCenterX = 30 * Math.sqrt(3) * (destHex.q + destHex.r / 2);
            const destCenterY = 30 * 3 / 2 * destHex.r;
            expect(parseFloat(text.getAttribute('x'))).toBeCloseTo(destCenterX);
            expect(parseFloat(text.getAttribute('y'))).toBeCloseTo(destCenterY + 4);
        });
    });

    describe('coordinate passthrough to hexToPixel', () => {
        it('should call hexToPixel for behind, ahead, current, and destination hexes', () => {
            // pathIndex=2: behind=[0,1] (2 calls), ahead=[2,3,4] (3 calls),
            // current=path[2] (1 call), destination=path[4] (1 call) = 7 total
            renderTravelPathLayer();
            expect(hexMapUtils.hexToPixel).toHaveBeenCalledTimes(7);
        });

        it('should pass hex coordinates to hexToPixel for each hex in behind and ahead segments', () => {
            renderTravelPathLayer();
            const callArgs = hexMapUtils.hexToPixel.mock.calls.map(call => ({ q: call[0], r: call[1] }));
            // behind: path[0], path[1] -> (0,0), (1,0)
            // ahead: path[2], path[3], path[4] -> (1,1), (0,1), (-1,1)
            // current: path[2] -> (1,1)
            // destination: path[4] -> (-1,1)
            const expectedCoords = [
                { q: 0, r: 0 }, { q: 1, r: 0 },
                { q: 1, r: 1 }, { q: 0, r: 1 }, { q: -1, r: 1 },
                { q: 1, r: 1 }, { q: -1, r: 1 },
            ];
            expect(callArgs).toEqual(expectedCoords);
        });

        it('should call hexToPixel with HEX_SIZE as the size argument', () => {
            renderTravelPathLayer();
            const sizeArgs = hexMapUtils.hexToPixel.mock.calls.map(call => call[2]);
            expect(sizeArgs).toEqual([30, 30, 30, 30, 30, 30, 30]);
        });
    });
});
