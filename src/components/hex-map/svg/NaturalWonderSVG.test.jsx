import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NaturalWonderSVG from './NaturalWonderSVG.jsx';

describe('NaturalWonderSVG', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the SVG group element', () => {
        const { container } = render(<NaturalWonderSVG />);
        const group = container.querySelector('g');
        expect(group).toBeInTheDocument();
    });

    it('should render with the provided id attribute', () => {
        const { container } = render(<NaturalWonderSVG id="wonder-1" />);
        const group = container.querySelector('g');
        expect(group.getAttribute('id')).toBe('wonder-1');
    });

    it('should render with the provided className', () => {
        const { container } = render(<NaturalWonderSVG className="wonder-icon" />);
        const group = container.querySelector('g');
        expect(group.getAttribute('class')).toBe('wonder-icon');
    });

    it('should pass through additional props via spread', () => {
        const { container } = render(<NaturalWonderSVG data-testid="wonder-svg" onClick={vi.fn()} />);
        const group = container.querySelector('g');
        expect(group.getAttribute('data-testid')).toBe('wonder-svg');
    });

    it('should support ref forwarding', () => {
        const ref = vi.fn();
        render(<NaturalWonderSVG ref={ref} />);
        expect(ref).toHaveBeenCalled();
    });

    it('should render with displayName NaturalWonderSVG', () => {
        expect(NaturalWonderSVG.displayName).toBe('NaturalWonderSVG');
    });

    it('should render 3 magic glow aura circles', () => {
        const { container } = render(<NaturalWonderSVG />);
        const glowCircles = [...container.querySelectorAll('circle')].filter(c =>
            c.getAttribute('cx') === '18' && c.getAttribute('cy') === '18'
        );
        expect(glowCircles.length).toBe(3);
    });

    it('should render the outer magic glow circle', () => {
        const { container } = render(<NaturalWonderSVG />);
        const outerGlow = container.querySelector('circle[r="16"]');
        expect(outerGlow).toBeInTheDocument();
        expect(outerGlow.getAttribute('fill')).toBe('#4A90D9');
        expect(outerGlow.getAttribute('opacity')).toBe('0.06');
    });

    it('should render the middle magic glow circle', () => {
        const { container } = render(<NaturalWonderSVG />);
        const midGlow = container.querySelector('circle[r="12"]');
        expect(midGlow).toBeInTheDocument();
        expect(midGlow.getAttribute('fill')).toBe('#7CB342');
        expect(midGlow.getAttribute('opacity')).toBe('0.06');
    });

    it('should render the inner magic glow circle', () => {
        const { container } = render(<NaturalWonderSVG />);
        const innerGlow = container.querySelector('circle[r="8"]');
        expect(innerGlow).toBeInTheDocument();
        expect(innerGlow.getAttribute('fill')).toBe('#C5E1A5');
        expect(innerGlow.getAttribute('opacity')).toBe('0.05');
    });

    it('should render the crystal base ground shadow ellipse', () => {
        const { container } = render(<NaturalWonderSVG />);
        const shadow = container.querySelector('ellipse');
        expect(shadow).toBeInTheDocument();
        expect(shadow.getAttribute('cx')).toBe('18');
        expect(shadow.getAttribute('cy')).toBe('28');
        expect(shadow.getAttribute('rx')).toBe('10');
        expect(shadow.getAttribute('ry')).toBe('3');
        expect(shadow.getAttribute('fill')).toBe('#7CB342');
        expect(shadow.getAttribute('opacity')).toBe('0.15');
    });

    it('should render exactly 1 ellipse (ground shadow)', () => {
        const { container } = render(<NaturalWonderSVG />);
        const ellipses = container.querySelectorAll('ellipse');
        expect(ellipses.length).toBe(1);
    });

    it('should render the left crystal facet polygon', () => {
        const { container } = render(<NaturalWonderSVG />);
        const leftFacet = container.querySelector('polygon[fill="#6B9B37"]');
        expect(leftFacet).toBeInTheDocument();
        expect(leftFacet.getAttribute('stroke')).toBe('#558B2F');
        expect(leftFacet.getAttribute('stroke-width')).toBe('0.6');
        expect(leftFacet.getAttribute('stroke-linejoin')).toBe('round');
    });

    it('should render the right crystal facet polygon', () => {
        const { container } = render(<NaturalWonderSVG />);
        const rightFacet = container.querySelector('polygon[fill="#7CB342"]');
        expect(rightFacet).toBeInTheDocument();
        expect(rightFacet.getAttribute('stroke')).toBe('#558B2F');
        expect(rightFacet.getAttribute('stroke-width')).toBe('0.6');
    });

    it('should render the front crystal facet polygon', () => {
        const { container } = render(<NaturalWonderSVG />);
        const frontFacet = container.querySelector('polygon[fill="#8BC34A"]');
        expect(frontFacet).toBeInTheDocument();
        expect(frontFacet.getAttribute('stroke')).toBe('#558B2F');
        expect(frontFacet.getAttribute('stroke-width')).toBe('0.5');
    });

    it('should render the top-left crystal facet polygon', () => {
        const { container } = render(<NaturalWonderSVG />);
        const topLeftFacet = container.querySelector('polygon[fill="#9CCC65"]');
        expect(topLeftFacet).toBeInTheDocument();
        expect(topLeftFacet.getAttribute('stroke')).toBe('#558B2F');
        expect(topLeftFacet.getAttribute('stroke-width')).toBe('0.4');
    });

    it('should render the top-right crystal facet polygon', () => {
        const { container } = render(<NaturalWonderSVG />);
        const topRightFacet = container.querySelector('polygon[fill="#AED581"]');
        expect(topRightFacet).toBeInTheDocument();
        expect(topRightFacet.getAttribute('stroke')).toBe('#558B2F');
        expect(topRightFacet.getAttribute('stroke-width')).toBe('0.4');
    });

    it('should render the crystal highlight sparkle polygon', () => {
        const { container } = render(<NaturalWonderSVG />);
        const sparkle = container.querySelector('polygon[opacity="0.4"]');
        expect(sparkle).toBeInTheDocument();
        expect(sparkle.getAttribute('fill')).toBe('#C5E1A5');
    });

    it('should render the inner glow line', () => {
        const { container } = render(<NaturalWonderSVG />);
        const glowLine = container.querySelector('line');
        expect(glowLine).toBeInTheDocument();
        expect(glowLine.getAttribute('x1')).toBe('18');
        expect(glowLine.getAttribute('y1')).toBe('4');
        expect(glowLine.getAttribute('x2')).toBe('18');
        expect(glowLine.getAttribute('y2')).toBe('26');
        expect(glowLine.getAttribute('stroke')).toBe('#DCEDC8');
        expect(glowLine.getAttribute('stroke-width')).toBe('0.5');
        expect(glowLine.getAttribute('opacity')).toBe('0.5');
    });

    it('should render exactly 1 line element (inner glow)', () => {
        const { container } = render(<NaturalWonderSVG />);
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(1);
    });

    it('should render 5 sparkle path elements', () => {
        const { container } = render(<NaturalWonderSVG />);
        const sparklePaths = [...container.querySelectorAll('path')].filter(p =>
            p.getAttribute('fill') === '#C5E1A5'
        );
        expect(sparklePaths.length).toBe(5);
    });

    it('should render 2 sparkle line elements', () => {
        const { container } = render(<NaturalWonderSVG />);
        const sparkleLines = [...container.querySelectorAll('path')].filter(p =>
            p.getAttribute('stroke') === '#FFF'
        );
        expect(sparkleLines.length).toBe(2);
    });

    it('should render sparkle 1 (top-left)', () => {
        const { container } = render(<NaturalWonderSVG />);
        const sparkle1 = [...container.querySelectorAll('path')].find(p =>
            p.getAttribute('d') === 'M 5 6 L 5.5 5 L 6 6 L 5.5 7 Z'
        );
        expect(sparkle1).toBeInTheDocument();
        expect(sparkle1.getAttribute('opacity')).toBe('0.8');
    });

    it('should render sparkle 2 (top-right)', () => {
        const { container } = render(<NaturalWonderSVG />);
        const sparkle2 = [...container.querySelectorAll('path')].find(p =>
            p.getAttribute('d') === 'M 30 4 L 30.5 3 L 31 4 L 30.5 5 Z'
        );
        expect(sparkle2).toBeInTheDocument();
        expect(sparkle2.getAttribute('opacity')).toBe('0.8');
    });

    it('should render sparkle 3 (left)', () => {
        const { container } = render(<NaturalWonderSVG />);
        const sparkle3 = [...container.querySelectorAll('path')].find(p =>
            p.getAttribute('d') === 'M 3 16 L 3.5 15 L 4 16 L 3.5 17 Z'
        );
        expect(sparkle3).toBeInTheDocument();
        expect(sparkle3.getAttribute('opacity')).toBe('0.6');
    });

    it('should render sparkle 4 (right)', () => {
        const { container } = render(<NaturalWonderSVG />);
        const sparkle4 = [...container.querySelectorAll('path')].find(p =>
            p.getAttribute('d') === 'M 32 14 L 32.5 13 L 33 14 L 32.5 15 Z'
        );
        expect(sparkle4).toBeInTheDocument();
        expect(sparkle4.getAttribute('opacity')).toBe('0.7');
    });

    it('should render sparkle 5 (bottom)', () => {
        const { container } = render(<NaturalWonderSVG />);
        const sparkle5 = [...container.querySelectorAll('path')].find(p =>
            p.getAttribute('d') === 'M 20 32 L 20.5 31 L 21 32 L 20.5 33 Z'
        );
        expect(sparkle5).toBeInTheDocument();
        expect(sparkle5.getAttribute('opacity')).toBe('0.5');
    });

    it('should render exactly 7 path elements (5 sparkles + 2 sparkle lines)', () => {
        const { container } = render(<NaturalWonderSVG />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(7);
    });

    it('should render 6 floating light motes', () => {
        const { container } = render(<NaturalWonderSVG />);
        const allCircles = [...container.querySelectorAll('circle')];
        // Total circles: 3 glow + 6 motes + (sparkle line paths are not circles) = 9
        // But glow circles have cx=18, cy=18, so filter those out
        const motes = allCircles.filter(c =>
            c.getAttribute('cx') !== '18' || c.getAttribute('cy') !== '18'
        );
        expect(motes.length).toBe(6);
    });

    it('should render floating light motes with correct positions', () => {
        const { container } = render(<NaturalWonderSVG />);
        const allCircles = [...container.querySelectorAll('circle')];
        const motes = allCircles.filter(c =>
            c.getAttribute('cx') !== '18' || c.getAttribute('cy') !== '18'
        );
        const positions = motes.map(c => ({
            cx: c.getAttribute('cx'),
            cy: c.getAttribute('cy')
        }));
        expect(positions).toContainEqual({ cx: '10', cy: '8' });
        expect(positions).toContainEqual({ cx: '26', cy: '10' });
        expect(positions).toContainEqual({ cx: '8', cy: '20' });
        expect(positions).toContainEqual({ cx: '28', cy: '22' });
        expect(positions).toContainEqual({ cx: '14', cy: '4' });
        expect(positions).toContainEqual({ cx: '22', cy: '3' });
    });

    it('should render 2 small crystals at the base', () => {
        const { container } = render(<NaturalWonderSVG />);
        const smallCrystals = [...container.querySelectorAll('polygon')].filter(p =>
            p.getAttribute('stroke-width') === '0.3'
        );
        expect(smallCrystals.length).toBe(2);
    });

    it('should render the left small crystal', () => {
        const { container } = render(<NaturalWonderSVG />);
        const leftSmallCrystal = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('points') === '12,28 13,24 14,28'
        );
        expect(leftSmallCrystal).toBeInTheDocument();
        expect(leftSmallCrystal.getAttribute('fill')).toBe('#7CB342');
    });

    it('should render the right small crystal', () => {
        const { container } = render(<NaturalWonderSVG />);
        const rightSmallCrystal = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('points') === '22,28 23.5,25 25,28'
        );
        expect(rightSmallCrystal).toBeInTheDocument();
        expect(rightSmallCrystal.getAttribute('fill')).toBe('#8BC34A');
    });

    it('should render the correct count of polygon elements', () => {
        const { container } = render(<NaturalWonderSVG />);
        const polygons = container.querySelectorAll('polygon');
        expect(polygons.length).toBe(8);
    });

    it('should render the correct count of circle elements', () => {
        const { container } = render(<NaturalWonderSVG />);
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(9);
    });

    it('should render all expected SVG element types', () => {
        const { container } = render(<NaturalWonderSVG />);
        const group = container.querySelector('g');
        expect(group.querySelector('circle')).toBeInTheDocument();
        expect(group.querySelector('ellipse')).toBeInTheDocument();
        expect(group.querySelector('polygon')).toBeInTheDocument();
        expect(group.querySelector('line')).toBeInTheDocument();
        expect(group.querySelector('path')).toBeInTheDocument();
    });

    it('should render with all expected crystal green fill colors', () => {
        const { container } = render(<NaturalWonderSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
        });
        expect(fills).toContain('#6B9B37');
        expect(fills).toContain('#7CB342');
        expect(fills).toContain('#8BC34A');
        expect(fills).toContain('#9CCC65');
        expect(fills).toContain('#AED581');
    });

    it('should render with all expected highlight colors', () => {
        const { container } = render(<NaturalWonderSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
        });
        expect(fills).toContain('#C5E1A5');
        expect(fills).toContain('#DCEDC8');
    });

    it('should render with all expected sparkle colors', () => {
        const { container } = render(<NaturalWonderSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        const strokes = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
            if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
        });
        expect(fills).toContain('#C5E1A5');
        expect(fills).toContain('#FFF');
        expect(strokes).toContain('#FFF');
    });

    it('should render with all expected glow colors', () => {
        const { container } = render(<NaturalWonderSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
        });
        expect(fills).toContain('#4A90D9');
    });

    it('should render with stroke color #558B2F for crystal facets', () => {
        const { container } = render(<NaturalWonderSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const strokes = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
        });
        expect(strokes).toContain('#558B2F');
    });

    it('should render all crystal facet polygons with strokeLinejoin round', () => {
        const { container } = render(<NaturalWonderSVG />);
        const crystalPolygons = [...container.querySelectorAll('polygon')].filter(p =>
            p.getAttribute('stroke') === '#558B2F' && p.getAttribute('stroke-width') !== '0.3'
        );
        crystalPolygons.forEach(p => {
            expect(p.getAttribute('stroke-linejoin')).toBe('round');
        });
    });

    it('should render the correct total count of SVG children in group', () => {
        const { container } = render(<NaturalWonderSVG />);
        const group = container.querySelector('g');
        const children = group.children;
        expect(children.length).toBe(26);
    });

    it('should render with all expected opacities', () => {
        const { container } = render(<NaturalWonderSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const opacities = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('opacity')) opacities.add(el.getAttribute('opacity'));
        });
        expect(opacities).toContain('0.06');
        expect(opacities).toContain('0.05');
        expect(opacities).toContain('0.15');
        expect(opacities).toContain('0.4');
        expect(opacities).toContain('0.5');
        expect(opacities).toContain('0.8');
        expect(opacities).toContain('0.6');
        expect(opacities).toContain('0.7');
    });
});
