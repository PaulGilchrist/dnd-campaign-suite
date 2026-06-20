// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TowerSVG from './TowerSVG.jsx';

describe('TowerSVG', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('props and rendering', () => {
        it('should render the SVG group element', () => {
            const { container } = render(<TowerSVG />);
            const group = container.querySelector('g');
            expect(group).toBeInTheDocument();
        });

        it('should render with the provided id attribute', () => {
            const { container } = render(<TowerSVG id="tower-1" />);
            const group = container.querySelector('g');
            expect(group.getAttribute('id')).toBe('tower-1');
        });

        it('should render with the provided className', () => {
            const { container } = render(<TowerSVG className="tower-icon" />);
            const group = container.querySelector('g');
            expect(group.getAttribute('class')).toBe('tower-icon');
        });

        it('should pass through additional props via spread', () => {
            const { container } = render(<TowerSVG data-testid="tower-svg" onClick={vi.fn()} />);
            const group = container.querySelector('g');
            expect(group.getAttribute('data-testid')).toBe('tower-svg');
        });

        it('should support ref forwarding', () => {
            const ref = vi.fn();
            render(<TowerSVG ref={ref} />);
            expect(ref).toHaveBeenCalled();
        });

        it('should render with displayName TowerSVG', () => {
            expect(TowerSVG.displayName).toBe('TowerSVG');
        });

        it('should render id, className, and additional props together', () => {
            const { container } = render(<TowerSVG id="my-tower" className="tower-class" data-value="42" />);
            const group = container.querySelector('g');
            expect(group.getAttribute('id')).toBe('my-tower');
            expect(group.getAttribute('class')).toBe('tower-class');
            expect(group.getAttribute('data-value')).toBe('42');
        });
    });

    describe('ground shadow', () => {
        it('should render the ground shadow ellipse with correct attributes', () => {
            const { container } = render(<TowerSVG />);
            const shadow = container.querySelector('ellipse');
            expect(shadow).toBeInTheDocument();
            expect(shadow.getAttribute('cx')).toBe('18');
            expect(shadow.getAttribute('cy')).toBe('30');
            expect(shadow.getAttribute('rx')).toBe('10');
            expect(shadow.getAttribute('ry')).toBe('3.5');
            expect(shadow.getAttribute('fill')).toBe('#555');
            expect(shadow.getAttribute('opacity')).toBe('0.15');
        });
    });

    describe('tower body', () => {
        it('should render the main shaft rect with correct attributes', () => {
            const { container } = render(<TowerSVG />);
            const bodyRect = [...container.querySelectorAll('rect')].find(r =>
                r.getAttribute('x') === '9' && r.getAttribute('y') === '8' && r.getAttribute('width') === '18' && r.getAttribute('height') === '22'
            );
            expect(bodyRect).toBeInTheDocument();
            expect(bodyRect.getAttribute('fill')).toBe('#9E9E9E');
            expect(bodyRect.getAttribute('stroke')).toBe('#757575');
            expect(bodyRect.getAttribute('stroke-width')).toBe('0.8');
            expect(bodyRect.getAttribute('rx')).toBe('0.5');
        });

        it('should render the left shadow side rect', () => {
            const { container } = render(<TowerSVG />);
            const shadow = [...container.querySelectorAll('rect')].find(r =>
                r.getAttribute('x') === '9' && r.getAttribute('fill') === '#757575' && r.getAttribute('opacity') === '0.4'
            );
            expect(shadow).toBeInTheDocument();
            expect(shadow.getAttribute('width')).toBe('5');
            expect(shadow.getAttribute('height')).toBe('22');
            expect(shadow.getAttribute('rx')).toBe('0.3');
        });

        it('should render the right highlight side rect', () => {
            const { container } = render(<TowerSVG />);
            const highlight = [...container.querySelectorAll('rect')].find(r =>
                r.getAttribute('x') === '23' && r.getAttribute('fill') === '#BDBDBD' && r.getAttribute('opacity') === '0.3'
            );
            expect(highlight).toBeInTheDocument();
            expect(highlight.getAttribute('width')).toBe('4');
            expect(highlight.getAttribute('height')).toBe('22');
            expect(highlight.getAttribute('rx')).toBe('0.3');
        });
    });

    describe('stone block lines', () => {
        it('should render 5 horizontal stone block lines spanning full tower width', () => {
            const { container } = render(<TowerSVG />);
            const hLines = [...container.querySelectorAll('line')].filter(l =>
                l.getAttribute('stroke') === '#888' && l.getAttribute('stroke-width') === '0.3' && l.getAttribute('opacity') === '0.4'
            );
            expect(hLines.length).toBe(5);
            expect(hLines[0].getAttribute('y1')).toBe('12');
            expect(hLines[1].getAttribute('y1')).toBe('16');
            expect(hLines[2].getAttribute('y1')).toBe('20');
            expect(hLines[3].getAttribute('y1')).toBe('24');
            expect(hLines[4].getAttribute('y1')).toBe('28');
            hLines.forEach(line => {
                expect(line.getAttribute('x1')).toBe('9');
                expect(line.getAttribute('x2')).toBe('27');
            });
        });

        it('should render 6 vertical staggered stone block lines', () => {
            const { container } = render(<TowerSVG />);
            const vLines = [...container.querySelectorAll('line')].filter(l =>
                l.getAttribute('stroke') === '#888' && l.getAttribute('stroke-width') === '0.3' && l.getAttribute('opacity') === '0.3'
            );
            expect(vLines.length).toBe(6);
        });

        it('should render the tower top edge line', () => {
            const { container } = render(<TowerSVG />);
            const topEdge = [...container.querySelectorAll('line')].find(l =>
                l.getAttribute('x1') === '9' && l.getAttribute('y1') === '8' && l.getAttribute('x2') === '27' && l.getAttribute('y2') === '8'
            );
            expect(topEdge).toBeInTheDocument();
            expect(topEdge.getAttribute('stroke')).toBe('#888');
            expect(topEdge.getAttribute('stroke-width')).toBe('0.5');
        });
    });

    describe('crenellations', () => {
        it('should render 3 merlons with correct positions and rx', () => {
            const { container } = render(<TowerSVG />);
            const merlons = [...container.querySelectorAll('rect')].filter(r =>
                r.getAttribute('y') === '4' && r.getAttribute('height') === '4' && r.getAttribute('fill') === '#9E9E9E' && r.getAttribute('stroke') === '#757575' && r.getAttribute('rx') === '0.2'
            );
            expect(merlons.length).toBe(3);
            expect(merlons[0].getAttribute('x')).toBe('9');
            expect(merlons[1].getAttribute('x')).toBe('15');
            expect(merlons[2].getAttribute('x')).toBe('21');
        });

        it('should render 2 crenel gaps between merlons', () => {
            const { container } = render(<TowerSVG />);
            const gaps = [...container.querySelectorAll('rect')].filter(r =>
                r.getAttribute('y') === '5' && r.getAttribute('height') === '3' && r.getAttribute('width') === '3' && r.getAttribute('fill') === '#757575' && !r.getAttribute('rx')
            );
            expect(gaps.length).toBe(2);
            expect(gaps[0].getAttribute('x')).toBe('12');
            expect(gaps[1].getAttribute('x')).toBe('18');
        });

        it('should render 3 highlight top edges on merlons', () => {
            const { container } = render(<TowerSVG />);
            const highlights = [...container.querySelectorAll('rect')].filter(r =>
                r.getAttribute('fill') === '#BDBDBD' && r.getAttribute('opacity') === '0.5' && r.getAttribute('height') === '0.6' && r.getAttribute('rx') === '0.1'
            );
            expect(highlights.length).toBe(3);
        });
    });

    describe('door', () => {
        it('should render the door path with arch shape and highlight', () => {
            const { container } = render(<TowerSVG />);
            const door = container.querySelector('path[fill="#555"][stroke="#444"]');
            expect(door).toBeInTheDocument();
            expect(door.getAttribute('d')).toBe('M 15 30 L 15 24 Q 15 21 18 21 Q 21 21 21 24 L 21 30');
            expect(door.getAttribute('stroke-width')).toBe('0.5');

            const archHighlight = [...container.querySelectorAll('path')].find(p =>
                p.getAttribute('fill') === 'none' && p.getAttribute('stroke') === '#BDBDBD' && p.getAttribute('opacity') === '0.5'
            );
            expect(archHighlight).toBeInTheDocument();
            expect(archHighlight.getAttribute('stroke-width')).toBe('0.3');
        });
    });

    describe('window', () => {
        it('should render the window slit with highlight border', () => {
            const { container } = render(<TowerSVG />);
            const window = [...container.querySelectorAll('rect')].find(r =>
                r.getAttribute('fill') === '#444' && r.getAttribute('x') === '17' && r.getAttribute('y') === '13' && r.getAttribute('rx') === '0.3'
            );
            expect(window).toBeInTheDocument();
            expect(window.getAttribute('width')).toBe('2');
            expect(window.getAttribute('height')).toBe('4');

            const windowHighlight = [...container.querySelectorAll('rect')].find(r =>
                r.getAttribute('fill') === 'none' && r.getAttribute('stroke') === '#BDBDBD' && r.getAttribute('opacity') === '0.4' && r.getAttribute('x') === '17'
            );
            expect(windowHighlight).toBeInTheDocument();
            expect(windowHighlight.getAttribute('stroke-width')).toBe('0.3');
        });
    });

    describe('colors', () => {
        it('should render with all expected tower colors', () => {
            const { container } = render(<TowerSVG />);
            const group = container.querySelector('g');
            const allElements = group.querySelectorAll('*');
            const fills = new Set();
            const strokes = new Set();
            allElements.forEach(el => {
                if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
                if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
            });
            expect(fills).toContain('#9E9E9E');
            expect(fills).toContain('#757575');
            expect(fills).toContain('#BDBDBD');
            expect(fills).toContain('#555');
            expect(fills).toContain('#444');
            expect(strokes).toContain('#757575');
            expect(strokes).toContain('#888');
            expect(strokes).toContain('#444');
        });
    });

    describe('element types', () => {
        it('should render all expected SVG element types', () => {
            const { container } = render(<TowerSVG />);
            const group = container.querySelector('g');
            expect(group.querySelector('ellipse')).toBeInTheDocument();
            expect(group.querySelector('rect')).toBeInTheDocument();
            expect(group.querySelector('line')).toBeInTheDocument();
            expect(group.querySelector('path')).toBeInTheDocument();
        });
    });
});
