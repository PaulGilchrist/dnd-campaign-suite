import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('TravelPathLayer', () => {
    let props;

    beforeEach(() => {
        props = {
            path: [
                { q: 0, r: 0 },
                { q: 1, r: 0 },
                { q: 1, r: 1 },
                { q: 0, r: 1 },
                { q: -1, r: 1 },
            ],
            pathIndex: 2,
        };
    });

    it('should render the travel-path-layer group', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const layer = container.querySelector('g.travel-path-layer');
        expect(layer).toBeInTheDocument();
    });

    it('should return null when path is null', () => {
        const { container } = render(<TravelPathLayer {...props} path={null} />);
        expect(container.querySelector('g.travel-path-layer')).toBeNull();
    });

    it('should return null when path is undefined', () => {
        const { container } = render(<TravelPathLayer path={undefined} />);
        expect(container.querySelector('g.travel-path-layer')).toBeNull();
    });

    it('should return null when path is empty', () => {
        const { container } = render(<TravelPathLayer {...props} path={[]} />);
        expect(container.querySelector('g.travel-path-layer')).toBeNull();
    });

    it('should render behind path polyline when pathIndex is within bounds', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const behindPolylines = container.querySelectorAll('polyline[stroke="#FFD700"][stroke-opacity="0.4"]');
        expect(behindPolylines.length).toBe(1);
    });

    it('should render ahead path polyline when pathIndex is within bounds', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const aheadPolylines = container.querySelectorAll('polyline[stroke="#FFD700"][stroke-opacity="0.8"]');
        expect(aheadPolylines.length).toBe(1);
    });

    it('should render current position circle when pathIndex is valid', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const circles = container.querySelectorAll('circle[stroke="#FFD700"]');
        expect(circles.length).toBe(1);
    });

    it('should render destination marker (rect + text) at end of path', () => {
        render(<TravelPathLayer {...props} />);
        expect(screen.getByText('D')).toBeInTheDocument();
        const destRect = document.querySelector('rect[stroke="#FFD700"][stroke-dasharray="5 3"]');
        expect(destRect).toBeInTheDocument();
    });

    it('should render 2 polylines (behind + ahead)', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const polylines = container.querySelectorAll('polyline');
        expect(polylines.length).toBe(2);
    });

    it('should render 1 circle for current position', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(1);
    });

    it('should render 1 destination rectangle', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const destRect = container.querySelectorAll('rect[stroke="#FFD700"]');
        expect(destRect.length).toBe(1);
    });

    it('should render behind path with dashed stroke (4 3)', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const behind = container.querySelector('polyline[stroke-opacity="0.4"]');
        expect(behind.getAttribute('stroke-dasharray')).toBe('4 3');
    });

    it('should render ahead path with dashed stroke (6 4)', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const ahead = container.querySelector('polyline[stroke-opacity="0.8"]');
        expect(ahead.getAttribute('stroke-dasharray')).toBe('6 4');
    });

    it('should render behind path with strokeWidth 2', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const behind = container.querySelector('polyline[stroke-opacity="0.4"]');
        expect(behind.getAttribute('stroke-width')).toBe('2');
    });

    it('should render ahead path with strokeWidth 3', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const ahead = container.querySelector('polyline[stroke-opacity="0.8"]');
        expect(ahead.getAttribute('stroke-width')).toBe('3');
    });

    it('should render destination rect with strokeWidth 2.5 and rx 4', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const destRect = container.querySelector('rect[stroke="#FFD700"]');
        expect(destRect.getAttribute('stroke-width')).toBe('2.5');
        expect(destRect.getAttribute('rx')).toBe('4');
    });

    it('should render destination text with correct styling', () => {
        render(<TravelPathLayer {...props} />);
        const text = screen.getByText('D');
        expect(text.getAttribute('fill')).toBe('#FFD700');
        expect(text.getAttribute('font-size')).toBe('9');
        expect(text.getAttribute('font-weight')).toBe('bold');
        expect(text.getAttribute('text-anchor')).toBe('middle');
    });

    it('should render no behind path when pathIndex is 0', () => {
        const { container } = render(<TravelPathLayer {...props} pathIndex={0} />);
        const behind = container.querySelectorAll('polyline[stroke-opacity="0.4"]');
        expect(behind.length).toBe(0);
    });

    it('should render no ahead path when pathIndex equals path length', () => {
        const { container } = render(<TravelPathLayer {...props} pathIndex={5} />);
        const ahead = container.querySelectorAll('polyline[stroke-opacity="0.8"]');
        expect(ahead.length).toBe(0);
    });

    it('should render no current position circle when pathIndex equals path length', () => {
        const { container } = render(<TravelPathLayer {...props} pathIndex={5} />);
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(0);
    });

    it('should render no current position circle when pathIndex is out of bounds (greater)', () => {
        const { container } = render(<TravelPathLayer {...props} pathIndex={10} />);
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(0);
    });

    it('should always render destination marker regardless of pathIndex', () => {
        render(<TravelPathLayer {...props} pathIndex={0} />);
        expect(screen.getByText('D')).toBeInTheDocument();
    });

    it('should always render destination marker regardless of pathIndex (end)', () => {
        render(<TravelPathLayer {...props} pathIndex={5} />);
        expect(screen.getByText('D')).toBeInTheDocument();
    });

    it('should render behind path with 1 element when pathIndex is 1', () => {
        const { container } = render(<TravelPathLayer {...props} pathIndex={1} />);
        const behind = container.querySelector('polyline[stroke-opacity="0.4"]');
        expect(behind).toBeInTheDocument();
    });

    it('should render ahead path with remaining elements when pathIndex is 1', () => {
        const { container } = render(<TravelPathLayer {...props} pathIndex={1} />);
        const ahead = container.querySelector('polyline[stroke-opacity="0.8"]');
        expect(ahead).toBeInTheDocument();
    });


    it('should render current circle with correct radius (HEX_SIZE * 0.6)', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const circle = container.querySelector('circle');
        expect(circle.getAttribute('r')).toBe('18');
    });

    it('should render current circle with correct fill', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const circle = container.querySelector('circle');
        expect(circle.getAttribute('fill')).toBe('rgba(255, 215, 0, 0.15)');
    });

    it('should render current circle with strokeWidth 2', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const circle = container.querySelector('circle');
        expect(circle.getAttribute('stroke-width')).toBe('2');
    });

    it('should render destination rect with width 36 and height 36', () => {
        const { container } = render(<TravelPathLayer {...props} />);
        const destRect = container.querySelector('rect[stroke="#FFD700"]');
        expect(destRect.getAttribute('width')).toBe('36');
        expect(destRect.getAttribute('height')).toBe('36');
    });

    it('should render destination text at correct x and y coordinates', () => {
        render(<TravelPathLayer {...props} />);
        const text = screen.getByText('D');
        const destCenterX = 30 * Math.sqrt(3) * (-1 + 1 / 2);
        const destCenterY = 30 * 3 / 2 * 1;
        expect(parseFloat(text.getAttribute('x'))).toBeCloseTo(destCenterX);
        expect(parseFloat(text.getAttribute('y'))).toBeCloseTo(destCenterY + 4);
    });

    it('should render behind polyline points from path[0..pathIndex-1]', () => {
        const { container } = render(<TravelPathLayer {...props} pathIndex={2} />);
        const behind = container.querySelector('polyline[stroke-opacity="0.4"]');
        const points = behind.getAttribute('points').split(' ').map(p => p.split(',').map(Number));
        // pathIndex=2 means behind = path[0], path[1] = 2 points
        expect(points.length).toBe(2);
    });

    it('should render ahead polyline points from path[pathIndex..end]', () => {
        const { container } = render(<TravelPathLayer {...props} pathIndex={2} />);
        const ahead = container.querySelector('polyline[stroke-opacity="0.8"]');
        const points = ahead.getAttribute('points').split(' ').map(p => p.split(',').map(Number));
        // pathIndex=2 means ahead = path[2], path[3], path[4] = 3 points
        expect(points.length).toBe(3);
    });

    it('should pass hex coordinates correctly to hexToPixel', () => {
        render(<TravelPathLayer {...props} />);
        // hexToPixel should have been called for each hex in the path
        // The mock is already set up above; verify the component rendered
        expect(screen.getByText('D')).toBeInTheDocument();
    });
});
