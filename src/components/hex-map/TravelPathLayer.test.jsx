// @cleaned-by-ai
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
        it('should return null when path is null, undefined, or empty', () => {
            const { container: c1 } = render(<TravelPathLayer path={null} />);
            expect(c1.querySelector('g.travel-path-layer')).not.toBeInTheDocument();

            const { container: c2 } = render(<TravelPathLayer path={undefined} />);
            expect(c2.querySelector('g.travel-path-layer')).not.toBeInTheDocument();

            const { container: c3 } = render(<TravelPathLayer path={[]} />);
            expect(c3.querySelector('g.travel-path-layer')).not.toBeInTheDocument();
        });
    });

    describe('rendering', () => {
        it('should render the travel-path-layer group', () => {
            const { container } = renderTravelPathLayer();
            expect(container.querySelector('g.travel-path-layer')).toBeInTheDocument();
        });
    });

    describe('path polylines', () => {
        it('should render behind and ahead polylines for a valid pathIndex', () => {
            const { container } = renderTravelPathLayer();
            const polylines = container.querySelectorAll('polyline');
            expect(polylines.length).toBe(2);
        });

        it('should render behind polyline with correct style', () => {
            const { container } = renderTravelPathLayer();
            const behind = container.querySelector('polyline[stroke-opacity="0.4"]');
            expect(behind).toBeInTheDocument();
            expect(behind.getAttribute('stroke')).toBe('#FFD700');
            expect(behind.getAttribute('stroke-width')).toBe('2');
            expect(behind.getAttribute('stroke-dasharray')).toBe('4 3');
        });

        it('should render ahead polyline with correct style', () => {
            const { container } = renderTravelPathLayer();
            const ahead = container.querySelector('polyline[stroke-opacity="0.8"]');
            expect(ahead).toBeInTheDocument();
            expect(ahead.getAttribute('stroke')).toBe('#FFD700');
            expect(ahead.getAttribute('stroke-width')).toBe('3');
            expect(ahead.getAttribute('stroke-dasharray')).toBe('6 4');
        });

        it('should render correct point counts for behind and ahead polylines', () => {
            const { container } = renderTravelPathLayer({ pathIndex: 2 });
            const behind = container.querySelector('polyline[stroke-opacity="0.4"]');
            const ahead = container.querySelector('polyline[stroke-opacity="0.8"]');
            const behindPoints = behind.getAttribute('points').split(' ').length;
            const aheadPoints = ahead.getAttribute('points').split(' ').length;
            expect(behindPoints).toBe(2);
            expect(aheadPoints).toBe(3);
        });

        it('should not render behind polyline when pathIndex is 0', () => {
            const { container } = renderTravelPathLayer({ pathIndex: 0 });
            expect(container.querySelectorAll('polyline[stroke-opacity="0.4"]')).toHaveLength(0);
        });

        it('should not render ahead polyline when pathIndex equals path length', () => {
            const { container } = renderTravelPathLayer({ pathIndex: 5 });
            expect(container.querySelectorAll('polyline[stroke-opacity="0.8"]')).toHaveLength(0);
        });
    });

    describe('current position circle', () => {
        it('should render a circle with correct style for a valid pathIndex', () => {
            const { container } = renderTravelPathLayer();
            const circle = container.querySelector('circle');
            expect(circle).toBeInTheDocument();
            expect(circle.getAttribute('stroke')).toBe('#FFD700');
            expect(circle.getAttribute('r')).toBe('18');
            expect(circle.getAttribute('fill')).toBe('rgba(255, 215, 0, 0.15)');
            expect(circle.getAttribute('stroke-width')).toBe('2');
        });

        it('should not render a circle when pathIndex is at or beyond path length', () => {
            const { container: c1 } = renderTravelPathLayer({ pathIndex: 5 });
            expect(c1.querySelectorAll('circle')).toHaveLength(0);

            const { container: c2 } = renderTravelPathLayer({ pathIndex: 10 });
            expect(c2.querySelectorAll('circle')).toHaveLength(0);
        });
    });

    describe('destination marker', () => {
        it('should always render the destination marker regardless of pathIndex', () => {
            const { container: c1 } = renderTravelPathLayer({ pathIndex: 0 });
            expect(c1.querySelector('text')).toBeInTheDocument();

            const { container: c2 } = renderTravelPathLayer({ pathIndex: 5 });
            expect(c2.querySelector('text')).toBeInTheDocument();
        });

        it('should render the destination rect with correct style', () => {
            const { container } = renderTravelPathLayer();
            const destRect = container.querySelector('rect[stroke="#FFD700"]');
            expect(destRect).toBeInTheDocument();
            expect(destRect.getAttribute('width')).toBe('36');
            expect(destRect.getAttribute('height')).toBe('36');
            expect(destRect.getAttribute('stroke-width')).toBe('2.5');
            expect(destRect.getAttribute('rx')).toBe('4');
            expect(destRect.getAttribute('stroke-dasharray')).toBe('5 3');
        });

        it('should render the destination text with correct style', () => {
            renderTravelPathLayer();
            const text = screen.getByText('D');
            expect(text.getAttribute('fill')).toBe('#FFD700');
            expect(text.getAttribute('font-size')).toBe('9');
            expect(text.getAttribute('font-weight')).toBe('bold');
            expect(text.getAttribute('text-anchor')).toBe('middle');
        });

        it('should render the destination text at the correct position', () => {
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
        it('should call hexToPixel with correct coordinates for behind, ahead, current, and destination hexes', () => {
            renderTravelPathLayer();
            const callArgs = hexMapUtils.hexToPixel.mock.calls.map(call => ({ q: call[0], r: call[1] }));
            // current: path[2] -> (1,1)
            // destination: path[4] -> (-1,1)
            // ahead: path[2], path[3], path[4] -> (1,1), (0,1), (-1,1)
            // behind: path[0], path[1] -> (0,0), (1,0)
            const expectedCoords = [
                { q: 1, r: 1 }, { q: -1, r: 1 },
                { q: 1, r: 1 }, { q: 0, r: 1 }, { q: -1, r: 1 },
                { q: 0, r: 0 }, { q: 1, r: 0 },
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
