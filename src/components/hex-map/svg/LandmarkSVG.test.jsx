// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LandmarkSVG from './LandmarkSVG.jsx';

describe('LandmarkSVG', () => {
    describe('props and rendering', () => {
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
    });

    describe('ground shadow', () => {
        it('should render the ground shadow ellipse with correct attributes', () => {
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
    });

    describe('obelisk faces', () => {
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

        it('should render the right face highlight streak polygon', () => {
            const { container } = render(<LandmarkSVG />);
            const highlight = [...container.querySelectorAll('polygon')].find(p =>
                p.getAttribute('fill') === '#A8A8A8' && p.getAttribute('opacity') === '0.25'
            );
            expect(highlight).toBeInTheDocument();
            expect(highlight.getAttribute('points')).toBe('19,6 21,6 22,28 19,28');
        });
    });

    describe('pyramidion', () => {
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
    });

    describe('stone texture lines', () => {
        it('should render texture lines at the correct y positions with correct x ranges', () => {
            const { container } = render(<LandmarkSVG />);
            const lines = [...container.querySelectorAll('line')];

            const expected = [
                { y1: '8', x1: '13', x2: '23' },
                { y1: '14', x1: '12.5', x2: '23.5' },
                { y1: '20', x1: '12.5', x2: '23.5' },
                { y1: '26', x1: '12', x2: '24' }
            ];

            expected.forEach(({ y1, x1, x2 }) => {
                const line = lines.find(l => l.getAttribute('y1') === y1 && l.getAttribute('y2') === y1);
                expect(line).toBeInTheDocument();
                expect(line.getAttribute('x1')).toBe(x1);
                expect(line.getAttribute('x2')).toBe(x2);
            });
        });
    });

    describe('weathering cracks', () => {
        it('should render two weathering crack paths', () => {
            const { container } = render(<LandmarkSVG />);
            const cracks = [...container.querySelectorAll('path')].filter(p =>
                p.getAttribute('fill') === 'none' && p.getAttribute('stroke') === '#555'
            );
            expect(cracks.length).toBe(2);
        });

        it('should render crack path 1 with correct shape and color', () => {
            const { container } = render(<LandmarkSVG />);
            const crack = [...container.querySelectorAll('path')].find(p =>
                p.getAttribute('d') === 'M 16 10 L 17 14 L 15.5 17'
            );
            expect(crack).toBeInTheDocument();
            expect(crack.getAttribute('stroke')).toBe('#555');
            expect(crack.getAttribute('stroke-width')).toBe('0.3');
            expect(crack.getAttribute('opacity')).toBe('0.4');
        });

        it('should render crack path 2 with correct shape and color', () => {
            const { container } = render(<LandmarkSVG />);
            const crack = [...container.querySelectorAll('path')].find(p =>
                p.getAttribute('d') === 'M 20 22 L 21 25 L 19.5 27'
            );
            expect(crack).toBeInTheDocument();
            expect(crack.getAttribute('stroke')).toBe('#555');
            expect(crack.getAttribute('opacity')).toBe('0.35');
        });
    });

    describe('plinth', () => {
        it('should render the base plinth rect', () => {
            const { container } = render(<LandmarkSVG />);
            const plinth = container.querySelector('rect[fill="#8D8D8D"][stroke="#616161"]');
            expect(plinth).toBeInTheDocument();
            expect(plinth.getAttribute('x')).toBe('10');
            expect(plinth.getAttribute('y')).toBe('28');
            expect(plinth.getAttribute('width')).toBe('16');
            expect(plinth.getAttribute('height')).toBe('3');
            expect(plinth.getAttribute('rx')).toBe('0.5');
            expect(plinth.getAttribute('stroke-width')).toBe('0.5');
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
    });

    describe('hieroglyphics', () => {
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
    });

    describe('birds', () => {
        it('should render 3 small bird paths for scale', () => {
            const { container } = render(<LandmarkSVG />);
            const birds = [...container.querySelectorAll('path')].filter(p =>
                p.getAttribute('stroke') === '#616161' && p.getAttribute('stroke-width') === '0.4' && p.getAttribute('fill') === 'none'
            );
            expect(birds.length).toBe(3);
        });

        it('should render bird paths with correct positions and opacities', () => {
            const { container } = render(<LandmarkSVG />);
            const expected = [
                { d: 'M 5 6 Q 6 4 7 6', opacity: '0.3' },
                { d: 'M 8 4 Q 9 2 10 4', opacity: '0.25' },
                { d: 'M 29 5 Q 30 3 31 5', opacity: '0.25' }
            ];

            expected.forEach(({ d, opacity }) => {
                const bird = [...container.querySelectorAll('path')].find(p => p.getAttribute('d') === d);
                expect(bird).toBeInTheDocument();
                expect(bird.getAttribute('opacity')).toBe(opacity);
            });
        });
    });
});
