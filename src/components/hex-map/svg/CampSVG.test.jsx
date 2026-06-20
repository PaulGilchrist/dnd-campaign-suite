// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CampSVG from './CampSVG.jsx';

describe('CampSVG', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering and props', () => {
        it('should render the SVG group element', () => {
            const { container } = render(<CampSVG />);
            const group = container.querySelector('g');
            expect(group).toBeInTheDocument();
        });

        it('should render with the provided id attribute', () => {
            const { container } = render(<CampSVG id="camp-1" />);
            const group = container.querySelector('g');
            expect(group.getAttribute('id')).toBe('camp-1');
        });

        it('should render with the provided className', () => {
            const { container } = render(<CampSVG className="camp-icon" />);
            const group = container.querySelector('g');
            expect(group.getAttribute('class')).toBe('camp-icon');
        });

        it('should pass through additional props via spread', () => {
            const { container } = render(<CampSVG data-testid="camp-svg" onClick={vi.fn()} />);
            const group = container.querySelector('g');
            expect(group.getAttribute('data-testid')).toBe('camp-svg');
        });

        it('should support ref forwarding', () => {
            const ref = vi.fn();
            render(<CampSVG ref={ref} />);
            expect(ref).toHaveBeenCalled();
        });

        it('should have displayName set to CampSVG', () => {
            expect(CampSVG.displayName).toBe('CampSVG');
        });
    });

    describe('ground shadow', () => {
        it('should render the ground shadow ellipse with correct attributes', () => {
            const { container } = render(<CampSVG />);
            const shadow = container.querySelector('ellipse');
            expect(shadow).toBeInTheDocument();
            expect(shadow.getAttribute('cx')).toBe('18');
            expect(shadow.getAttribute('cy')).toBe('28');
            expect(shadow.getAttribute('rx')).toBe('16');
            expect(shadow.getAttribute('ry')).toBe('5');
            expect(shadow.getAttribute('fill')).toBe('#333');
            expect(shadow.getAttribute('opacity')).toBe('0.1');
        });
    });

    describe('tent elements', () => {
        it('should render 4 tent polygons with correct points and fills', () => {
            const { container } = render(<CampSVG />);
            const polygons = container.querySelectorAll('polygon');
            expect(polygons.length).toBe(4);

            const expected = [
                { points: '4,26 12,8 20,26', fill: '#B89870', stroke: '#8B7355' },
                { points: '6,26 12,12 18,26', fill: '#C4A882', stroke: '#8B7355' },
                { points: '10,26 12,16 14,26', fill: '#5C4030', stroke: null },
                { points: '8,18 12,9 16,18', fill: '#D4B88A', stroke: null },
            ];

            expected.forEach((exp, i) => {
                expect(polygons[i].getAttribute('points')).toBe(exp.points);
                expect(polygons[i].getAttribute('fill')).toBe(exp.fill);
                if (exp.stroke) {
                    expect(polygons[i].getAttribute('stroke')).toBe(exp.stroke);
                } else {
                    expect(polygons[i].getAttribute('stroke')).toBe(null);
                }
            });
        });

        it('should render tent polygons with strokeLinejoin round', () => {
            const { container } = render(<CampSVG />);
            const polygons = container.querySelectorAll('polygon[stroke-linejoin="round"]');
            expect(polygons.length).toBe(2);
        });

        it('should render tent opening flap with opacity 0.6', () => {
            const { container } = render(<CampSVG />);
            const polygons = container.querySelectorAll('polygon');
            const flap = polygons[2];
            expect(flap.getAttribute('opacity')).toBe('0.6');
        });

        it('should render tent roof highlight with opacity 0.25', () => {
            const { container } = render(<CampSVG />);
            const polygons = container.querySelectorAll('polygon');
            const highlight = polygons[3];
            expect(highlight.getAttribute('opacity')).toBe('0.25');
        });

        it('should render the tent ridge line', () => {
            const { container } = render(<CampSVG />);
            const lines = container.querySelectorAll('line');
            const ridgeLine = lines[0];
            expect(ridgeLine.getAttribute('x1')).toBe('12');
            expect(ridgeLine.getAttribute('y1')).toBe('8');
            expect(ridgeLine.getAttribute('x2')).toBe('12');
            expect(ridgeLine.getAttribute('y2')).toBe('26');
            expect(ridgeLine.getAttribute('stroke')).toBe('#6B5340');
        });

        it('should render tent ropes with correct coordinates and styling', () => {
            const { container } = render(<CampSVG />);
            const lines = container.querySelectorAll('line');
            const ropes = [...lines].filter(l => l.getAttribute('stroke-width') === '0.3');
            expect(ropes.length).toBe(2);

            expect(ropes[0].getAttribute('x1')).toBe('12');
            expect(ropes[0].getAttribute('y1')).toBe('14');
            expect(ropes[0].getAttribute('x2')).toBe('3');
            expect(ropes[0].getAttribute('y2')).toBe('27');
            expect(ropes[0].getAttribute('stroke')).toBe('#8B7355');
            expect(ropes[0].getAttribute('opacity')).toBe('0.6');

            expect(ropes[1].getAttribute('x1')).toBe('12');
            expect(ropes[1].getAttribute('y1')).toBe('14');
            expect(ropes[1].getAttribute('x2')).toBe('21');
            expect(ropes[1].getAttribute('y2')).toBe('27');
            expect(ropes[1].getAttribute('stroke')).toBe('#8B7355');
            expect(ropes[1].getAttribute('opacity')).toBe('0.6');
        });
    });

    describe('rope pegs', () => {
        it('should render 2 rope peg circles at correct positions', () => {
            const { container } = render(<CampSVG />);
            const circles = container.querySelectorAll('circle');
            const pegs = [...circles].filter(c => c.getAttribute('r') === '0.6' && c.getAttribute('fill') === '#6B5340');
            expect(pegs.length).toBe(2);

            expect(pegs[0].getAttribute('cx')).toBe('3');
            expect(pegs[0].getAttribute('cy')).toBe('27');
            expect(pegs[1].getAttribute('cx')).toBe('21');
            expect(pegs[1].getAttribute('cy')).toBe('27');
        });
    });

    describe('campfire', () => {
        it('should render the campfire stone ring', () => {
            const { container } = render(<CampSVG />);
            const circles = container.querySelectorAll('circle');
            const stoneRing = circles[2];
            expect(stoneRing.getAttribute('cx')).toBe('27');
            expect(stoneRing.getAttribute('cy')).toBe('24');
            expect(stoneRing.getAttribute('r')).toBe('5');
            expect(stoneRing.getAttribute('fill')).toBe('#555');
            expect(stoneRing.getAttribute('stroke')).toBe('#444');
        });

        it('should render the campfire inner circle', () => {
            const { container } = render(<CampSVG />);
            const circles = container.querySelectorAll('circle');
            const fireInner = circles[3];
            expect(fireInner.getAttribute('cx')).toBe('27');
            expect(fireInner.getAttribute('cy')).toBe('24');
            expect(fireInner.getAttribute('r')).toBe('4');
            expect(fireInner.getAttribute('fill')).toBe('#2a1510');
        });

        it('should render 2 campfire log lines with correct styling', () => {
            const { container } = render(<CampSVG />);
            const lines = container.querySelectorAll('line');
            const logs = [...lines].filter(l => l.getAttribute('stroke') === '#5C3317');
            expect(logs.length).toBe(2);
            logs.forEach(log => {
                expect(log.getAttribute('stroke-linecap')).toBe('round');
            });
        });

        it('should render 3 outer flame paths with correct fill', () => {
            const { container } = render(<CampSVG />);
            const paths = container.querySelectorAll('path');
            const outerFlames = [...paths].filter(p => p.getAttribute('fill') === '#D35400');
            expect(outerFlames.length).toBe(3);
        });

        it('should render outer flames with varying opacities', () => {
            const { container } = render(<CampSVG />);
            const paths = container.querySelectorAll('path');
            const outerFlames = [...paths].filter(p => p.getAttribute('fill') === '#D35400');
            const opacities = outerFlames.map(p => p.getAttribute('opacity'));
            expect(opacities).toContain('0.85');
            expect(opacities).toContain('0.7');
        });

        it('should render the inner flame path with correct opacity', () => {
            const { container } = render(<CampSVG />);
            const paths = container.querySelectorAll('path');
            const innerFlame = [...paths].find(p => p.getAttribute('fill') === '#E87A20');
            expect(innerFlame).toBeInTheDocument();
            expect(innerFlame.getAttribute('opacity')).toBe('0.95');
        });

        it('should render the flame core path with correct opacity', () => {
            const { container } = render(<CampSVG />);
            const paths = container.querySelectorAll('path');
            const core = [...paths].find(p => p.getAttribute('fill') === '#F5D060');
            expect(core).toBeInTheDocument();
            expect(core.getAttribute('opacity')).toBe('0.9');
        });

        it('should render 4 spark circles with flame colors', () => {
            const { container } = render(<CampSVG />);
            const circles = container.querySelectorAll('circle');
            const sparks = [...circles].slice(4);
            expect(sparks.length).toBe(4);
            const sparkColors = sparks.map(s => s.getAttribute('fill'));
            expect(sparkColors).toContain('#F5D060');
            expect(sparkColors).toContain('#E87A20');
            expect(sparkColors).toContain('#FFF8E0');
        });

        it('should render 2 smoke wisp paths with correct styling', () => {
            const { container } = render(<CampSVG />);
            const paths = container.querySelectorAll('path');
            const smokePaths = [...paths].filter(p => p.getAttribute('fill') === 'none' && p.getAttribute('stroke') === '#888');
            expect(smokePaths.length).toBe(2);
            smokePaths.forEach(smoke => {
                expect(smoke.getAttribute('stroke-linecap')).toBe('round');
            });
        });
    });

    describe('element counts', () => {
        it('should render exactly 1 ellipse (ground shadow)', () => {
            const { container } = render(<CampSVG />);
            const ellipses = container.querySelectorAll('ellipse');
            expect(ellipses.length).toBe(1);
        });

        it('should render exactly 4 polygons (tent elements)', () => {
            const { container } = render(<CampSVG />);
            const polygons = container.querySelectorAll('polygon');
            expect(polygons.length).toBe(4);
        });

        it('should render exactly 5 lines (ridge + 2 ropes + 2 logs)', () => {
            const { container } = render(<CampSVG />);
            const lines = container.querySelectorAll('line');
            expect(lines.length).toBe(5);
        });

        it('should render exactly 8 circles (2 pegs + 1 stone ring + 1 fire inner + 4 sparks)', () => {
            const { container } = render(<CampSVG />);
            const circles = container.querySelectorAll('circle');
            expect(circles.length).toBe(8);
        });

        it('should render exactly 7 paths (3 outer flames + 1 inner flame + 1 core + 2 smoke)', () => {
            const { container } = render(<CampSVG />);
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBe(7);
        });

        it('should render all SVG element types present', () => {
            const { container } = render(<CampSVG />);
            const group = container.querySelector('g');
            expect(group.querySelector('ellipse')).toBeInTheDocument();
            expect(group.querySelector('polygon')).toBeInTheDocument();
            expect(group.querySelector('line')).toBeInTheDocument();
            expect(group.querySelector('circle')).toBeInTheDocument();
            expect(group.querySelector('path')).toBeInTheDocument();
        });

        it('should render children within the group', () => {
            const { container } = render(<CampSVG />);
            const group = container.querySelector('g');
            expect(group.children.length).toBeGreaterThan(0);
        });
    });

    describe('color palette', () => {
        it('should render with all expected color palette colors', () => {
            const { container } = render(<CampSVG />);
            const group = container.querySelector('g');
            const allElements = group.querySelectorAll('*');
            const fills = new Set();
            const strokes = new Set();
            allElements.forEach(el => {
                if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
                if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
            });
            // Tent colors
            expect(fills).toContain('#B89870');
            expect(fills).toContain('#C4A882');
            expect(fills).toContain('#D4B88A');
            expect(fills).toContain('#5C4030');
            // Fire colors
            expect(fills).toContain('#D35400');
            expect(fills).toContain('#E87A20');
            expect(fills).toContain('#F5D060');
            expect(fills).toContain('#2a1510');
            // Stone colors
            expect(fills).toContain('#555');
            expect(strokes).toContain('#8B7355');
            expect(strokes).toContain('#6B5340');
            expect(strokes).toContain('#444');
        });
    });
});
