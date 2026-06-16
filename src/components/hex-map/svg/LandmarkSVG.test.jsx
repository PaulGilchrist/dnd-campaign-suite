import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LandmarkSVG from './LandmarkSVG.jsx';

describe('LandmarkSVG', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the SVG group element', () => {
        const { container } = render(<LandmarkSVG />);
        const group = container.querySelector('g');
        expect(group).toBeInTheDocument();
    });

    it('should render with the provided id attribute', () => {
        const { container } = render(<LandmarkSVG id="landmark-1" />);
        const group = container.querySelector('g');
        expect(group.getAttribute('id')).toBe('landmark-1');
    });

    it('should render with the provided className', () => {
        const { container } = render(<LandmarkSVG className="landmark-icon" />);
        const group = container.querySelector('g');
        expect(group.getAttribute('class')).toBe('landmark-icon');
    });

    it('should pass through additional props via spread', () => {
        const { container } = render(<LandmarkSVG data-testid="landmark-svg" onClick={vi.fn()} />);
        const group = container.querySelector('g');
        expect(group.getAttribute('data-testid')).toBe('landmark-svg');
    });

    it('should support ref forwarding', () => {
        const ref = vi.fn();
        render(<LandmarkSVG ref={ref} />);
        expect(ref).toHaveBeenCalled();
    });

    it('should render with displayName LandmarkSVG', () => {
        expect(LandmarkSVG.displayName).toBe('LandmarkSVG');
    });

    it('should render the ground shadow ellipse', () => {
        const { container } = render(<LandmarkSVG />);
        const shadow = container.querySelector('ellipse');
        expect(shadow).toBeInTheDocument();
        expect(shadow.getAttribute('cx')).toBe('18');
        expect(shadow.getAttribute('cy')).toBe('30');
        expect(shadow.getAttribute('rx')).toBe('12');
        expect(shadow.getAttribute('ry')).toBe('4');
        expect(shadow.getAttribute('fill')).toBe('#616161');
        expect(shadow.getAttribute('opacity')).toBe('0.12');
    });

    it('should render the obelisk back face polygon', () => {
        const { container } = render(<LandmarkSVG />);
        const backFace = container.querySelector('polygon[fill="#757575"][stroke="#616161"]');
        expect(backFace).toBeInTheDocument();
        expect(backFace.getAttribute('stroke-width')).toBe('0.6');
        expect(backFace.getAttribute('stroke-linejoin')).toBe('round');
        expect(backFace.getAttribute('points')).toBe('14,4 22,4 24,30 12,30');
    });

    it('should render the obelisk left face (shadow side) polygon', () => {
        const { container } = render(<LandmarkSVG />);
        const leftFace = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('fill') === '#616161' && p.getAttribute('stroke') === '#555'
        );
        expect(leftFace).toBeInTheDocument();
        expect(leftFace.getAttribute('stroke-width')).toBe('0.4');
        expect(leftFace.getAttribute('points')).toBe('14,4 18,4 18,30 12,30');
    });

    it('should render the obelisk right face (lit side) polygon', () => {
        const { container } = render(<LandmarkSVG />);
        const rightFace = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('fill') === '#8D8D8D' && p.getAttribute('stroke') === '#757575'
        );
        expect(rightFace).toBeInTheDocument();
        expect(rightFace.getAttribute('stroke-width')).toBe('0.4');
        expect(rightFace.getAttribute('points')).toBe('18,4 22,4 24,30 18,30');
    });

    it('should render the pyramidion back polygon', () => {
        const { container } = render(<LandmarkSVG />);
        const pyramidBack = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('fill') === '#8D8D8D' && p.getAttribute('stroke') === '#616161' && p.getAttribute('stroke-width') === '0.5'
        );
        expect(pyramidBack).toBeInTheDocument();
        expect(pyramidBack.getAttribute('points')).toBe('14,4 22,4 18,0');
    });

    it('should render the pyramidion left polygon', () => {
        const { container } = render(<LandmarkSVG />);
        const pyramidLeft = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('fill') === '#757575' && p.getAttribute('stroke') === '#616161' && p.getAttribute('points') === '14,4 18,4 18,0'
        );
        expect(pyramidLeft).toBeInTheDocument();
        expect(pyramidLeft.getAttribute('stroke-width')).toBe('0.4');
    });

    it('should render the pyramidion right polygon', () => {
        const { container } = render(<LandmarkSVG />);
        const pyramidRight = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('fill') === '#A8A8A8' && p.getAttribute('stroke') === '#8D8D8D' && p.getAttribute('points') === '18,4 22,4 18,0'
        );
        expect(pyramidRight).toBeInTheDocument();
        expect(pyramidRight.getAttribute('stroke-width')).toBe('0.4');
    });

    it('should render the right face highlight streak polygon', () => {
        const { container } = render(<LandmarkSVG />);
        const highlight = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('fill') === '#A8A8A8' && p.getAttribute('opacity') === '0.25'
        );
        expect(highlight).toBeInTheDocument();
        expect(highlight.getAttribute('points')).toBe('19,6 21,6 22,28 19,28');
    });

    it('should render 4 stone texture horizontal lines', () => {
        const { container } = render(<LandmarkSVG />);
        const textureLines = [...container.querySelectorAll('line')].filter(l =>
            l.getAttribute('stroke') === '#666' && l.getAttribute('stroke-width') === '0.3' && l.getAttribute('opacity') === '0.35'
        );
        expect(textureLines.length).toBe(4);
    });

    it('should render stone texture line at y=8', () => {
        const { container } = render(<LandmarkSVG />);
        const line = [...container.querySelectorAll('line')].find(l =>
            l.getAttribute('y1') === '8' && l.getAttribute('y2') === '8'
        );
        expect(line).toBeInTheDocument();
        expect(line.getAttribute('x1')).toBe('13');
        expect(line.getAttribute('x2')).toBe('23');
    });

    it('should render stone texture line at y=14', () => {
        const { container } = render(<LandmarkSVG />);
        const line = [...container.querySelectorAll('line')].find(l =>
            l.getAttribute('y1') === '14' && l.getAttribute('y2') === '14'
        );
        expect(line).toBeInTheDocument();
        expect(line.getAttribute('x1')).toBe('12.5');
        expect(line.getAttribute('x2')).toBe('23.5');
    });

    it('should render stone texture line at y=20', () => {
        const { container } = render(<LandmarkSVG />);
        const line = [...container.querySelectorAll('line')].find(l =>
            l.getAttribute('y1') === '20' && l.getAttribute('y2') === '20'
        );
        expect(line).toBeInTheDocument();
        expect(line.getAttribute('x1')).toBe('12.5');
        expect(line.getAttribute('x2')).toBe('23.5');
    });

    it('should render stone texture line at y=26', () => {
        const { container } = render(<LandmarkSVG />);
        const line = [...container.querySelectorAll('line')].find(l =>
            l.getAttribute('y1') === '26' && l.getAttribute('y2') === '26'
        );
        expect(line).toBeInTheDocument();
        expect(line.getAttribute('x1')).toBe('12');
        expect(line.getAttribute('x2')).toBe('24');
    });

    it('should render weathering crack path 1', () => {
        const { container } = render(<LandmarkSVG />);
        const crack = [...container.querySelectorAll('path')].find(p =>
            p.getAttribute('fill') === 'none' && p.getAttribute('stroke') === '#555' && p.getAttribute('opacity') === '0.4'
        );
        expect(crack).toBeInTheDocument();
        expect(crack.getAttribute('d')).toBe('M 16 10 L 17 14 L 15.5 17');
        expect(crack.getAttribute('stroke-width')).toBe('0.3');
    });

    it('should render weathering crack path 2', () => {
        const { container } = render(<LandmarkSVG />);
        const crack = [...container.querySelectorAll('path')].find(p =>
            p.getAttribute('d') === 'M 20 22 L 21 25 L 19.5 27'
        );
        expect(crack).toBeInTheDocument();
        expect(crack.getAttribute('stroke')).toBe('#555');
        expect(crack.getAttribute('opacity')).toBe('0.35');
    });

    it('should render the base plinth rect', () => {
        const { container } = render(<LandmarkSVG />);
        const plinth = container.querySelector('rect[fill="#8D8D8D"][stroke="#616161"]');
        expect(plinth).toBeInTheDocument();
        expect(plinth.getAttribute('x')).toBe('10');
        expect(plinth.getAttribute('y')).toBe('28');
        expect(plinth.getAttribute('width')).toBe('16');
        expect(plinth.getAttribute('height')).toBe('3');
        expect(plinth.getAttribute('rx')).toBe('0.5');
    });

    it('should render the plinth highlight rect', () => {
        const { container } = render(<LandmarkSVG />);
        const plinthHighlight = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('fill') === '#A8A8A8' && r.getAttribute('opacity') === '0.3' && r.getAttribute('height') === '0.6'
        );
        expect(plinthHighlight).toBeInTheDocument();
        expect(plinthHighlight.getAttribute('rx')).toBe('0.2');
    });

    it('should render the plinth shadow rect', () => {
        const { container } = render(<LandmarkSVG />);
        const plinthShadow = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('fill') === '#616161' && r.getAttribute('opacity') === '0.3' && r.getAttribute('y') === '30' && r.getAttribute('height') === '1'
        );
        expect(plinthShadow).toBeInTheDocument();
        expect(plinthShadow.getAttribute('rx')).toBe('0.2');
    });

    it('should render the hieroglyphic circle', () => {
        const { container } = render(<LandmarkSVG />);
        const circle = container.querySelector('circle');
        expect(circle).toBeInTheDocument();
        expect(circle.getAttribute('cx')).toBe('18');
        expect(circle.getAttribute('cy')).toBe('10');
        expect(circle.getAttribute('r')).toBe('0.8');
        expect(circle.getAttribute('fill')).toBe('none');
        expect(circle.getAttribute('stroke')).toBe('#C8A870');
        expect(circle.getAttribute('stroke-width')).toBe('0.4');
        expect(circle.getAttribute('opacity')).toBe('0.4');
    });

    it('should render the hieroglyphic triangle path', () => {
        const { container } = render(<LandmarkSVG />);
        const triangle = [...container.querySelectorAll('path')].find(p =>
            p.getAttribute('d') === 'M 17 13 L 19 13 L 18 14.5 Z'
        );
        expect(triangle).toBeInTheDocument();
        expect(triangle.getAttribute('fill')).toBe('none');
        expect(triangle.getAttribute('stroke')).toBe('#C8A870');
        expect(triangle.getAttribute('stroke-width')).toBe('0.3');
        expect(triangle.getAttribute('opacity')).toBe('0.35');
    });

    it('should render the hieroglyphic curved path', () => {
        const { container } = render(<LandmarkSVG />);
        const curve = [...container.querySelectorAll('path')].find(p =>
            p.getAttribute('d') === 'M 17.5 16 Q 18 17 18.5 16'
        );
        expect(curve).toBeInTheDocument();
        expect(curve.getAttribute('fill')).toBe('none');
        expect(curve.getAttribute('stroke')).toBe('#C8A870');
        expect(curve.getAttribute('opacity')).toBe('0.3');
    });

    it('should render 3 small bird paths for scale', () => {
        const { container } = render(<LandmarkSVG />);
        const birds = [...container.querySelectorAll('path')].filter(p =>
            p.getAttribute('stroke') === '#616161' && p.getAttribute('stroke-width') === '0.4' && p.getAttribute('fill') === 'none'
        );
        expect(birds.length).toBe(3);
    });

    it('should render the first bird path at x=5-7', () => {
        const { container } = render(<LandmarkSVG />);
        const bird = [...container.querySelectorAll('path')].find(p =>
            p.getAttribute('d') === 'M 5 6 Q 6 4 7 6'
        );
        expect(bird).toBeInTheDocument();
        expect(bird.getAttribute('opacity')).toBe('0.3');
    });

    it('should render the second bird path at x=8-10', () => {
        const { container } = render(<LandmarkSVG />);
        const bird = [...container.querySelectorAll('path')].find(p =>
            p.getAttribute('d') === 'M 8 4 Q 9 2 10 4'
        );
        expect(bird).toBeInTheDocument();
        expect(bird.getAttribute('opacity')).toBe('0.25');
    });

    it('should render the third bird path at x=29-31', () => {
        const { container } = render(<LandmarkSVG />);
        const bird = [...container.querySelectorAll('path')].find(p =>
            p.getAttribute('d') === 'M 29 5 Q 30 3 31 5'
        );
        expect(bird).toBeInTheDocument();
        expect(bird.getAttribute('opacity')).toBe('0.25');
    });

    it('should render the correct count of polygon elements', () => {
        const { container } = render(<LandmarkSVG />);
        const polygons = container.querySelectorAll('polygon');
        expect(polygons.length).toBe(7);
    });

    it('should render the correct count of rect elements', () => {
        const { container } = render(<LandmarkSVG />);
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(3);
    });

    it('should render the correct count of line elements', () => {
        const { container } = render(<LandmarkSVG />);
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(4);
    });

    it('should render exactly 1 ellipse (ground shadow)', () => {
        const { container } = render(<LandmarkSVG />);
        const ellipses = container.querySelectorAll('ellipse');
        expect(ellipses.length).toBe(1);
    });

    it('should render the correct count of path elements', () => {
        const { container } = render(<LandmarkSVG />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(7);
    });

    it('should render the correct count of circle elements', () => {
        const { container } = render(<LandmarkSVG />);
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(1);
    });

    it('should render all expected gray tones', () => {
        const { container } = render(<LandmarkSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        const strokes = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
            if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
        });
        expect(fills).toContain('#616161');
        expect(fills).toContain('#757575');
        expect(fills).toContain('#8D8D8D');
        expect(fills).toContain('#A8A8A8');
        expect(strokes).toContain('#616161');
        expect(strokes).toContain('#555');
        expect(strokes).toContain('#757575');
    });

    it('should render hieroglyphic gold color', () => {
        const { container } = render(<LandmarkSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        const strokes = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
            if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
        });
        expect(strokes).toContain('#C8A870');
    });

    it('should render stone texture lines with correct color', () => {
        const { container } = render(<LandmarkSVG />);
        const lines = [...container.querySelectorAll('line')];
        lines.forEach(line => {
            expect(line.getAttribute('stroke')).toBe('#666');
        });
    });

    it('should render weathering cracks with correct color', () => {
        const { container } = render(<LandmarkSVG />);
        const cracks = [...container.querySelectorAll('path')].filter(p =>
            p.getAttribute('stroke') === '#555' && p.getAttribute('fill') === 'none'
        );
        expect(cracks.length).toBe(2);
    });

    it('should render all SVG element types present', () => {
        const { container } = render(<LandmarkSVG />);
        const group = container.querySelector('g');
        expect(group.querySelector('ellipse')).toBeInTheDocument();
        expect(group.querySelector('rect')).toBeInTheDocument();
        expect(group.querySelector('line')).toBeInTheDocument();
        expect(group.querySelector('polygon')).toBeInTheDocument();
        expect(group.querySelector('path')).toBeInTheDocument();
        expect(group.querySelector('circle')).toBeInTheDocument();
    });

    it('should render all elements within the group', () => {
        const { container } = render(<LandmarkSVG />);
        const group = container.querySelector('g');
        const children = group.children;
        expect(children.length).toBeGreaterThan(0);
    });

    it('should render the group with all children', () => {
        const { container } = render(<LandmarkSVG />);
        const group = container.querySelector('g');
        expect(group.children.length).toBe(23);
    });

    it('should render plinth with correct stroke', () => {
        const { container } = render(<LandmarkSVG />);
        const plinth = container.querySelector('rect[fill="#8D8D8D"][stroke="#616161"]');
        expect(plinth.getAttribute('stroke-width')).toBe('0.5');
    });

    it('should render obelisk faces with strokeLinejoin round', () => {
        const { container } = render(<LandmarkSVG />);
        const polygons = [...container.querySelectorAll('polygon')];
        polygons.forEach(poly => {
            const fill = poly.getAttribute('fill');
            if (fill === '#A8A8A8' && poly.getAttribute('opacity') === '0.25') {
                expect(poly.getAttribute('stroke-linejoin')).toBeNull();
            } else {
                expect(poly.getAttribute('stroke-linejoin')).toBe('round');
            }
        });
    });

    it('should render the correct total count of SVG children in group', () => {
        const { container } = render(<LandmarkSVG />);
        const group = container.querySelector('g');
        const children = group.children;
        expect(children.length).toBe(23);
    });
});
