// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HazardSVG from './HazardSVG.jsx';

describe('HazardSVG', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('props and rendering', () => {
        it('should render the SVG group element', () => {
            const { container } = render(<HazardSVG />);
            const group = container.querySelector('g');
            expect(group).toBeInTheDocument();
        });

        it('should render with the provided id attribute', () => {
            const { container } = render(<HazardSVG id="hazard-1" />);
            const group = container.querySelector('g');
            expect(group.getAttribute('id')).toBe('hazard-1');
        });

        it('should render with the provided className', () => {
            const { container } = render(<HazardSVG className="hazard-icon" />);
            const group = container.querySelector('g');
            expect(group.getAttribute('class')).toBe('hazard-icon');
        });

        it('should pass through additional props via spread', () => {
            const { container } = render(<HazardSVG data-testid="hazard-svg" onClick={vi.fn()} />);
            const group = container.querySelector('g');
            expect(group.getAttribute('data-testid')).toBe('hazard-svg');
        });

        it('should support ref forwarding', () => {
            const ref = vi.fn();
            render(<HazardSVG ref={ref} />);
            expect(ref).toHaveBeenCalled();
        });

        it('should render with displayName HazardSVG', () => {
            expect(HazardSVG.displayName).toBe('HazardSVG');
        });
    });

    describe('warning glow', () => {
        it('should render 2 warning glow circles', () => {
            const { container } = render(<HazardSVG />);
            const glowCircles = [...container.querySelectorAll('circle')].filter(c =>
                c.getAttribute('fill') === '#C62828'
            );
            expect(glowCircles.length).toBe(2);
        });

        it('should render the outer warning glow circle', () => {
            const { container } = render(<HazardSVG />);
            const outerGlow = container.querySelector('circle[cx="18"][cy="18"][r="15"]');
            expect(outerGlow).toBeInTheDocument();
            expect(outerGlow.getAttribute('fill')).toBe('#C62828');
            expect(outerGlow.getAttribute('opacity')).toBe('0.06');
        });

        it('should render the inner warning glow circle', () => {
            const { container } = render(<HazardSVG />);
            const innerGlow = container.querySelector('circle[cx="18"][cy="18"][r="11"]');
            expect(innerGlow).toBeInTheDocument();
            expect(innerGlow.getAttribute('fill')).toBe('#C62828');
            expect(innerGlow.getAttribute('opacity')).toBe('0.04');
        });
    });

    describe('skull cranium', () => {
        it('should render the skull cranium ellipse', () => {
            const { container } = render(<HazardSVG />);
            const cranium = container.querySelector('ellipse[cx="18"][cy="16"]');
            expect(cranium).toBeInTheDocument();
            expect(cranium.getAttribute('rx')).toBe('7');
            expect(cranium.getAttribute('ry')).toBe('8');
            expect(cranium.getAttribute('fill')).toBe('#E0E0E0');
            expect(cranium.getAttribute('stroke')).toBe('#424242');
            expect(cranium.getAttribute('stroke-width')).toBe('0.8');
        });

        it('should render the upper cranium highlight', () => {
            const { container } = render(<HazardSVG />);
            const highlight = container.querySelector('ellipse[cx="18"][cy="12"]');
            expect(highlight).toBeInTheDocument();
            expect(highlight.getAttribute('rx')).toBe('5');
            expect(highlight.getAttribute('ry')).toBe('4');
            expect(highlight.getAttribute('fill')).toBe('#FAFAFA');
            expect(highlight.getAttribute('opacity')).toBe('0.4');
        });
    });

    describe('skull jaw', () => {
        it('should render the skull jaw path', () => {
            const { container } = render(<HazardSVG />);
            const jaw = container.querySelector('path[d="M 11 18 Q 11 25 18 25 Q 25 25 25 18"]');
            expect(jaw).toBeInTheDocument();
            expect(jaw.getAttribute('fill')).toBe('#E0E0E0');
            expect(jaw.getAttribute('stroke')).toBe('#424242');
            expect(jaw.getAttribute('stroke-width')).toBe('0.6');
        });
    });

    describe('teeth', () => {
        it('should render 4 top teeth rects', () => {
            const { container } = render(<HazardSVG />);
            const topTeeth = [...container.querySelectorAll('rect')].filter(r =>
                r.getAttribute('y') === '20' && r.getAttribute('height') === '2.5' && r.getAttribute('rx') === '0.3'
            );
            expect(topTeeth.length).toBe(4);
            expect(topTeeth[0].getAttribute('x')).toBe('13');
            expect(topTeeth[1].getAttribute('x')).toBe('16');
            expect(topTeeth[2].getAttribute('x')).toBe('19');
            expect(topTeeth[3].getAttribute('x')).toBe('22');
        });

        it('should render 3 bottom teeth rects', () => {
            const { container } = render(<HazardSVG />);
            const bottomTeeth = [...container.querySelectorAll('rect')].filter(r =>
                r.getAttribute('y') === '22.5' && r.getAttribute('height') === '1.5' && r.getAttribute('rx') === '0.2'
            );
            expect(bottomTeeth.length).toBe(3);
            expect(bottomTeeth[0].getAttribute('x')).toBe('14');
            expect(bottomTeeth[1].getAttribute('x')).toBe('17');
            expect(bottomTeeth[2].getAttribute('x')).toBe('20');
        });

        it('should render all teeth with correct fill and stroke', () => {
            const { container } = render(<HazardSVG />);
            const allTeeth = container.querySelectorAll('rect[fill="#FAFAFA"][stroke="#424242"]');
            expect(allTeeth.length).toBe(7);
        });
    });

    describe('eyes', () => {
        it('should render 2 eye socket ellipses', () => {
            const { container } = render(<HazardSVG />);
            const eyes = [...container.querySelectorAll('ellipse')].filter(e =>
                e.getAttribute('fill') === '#424242' && e.getAttribute('cy') === '14'
            );
            expect(eyes.length).toBe(2);
            expect(eyes[0].getAttribute('cx')).toBe('14.5');
            expect(eyes[1].getAttribute('cx')).toBe('21.5');
        });

        it('should render eye socket dimensions', () => {
            const { container } = render(<HazardSVG />);
            const darkEyes = [...container.querySelectorAll('ellipse')].filter(e =>
                e.getAttribute('fill') === '#424242' && e.getAttribute('cy') === '14'
            );
            darkEyes.forEach(eye => {
                expect(eye.getAttribute('rx')).toBe('2.2');
                expect(eye.getAttribute('ry')).toBe('2.5');
            });
        });

        it('should render eye socket highlight strokes', () => {
            const { container } = render(<HazardSVG />);
            const eyeHighlights = [...container.querySelectorAll('ellipse')].filter(e =>
                e.getAttribute('fill') === 'none' && e.getAttribute('stroke') === '#333' && e.getAttribute('stroke-width') === '0.3'
            );
            expect(eyeHighlights.length).toBe(2);
        });

        it('should render 2 red glow eye ellipses', () => {
            const { container } = render(<HazardSVG />);
            const redGlows = [...container.querySelectorAll('ellipse')].filter(e =>
                e.getAttribute('fill') === '#EF5350' && e.getAttribute('opacity') === '0.5'
            );
            expect(redGlows.length).toBe(2);
            expect(redGlows[0].getAttribute('cx')).toBe('14.5');
            expect(redGlows[1].getAttribute('cx')).toBe('21.5');
            expect(redGlows[0].getAttribute('cy')).toBe('14');
            expect(redGlows[0].getAttribute('rx')).toBe('1.2');
            expect(redGlows[0].getAttribute('ry')).toBe('1.5');
        });
    });

    describe('nose', () => {
        it('should render the nose polygon', () => {
            const { container } = render(<HazardSVG />);
            const nose = container.querySelector('polygon[fill="#424242"]');
            expect(nose).toBeInTheDocument();
            expect(nose.getAttribute('points')).toBe('17,16 19,16 18,18');
        });
    });

    describe('crossbones', () => {
        it('should render 2 main crossbone lines', () => {
            const { container } = render(<HazardSVG />);
            const crossbones = [...container.querySelectorAll('line')].filter(l =>
                l.getAttribute('stroke') === '#424242' && l.getAttribute('stroke-width') === '2.5' && l.getAttribute('stroke-linecap') === 'round'
            );
            expect(crossbones.length).toBe(2);
        });

        it('should render crossbone 1 from top-left to bottom-right', () => {
            const { container } = render(<HazardSVG />);
            const bone1 = container.querySelector('line[x1="6"][y1="8"][x2="30"][y2="28"]');
            expect(bone1).toBeInTheDocument();
        });

        it('should render crossbone 2 from top-right to bottom-left', () => {
            const { container } = render(<HazardSVG />);
            const bone2 = container.querySelector('line[x1="30"][y1="8"][x2="6"][y2="28"]');
            expect(bone2).toBeInTheDocument();
        });

        it('should render 2 crossbone highlight lines', () => {
            const { container } = render(<HazardSVG />);
            const highlights = [...container.querySelectorAll('line')].filter(l =>
                l.getAttribute('stroke') === '#666' && l.getAttribute('stroke-width') === '0.9'
            );
            expect(highlights.length).toBe(2);
        });

        it('should render crossbones with strokeLinecap round', () => {
            const { container } = render(<HazardSVG />);
            const crossbones = container.querySelectorAll('line[stroke-width="2.5"]');
            crossbones.forEach(bone => {
                expect(bone.getAttribute('stroke-linecap')).toBe('round');
            });
        });

        it('should render crossbone highlights with strokeLinecap round', () => {
            const { container } = render(<HazardSVG />);
            const highlights = container.querySelectorAll('line[stroke="#666"]');
            highlights.forEach(line => {
                expect(line.getAttribute('stroke-linecap')).toBe('round');
            });
        });
    });

    describe('bone end knobs', () => {
        it('should render 4 bone end knob circles', () => {
            const { container } = render(<HazardSVG />);
            const knobs = [...container.querySelectorAll('circle')].filter(c =>
                c.getAttribute('fill') === '#424242' && c.getAttribute('r') === '1.8'
            );
            expect(knobs.length).toBe(4);
            expect(knobs[0].getAttribute('cx')).toBe('6');
            expect(knobs[0].getAttribute('cy')).toBe('8');
            expect(knobs[1].getAttribute('cx')).toBe('30');
            expect(knobs[1].getAttribute('cy')).toBe('8');
            expect(knobs[2].getAttribute('cx')).toBe('6');
            expect(knobs[2].getAttribute('cy')).toBe('28');
            expect(knobs[3].getAttribute('cx')).toBe('30');
            expect(knobs[3].getAttribute('cy')).toBe('28');
        });

        it('should render 4 bone end highlight circles', () => {
            const { container } = render(<HazardSVG />);
            const boneHighlights = [...container.querySelectorAll('circle')].filter(c =>
                c.getAttribute('fill') === '#666' && c.getAttribute('r') === '0.8'
            );
            expect(boneHighlights.length).toBe(4);
        });
    });

    describe('venom drip', () => {
        it('should render the venom drip path', () => {
            const { container } = render(<HazardSVG />);
            const venomPath = container.querySelector('path[stroke="#7CB342"]');
            expect(venomPath).toBeInTheDocument();
            expect(venomPath.getAttribute('fill')).toBe('none');
            expect(venomPath.getAttribute('stroke-width')).toBe('1');
            expect(venomPath.getAttribute('stroke-linecap')).toBe('round');
            expect(venomPath.getAttribute('opacity')).toBe('0.6');
        });

        it('should render the venom drip circle', () => {
            const { container } = render(<HazardSVG />);
            const venomCircle = container.querySelector('circle[cy="31"][r="0.8"]');
            expect(venomCircle).toBeInTheDocument();
            expect(venomCircle.getAttribute('cx')).toBe('15.5');
            expect(venomCircle.getAttribute('fill')).toBe('#7CB342');
            expect(venomCircle.getAttribute('opacity')).toBe('0.5');
        });

        it('should render venom path with strokeLinecap round', () => {
            const { container } = render(<HazardSVG />);
            const venomPath = container.querySelector('path[stroke="#7CB342"]');
            expect(venomPath.getAttribute('stroke-linecap')).toBe('round');
        });
    });

    describe('colors', () => {
        it('should render with all expected skull colors', () => {
            const { container } = render(<HazardSVG />);
            const group = container.querySelector('g');
            const allElements = group.querySelectorAll('*');
            const fills = new Set();
            allElements.forEach(el => {
                if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
            });
            expect(fills).toContain('#E0E0E0');
            expect(fills).toContain('#FAFAFA');
            expect(fills).toContain('#424242');
        });

        it('should render with all expected bone colors', () => {
            const { container } = render(<HazardSVG />);
            const group = container.querySelector('g');
            const allElements = group.querySelectorAll('*');
            const strokes = new Set();
            allElements.forEach(el => {
                if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
            });
            expect(strokes).toContain('#424242');
            expect(strokes).toContain('#666');
        });

        it('should render with all expected hazard colors', () => {
            const { container } = render(<HazardSVG />);
            const group = container.querySelector('g');
            const allElements = group.querySelectorAll('*');
            const fills = new Set();
            allElements.forEach(el => {
                if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
            });
            expect(fills).toContain('#C62828');
            expect(fills).toContain('#EF5350');
            expect(fills).toContain('#7CB342');
        });
    });

    describe('element types and counts', () => {
        it('should render all SVG element types present', () => {
            const { container } = render(<HazardSVG />);
            const group = container.querySelector('g');
            expect(group.querySelector('circle')).toBeInTheDocument();
            expect(group.querySelector('ellipse')).toBeInTheDocument();
            expect(group.querySelector('rect')).toBeInTheDocument();
            expect(group.querySelector('line')).toBeInTheDocument();
            expect(group.querySelector('polygon')).toBeInTheDocument();
            expect(group.querySelector('path')).toBeInTheDocument();
        });
    });
});
