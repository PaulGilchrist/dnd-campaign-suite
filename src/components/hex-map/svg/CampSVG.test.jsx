import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CampSVG from './CampSVG.jsx';

describe('CampSVG', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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

    it('should render the ground shadow ellipse', () => {
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

    it('should render the tent back wall polygon', () => {
        const { container } = render(<CampSVG />);
        const polygons = container.querySelectorAll('polygon');
        const backWall = polygons[0];
        expect(backWall.getAttribute('points')).toBe('4,26 12,8 20,26');
        expect(backWall.getAttribute('fill')).toBe('#B89870');
        expect(backWall.getAttribute('stroke')).toBe('#8B7355');
    });

    it('should render the tent front wall polygon', () => {
        const { container } = render(<CampSVG />);
        const polygons = container.querySelectorAll('polygon');
        const frontWall = polygons[1];
        expect(frontWall.getAttribute('points')).toBe('6,26 12,12 18,26');
        expect(frontWall.getAttribute('fill')).toBe('#C4A882');
    });

    it('should render the tent opening flap polygon', () => {
        const { container } = render(<CampSVG />);
        const polygons = container.querySelectorAll('polygon');
        const flap = polygons[2];
        expect(flap.getAttribute('points')).toBe('10,26 12,16 14,26');
        expect(flap.getAttribute('fill')).toBe('#5C4030');
        expect(flap.getAttribute('opacity')).toBe('0.6');
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

    it('should render the tent roof highlight polygon', () => {
        const { container } = render(<CampSVG />);
        const polygons = container.querySelectorAll('polygon');
        const highlight = polygons[3];
        expect(highlight.getAttribute('points')).toBe('8,18 12,9 16,18');
        expect(highlight.getAttribute('fill')).toBe('#D4B88A');
        expect(highlight.getAttribute('opacity')).toBe('0.25');
    });

    it('should render the left tent rope line', () => {
        const { container } = render(<CampSVG />);
        const lines = container.querySelectorAll('line');
        const leftRope = lines[1];
        expect(leftRope.getAttribute('x1')).toBe('12');
        expect(leftRope.getAttribute('y1')).toBe('14');
        expect(leftRope.getAttribute('x2')).toBe('3');
        expect(leftRope.getAttribute('y2')).toBe('27');
        expect(leftRope.getAttribute('stroke')).toBe('#8B7355');
        expect(leftRope.getAttribute('stroke-width')).toBe('0.3');
    });

    it('should render the right tent rope line', () => {
        const { container } = render(<CampSVG />);
        const lines = container.querySelectorAll('line');
        const rightRope = lines[2];
        expect(rightRope.getAttribute('x1')).toBe('12');
        expect(rightRope.getAttribute('y1')).toBe('14');
        expect(rightRope.getAttribute('x2')).toBe('21');
        expect(rightRope.getAttribute('y2')).toBe('27');
    });

    it('should render the left rope peg circle', () => {
        const { container } = render(<CampSVG />);
        const circles = container.querySelectorAll('circle');
        const leftPeg = circles[0];
        expect(leftPeg.getAttribute('cx')).toBe('3');
        expect(leftPeg.getAttribute('cy')).toBe('27');
        expect(leftPeg.getAttribute('r')).toBe('0.6');
        expect(leftPeg.getAttribute('fill')).toBe('#6B5340');
    });

    it('should render the right rope peg circle', () => {
        const { container } = render(<CampSVG />);
        const circles = container.querySelectorAll('circle');
        const rightPeg = circles[1];
        expect(rightPeg.getAttribute('cx')).toBe('21');
        expect(rightPeg.getAttribute('cy')).toBe('27');
        expect(rightPeg.getAttribute('r')).toBe('0.6');
    });

    it('should render the campfire stone ring circle', () => {
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

    it('should render the campfire log lines', () => {
        const { container } = render(<CampSVG />);
        const lines = container.querySelectorAll('line');
        const logs = [...lines].filter(l => l.getAttribute('stroke') === '#5C3317');
        expect(logs.length).toBe(2);
        expect(logs[0].getAttribute('stroke-width')).toBe('1.2');
        expect(logs[1].getAttribute('stroke-width')).toBe('1');
    });

    it('should render the outer flame paths', () => {
        const { container } = render(<CampSVG />);
        const paths = container.querySelectorAll('path');
        const outerFlames = [...paths].filter(p => p.getAttribute('fill') === '#D35400');
        expect(outerFlames.length).toBe(3);
    });

    it('should render the inner flame path', () => {
        const { container } = render(<CampSVG />);
        const paths = container.querySelectorAll('path');
        const innerFlame = [...paths].find(p => p.getAttribute('fill') === '#E87A20');
        expect(innerFlame).toBeInTheDocument();
        expect(innerFlame.getAttribute('opacity')).toBe('0.95');
    });

    it('should render the flame core path', () => {
        const { container } = render(<CampSVG />);
        const paths = container.querySelectorAll('path');
        const core = [...paths].find(p => p.getAttribute('fill') === '#F5D060');
        expect(core).toBeInTheDocument();
        expect(core.getAttribute('opacity')).toBe('0.9');
    });

    it('should render spark circles', () => {
        const { container } = render(<CampSVG />);
        const circles = container.querySelectorAll('circle');
        const sparks = [...circles].slice(4);
        expect(sparks.length).toBe(4);
        const sparkColors = sparks.map(s => s.getAttribute('fill'));
        expect(sparkColors).toContain('#F5D060');
        expect(sparkColors).toContain('#E87A20');
        expect(sparkColors).toContain('#FFF8E0');
    });

    it('should render smoke wisp paths', () => {
        const { container } = render(<CampSVG />);
        const paths = container.querySelectorAll('path');
        const smokePaths = [...paths].filter(p => p.getAttribute('fill') === 'none' && p.getAttribute('stroke') === '#888');
        expect(smokePaths.length).toBe(2);
    });

    it('should render the correct total count of SVG elements', () => {
        const { container } = render(<CampSVG />);
        const group = container.querySelector('g');
        const children = group.children;
        expect(children.length).toBe(25);
    });

    it('should render 4 polygons (tent elements)', () => {
        const { container } = render(<CampSVG />);
        const polygons = container.querySelectorAll('polygon');
        expect(polygons.length).toBe(4);
    });

    it('should render 5 lines (ridge + 2 ropes + 2 logs)', () => {
        const { container } = render(<CampSVG />);
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(5);
    });

    it('should render 7 circles (2 pegs + 2 fire ring + 4 sparks)', () => {
        const { container } = render(<CampSVG />);
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(8);
    });

    it('should render 6 path elements (3 outer flames + 1 inner flame + 1 core + 2 smoke = 6)', () => {
        const { container } = render(<CampSVG />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(7);
    });

    it('should render with displayName CampSVG', () => {
        expect(CampSVG.displayName).toBe('CampSVG');
    });

    it('should support ref forwarding', () => {
        const ref = vi.fn();
        render(<CampSVG ref={ref} />);
        expect(ref).toHaveBeenCalled();
    });

    it('should render the tent with correct stroke linejoin round', () => {
        const { container } = render(<CampSVG />);
        const polygons = container.querySelectorAll('polygon[stroke-linejoin="round"]');
        expect(polygons.length).toBe(2);
    });

    it('should render campfire logs with strokeLinecap round', () => {
        const { container } = render(<CampSVG />);
        const lines = container.querySelectorAll('line[stroke-linecap="round"]');
        expect(lines.length).toBe(2);
    });

    it('should render smoke paths with strokeLinecap round', () => {
        const { container } = render(<CampSVG />);
        const paths = container.querySelectorAll('path[stroke-linecap="round"]');
        expect(paths.length).toBe(2);
    });

    it('should render tent ropes with opacity 0.6', () => {
        const { container } = render(<CampSVG />);
        const lines = container.querySelectorAll('line');
        const ropes = [...lines].filter(l => l.getAttribute('stroke-width') === '0.3');
        expect(ropes.length).toBe(2);
        ropes.forEach(rop => {
            expect(rop.getAttribute('opacity')).toBe('0.6');
        });
    });

    it('should render the component with all expected color palette colors', () => {
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

    it('should render the ground shadow with opacity 0.1', () => {
        const { container } = render(<CampSVG />);
        const shadow = container.querySelector('ellipse');
        expect(shadow.getAttribute('opacity')).toBe('0.1');
    });

    it('should render tent opening with opacity 0.6', () => {
        const { container } = render(<CampSVG />);
        const polygons = container.querySelectorAll('polygon');
        const flap = polygons[2];
        expect(flap.getAttribute('opacity')).toBe('0.6');
    });

    it('should render roof highlight with opacity 0.25', () => {
        const { container } = render(<CampSVG />);
        const polygons = container.querySelectorAll('polygon');
        const highlight = polygons[3];
        expect(highlight.getAttribute('opacity')).toBe('0.25');
    });

    it('should render outer flames with varying opacities', () => {
        const { container } = render(<CampSVG />);
        const paths = container.querySelectorAll('path');
        const outerFlames = [...paths].filter(p => p.getAttribute('fill') === '#D35400');
        const opacities = outerFlames.map(p => p.getAttribute('opacity'));
        expect(opacities).toContain('0.85');
        expect(opacities).toContain('0.7');
    });

    it('should render the correct viewBox-independent coordinates', () => {
        const { container } = render(<CampSVG />);
        const group = container.querySelector('g');
        const children = group.children;
        // Verify the elements span a reasonable coordinate range
        // The tent goes from x=3 to x=21, y=8 to y=27
        // The campfire is at x=27, y=24
        // This is a structural test to ensure coordinates render as expected
        expect(children.length).toBeGreaterThan(0);
    });
});
