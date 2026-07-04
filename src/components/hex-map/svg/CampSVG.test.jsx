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

        it('should support ref forwarding', () => {
            const ref = vi.fn();
            render(<CampSVG ref={ref} />);
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('structure', () => {
        it('should render all expected SVG element types', () => {
            const { container } = render(<CampSVG />);
            const group = container.querySelector('g');
            expect(group.querySelector('ellipse')).toBeInTheDocument();
            expect(group.querySelector('polygon')).toBeInTheDocument();
            expect(group.querySelector('line')).toBeInTheDocument();
            expect(group.querySelector('circle')).toBeInTheDocument();
            expect(group.querySelector('path')).toBeInTheDocument();
        });

        it('should render the expected element counts', () => {
            const { container } = render(<CampSVG />);
            expect(container.querySelectorAll('ellipse').length).toBe(1);
            expect(container.querySelectorAll('polygon').length).toBe(4);
            expect(container.querySelectorAll('line').length).toBe(5);
            expect(container.querySelectorAll('circle').length).toBe(8);
            expect(container.querySelectorAll('path').length).toBe(7);
        });

        it('should render tent elements with correct structure', () => {
            const { container } = render(<CampSVG />);
            const polygons = container.querySelectorAll('polygon');
            expect(polygons.length).toBe(4);
            // Tent polygons should have strokeLinejoin round
            const roundJoin = container.querySelectorAll('polygon[stroke-linejoin="round"]');
            expect(roundJoin.length).toBe(2);
            // Opening flap should have opacity
            expect(polygons[2].getAttribute('opacity')).toBe('0.6');
            // Roof highlight should have opacity
            expect(polygons[3].getAttribute('opacity')).toBe('0.25');
        });

        it('should render tent ridge line and ropes', () => {
            const { container } = render(<CampSVG />);
            const lines = container.querySelectorAll('line');
            // Ridge line (thicker, central)
            expect(lines[0].getAttribute('stroke')).toBe('#6B5340');
            // Ropes (thin)
            const ropes = [...lines].filter(l => l.getAttribute('stroke-width') === '0.3');
            expect(ropes.length).toBe(2);
            ropes.forEach(rop => {
                expect(rop.getAttribute('opacity')).toBe('0.6');
            });
        });

        it('should render rope pegs at correct positions', () => {
            const { container } = render(<CampSVG />);
            const circles = container.querySelectorAll('circle');
            const pegs = [...circles].filter(c => c.getAttribute('r') === '0.6' && c.getAttribute('fill') === '#6B5340');
            expect(pegs.length).toBe(2);
        });

        it('should render campfire with stone ring and inner circle', () => {
            const { container } = render(<CampSVG />);
            const circles = container.querySelectorAll('circle');
            const stoneRing = circles[2];
            expect(stoneRing.getAttribute('fill')).toBe('#555');
            expect(stoneRing.getAttribute('stroke')).toBe('#444');
            const fireInner = circles[3];
            expect(fireInner.getAttribute('fill')).toBe('#2a1510');
        });

        it('should render campfire flame layers', () => {
            const { container } = render(<CampSVG />);
            const paths = container.querySelectorAll('path');
            const outerFlames = [...paths].filter(p => p.getAttribute('fill') === '#D35400');
            expect(outerFlames.length).toBe(3);
            const opacities = outerFlames.map(p => p.getAttribute('opacity'));
            expect(opacities).toContain('0.85');
            expect(opacities).toContain('0.7');
            const innerFlame = [...paths].find(p => p.getAttribute('fill') === '#E87A20');
            expect(innerFlame).toBeInTheDocument();
            const core = [...paths].find(p => p.getAttribute('fill') === '#F5D060');
            expect(core).toBeInTheDocument();
        });

        it('should render campfire sparks and smoke', () => {
            const { container } = render(<CampSVG />);
            const circles = container.querySelectorAll('circle');
            const sparks = [...circles].slice(4);
            expect(sparks.length).toBe(4);
            const sparkColors = sparks.map(s => s.getAttribute('fill'));
            expect(sparkColors).toContain('#F5D060');
            expect(sparkColors).toContain('#E87A20');
            const smokePaths = [...container.querySelectorAll('path')].filter(p => p.getAttribute('fill') === 'none' && p.getAttribute('stroke') === '#888');
            expect(smokePaths.length).toBe(2);
            smokePaths.forEach(smoke => {
                expect(smoke.getAttribute('stroke-linecap')).toBe('round');
            });
        });
    });

    describe('color palette', () => {
        it('should include expected tent, fire, stone, and rope colors', () => {
            const { container } = render(<CampSVG />);
            const group = container.querySelector('g');
            const allElements = group.querySelectorAll('*');
            const fills = new Set();
            const strokes = new Set();
            allElements.forEach(el => {
                if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
                if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
            });
            expect(fills).toContain('#B89870');
            expect(fills).toContain('#C4A882');
            expect(fills).toContain('#D4B88A');
            expect(fills).toContain('#5C4030');
            expect(fills).toContain('#D35400');
            expect(fills).toContain('#E87A20');
            expect(fills).toContain('#F5D060');
            expect(fills).toContain('#2a1510');
            expect(fills).toContain('#555');
            expect(strokes).toContain('#8B7355');
            expect(strokes).toContain('#6B5340');
            expect(strokes).toContain('#444');
        });
    });
});
