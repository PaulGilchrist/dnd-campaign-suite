// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DungeonSVG from './DungeonSVG.jsx';

describe('DungeonSVG', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('props and element rendering', () => {
        it('should render the SVG group element', () => {
            const { container } = render(<DungeonSVG />);
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('should render with the provided id attribute', () => {
            const { container } = render(<DungeonSVG id="dungeon-1" />);
            expect(container.querySelector('g').getAttribute('id')).toBe('dungeon-1');
        });

        it('should render with the provided className', () => {
            const { container } = render(<DungeonSVG className="dungeon-icon" />);
            expect(container.querySelector('g').getAttribute('class')).toBe('dungeon-icon');
        });

        it('should pass through additional props via spread', () => {
            const { container } = render(<DungeonSVG data-testid="dungeon-svg" onClick={vi.fn()} />);
            expect(container.querySelector('g').getAttribute('data-testid')).toBe('dungeon-svg');
        });

        it('should support ref forwarding', () => {
            const ref = vi.fn();
            render(<DungeonSVG ref={ref} />);
            expect(ref).toHaveBeenCalled();
        });

        it('should have displayName DungeonSVG', () => {
            expect(DungeonSVG.displayName).toBe('DungeonSVG');
        });
    });

    describe('ground shadow', () => {
        it('should render the ground shadow ellipse', () => {
            const { container } = render(<DungeonSVG />);
            const shadow = container.querySelector('ellipse');
            expect(shadow).toBeInTheDocument();
            expect(shadow.getAttribute('cx')).toBe('18');
            expect(shadow.getAttribute('cy')).toBe('30');
            expect(shadow.getAttribute('rx')).toBe('15');
            expect(shadow.getAttribute('ry')).toBe('5');
            expect(shadow.getAttribute('fill')).toBe('#333');
            expect(shadow.getAttribute('opacity')).toBe('0.15');
        });
    });

    describe('stone frame', () => {
        it('should render the outer stone frame rect', () => {
            const { container } = render(<DungeonSVG />);
            const frame = container.querySelector('rect[fill="#4A4A4A"][stroke="#333"]');
            expect(frame).toBeInTheDocument();
            expect(frame.getAttribute('x')).toBe('4');
            expect(frame.getAttribute('y')).toBe('4');
            expect(frame.getAttribute('width')).toBe('28');
            expect(frame.getAttribute('height')).toBe('26');
            expect(frame.getAttribute('rx')).toBe('2');
            expect(frame.getAttribute('stroke-width')).toBe('0.8');
        });

        it('should render stone highlight top edge rect', () => {
            const { container } = render(<DungeonSVG />);
            const topHighlight = [...container.querySelectorAll('rect')].find(r =>
                r.getAttribute('fill') === '#6E6E6E' && r.getAttribute('opacity') === '0.35' && r.getAttribute('width') === '28'
            );
            expect(topHighlight).toBeInTheDocument();
            expect(topHighlight.getAttribute('x')).toBe('4');
            expect(topHighlight.getAttribute('y')).toBe('4');
            expect(topHighlight.getAttribute('height')).toBe('1.5');
        });

        it('should render stone highlight left edge rect', () => {
            const { container } = render(<DungeonSVG />);
            const leftHighlight = [...container.querySelectorAll('rect')].find(r =>
                r.getAttribute('fill') === '#6E6E6E' && r.getAttribute('opacity') === '0.25' && r.getAttribute('height') === '26'
            );
            expect(leftHighlight).toBeInTheDocument();
            expect(leftHighlight.getAttribute('x')).toBe('4');
            expect(leftHighlight.getAttribute('y')).toBe('4');
            expect(leftHighlight.getAttribute('width')).toBe('1.5');
        });
    });

    describe('stone texture', () => {
        it('should render 3 stone texture horizontal lines', () => {
            const { container } = render(<DungeonSVG />);
            const textureLines = [...container.querySelectorAll('line')].filter(l =>
                l.getAttribute('stroke') === '#3A3A3A' && l.getAttribute('stroke-width') === '0.4' && l.getAttribute('opacity') === '0.4'
            );
            expect(textureLines.length).toBe(3);
            textureLines.forEach(line => {
                expect(line.getAttribute('x1')).toBe('4');
                expect(line.getAttribute('x2')).toBe('32');
            });
            expect(textureLines[0].getAttribute('y1')).toBe('10');
            expect(textureLines[1].getAttribute('y1')).toBe('16');
            expect(textureLines[2].getAttribute('y1')).toBe('22');
        });
    });

    describe('archway', () => {
        it('should render the arched doorway path', () => {
            const { container } = render(<DungeonSVG />);
            const archDoor = container.querySelector('path[fill="#1A1A1A"]');
            expect(archDoor).toBeInTheDocument();
            expect(archDoor.getAttribute('stroke')).toBe('#333');
            expect(archDoor.getAttribute('stroke-width')).toBe('0.5');
            expect(archDoor.getAttribute('d')).toBe('M 9 30 L 9 14 Q 9 8 18 8 Q 27 8 27 14 L 27 30 Z');
        });

        it('should render the interior floor rect', () => {
            const { container } = render(<DungeonSVG />);
            const floor = [...container.querySelectorAll('rect')].find(r =>
                r.getAttribute('fill') === '#222' && r.getAttribute('x') === '9' && r.getAttribute('y') === '24'
            );
            expect(floor).toBeInTheDocument();
            expect(floor.getAttribute('width')).toBe('18');
            expect(floor.getAttribute('height')).toBe('6');
        });

        it('should render the outer stone arch surround path', () => {
            const { container } = render(<DungeonSVG />);
            const archSurround = [...container.querySelectorAll('path')].find(p =>
                p.getAttribute('fill') === 'none' && p.getAttribute('stroke') === '#5E5E5E' && p.getAttribute('stroke-width') === '1.5'
            );
            expect(archSurround).toBeInTheDocument();
            expect(archSurround.getAttribute('stroke-linecap')).toBe('round');
        });

        it('should render the inner arch path', () => {
            const { container } = render(<DungeonSVG />);
            const innerArch = [...container.querySelectorAll('path')].find(p =>
                p.getAttribute('fill') === 'none' && p.getAttribute('stroke') === '#444' && p.getAttribute('stroke-width') === '0.6'
            );
            expect(innerArch).toBeInTheDocument();
        });

        it('should render the arch keystone polygon', () => {
            const { container } = render(<DungeonSVG />);
            const keystone = container.querySelector('polygon[fill="#5E5E5E"][stroke="#444"]');
            expect(keystone).toBeInTheDocument();
            expect(keystone.getAttribute('points')).toBe('16,5 20,5 20,8 16,8');
            expect(keystone.getAttribute('stroke-width')).toBe('0.4');
        });

        it('should render the keystone cap rect', () => {
            const { container } = render(<DungeonSVG />);
            const cap = [...container.querySelectorAll('rect')].find(r =>
                r.getAttribute('x') === '16' && r.getAttribute('y') === '4' && r.getAttribute('width') === '4' && r.getAttribute('height') === '1.5'
            );
            expect(cap).toBeInTheDocument();
            expect(cap.getAttribute('fill')).toBe('#5E5E5E');
            expect(cap.getAttribute('stroke')).toBe('#444');
            expect(cap.getAttribute('stroke-width')).toBe('0.3');
        });

        it('should render 6 voussoir stone blocks', () => {
            const { container } = render(<DungeonSVG />);
            const voussoirs = [...container.querySelectorAll('rect')].filter(r =>
                r.getAttribute('fill') === '#555' && r.getAttribute('stroke') === '#444' && r.getAttribute('opacity') === '0.6' && r.getAttribute('height') === '3'
            );
            expect(voussoirs.length).toBe(6);

            const leftVoussoirs = voussoirs.filter(r => r.getAttribute('x') === '6');
            const rightVoussoirs = voussoirs.filter(r => r.getAttribute('x') === '27');
            expect(leftVoussoirs.length).toBe(3);
            expect(rightVoussoirs.length).toBe(3);

            [10, 14, 18].forEach(y => {
                expect(voussoirs.some(r => r.getAttribute('y') === String(y))).toBe(true);
            });
        });
    });

    describe('stairs', () => {
        it('should render 3 stair steps descending', () => {
            const { container } = render(<DungeonSVG />);
            const stairs = [...container.querySelectorAll('rect')].filter(r =>
                r.getAttribute('rx') === '0.2' && r.getAttribute('height') === '1.2'
            );
            expect(stairs.length).toBe(3);
            expect(stairs[0].getAttribute('y')).toBe('26');
            expect(stairs[0].getAttribute('width')).toBe('14');
            expect(stairs[1].getAttribute('y')).toBe('27.5');
            expect(stairs[1].getAttribute('width')).toBe('12');
            expect(stairs[2].getAttribute('y')).toBe('29');
            expect(stairs[2].getAttribute('width')).toBe('10');
        });

        it('should render stair side wall lines', () => {
            const { container } = render(<DungeonSVG />);
            const stairLines = [...container.querySelectorAll('line')].filter(l =>
                l.getAttribute('stroke') === '#444' && l.getAttribute('stroke-width') === '0.4'
            );
            expect(stairLines.length).toBe(2);
            expect(stairLines[0].getAttribute('x1')).toBe('11');
            expect(stairLines[1].getAttribute('x1')).toBe('25');
        });
    });

    describe('portcullis', () => {
        it('should render 7 portcullis vertical bars', () => {
            const { container } = render(<DungeonSVG />);
            const bars = [...container.querySelectorAll('line')].filter(l =>
                l.getAttribute('stroke') === '#666' && l.getAttribute('stroke-width') === '0.6' && l.getAttribute('opacity') === '0.6'
            );
            expect(bars.length).toBe(7);

            const xPositions = bars.map(l => l.getAttribute('x1'));
            expect(xPositions).toContain('9');
            expect(xPositions).toContain('12');
            expect(xPositions).toContain('15');
            expect(xPositions).toContain('18');
            expect(xPositions).toContain('21');
            expect(xPositions).toContain('24');
            expect(xPositions).toContain('27');
        });

        it('should render portcullis crossbar', () => {
            const { container } = render(<DungeonSVG />);
            const crossbar = [...container.querySelectorAll('line')].find(l =>
                l.getAttribute('stroke') === '#777' && l.getAttribute('stroke-width') === '0.8' && l.getAttribute('opacity') === '0.5'
            );
            expect(crossbar).toBeInTheDocument();
            expect(crossbar.getAttribute('y1')).toBe('18');
            expect(crossbar.getAttribute('y2')).toBe('18');
        });
    });

    describe('torches', () => {
        it('should render left and right torch sconces', () => {
            const { container } = render(<DungeonSVG />);
            const sconces = [...container.querySelectorAll('rect')].filter(r =>
                r.getAttribute('fill') === '#666' && r.getAttribute('height') === '0.8' && r.getAttribute('rx') === '0.2'
            );
            expect(sconces.length).toBe(2);
            expect(sconces[0].getAttribute('x')).toBe('3');
            expect(sconces[0].getAttribute('y')).toBe('17');
            expect(sconces[1].getAttribute('x')).toBe('31.5');
            expect(sconces[1].getAttribute('y')).toBe('17');
        });

        it('should render left and right torch flame outer ellipses', () => {
            const { container } = render(<DungeonSVG />);
            const flames = [...container.querySelectorAll('ellipse')].filter(e =>
                e.getAttribute('fill') === '#FF8C00' && e.getAttribute('rx') === '1.2' && e.getAttribute('ry') === '1.8'
            );
            expect(flames.length).toBe(2);
            expect(flames[0].getAttribute('cx')).toBe('3.75');
            expect(flames[0].getAttribute('cy')).toBe('16');
            expect(flames[1].getAttribute('cx')).toBe('32.25');
            expect(flames[1].getAttribute('cy')).toBe('16');
        });

        it('should render left and right torch flame inner ellipses', () => {
            const { container } = render(<DungeonSVG />);
            const flames = [...container.querySelectorAll('ellipse')].filter(e =>
                e.getAttribute('fill') === '#FFD700' && e.getAttribute('rx') === '0.6' && e.getAttribute('ry') === '1'
            );
            expect(flames.length).toBe(2);
            expect(flames[0].getAttribute('opacity')).toBe('0.3');
            expect(flames[1].getAttribute('opacity')).toBe('0.3');
        });
    });

    describe('magical glow', () => {
        it('should render faint magical glow ellipses', () => {
            const { container } = render(<DungeonSVG />);
            const glows = [...container.querySelectorAll('ellipse')].filter(e =>
                ['#4A90D9', '#66BBFF'].includes(e.getAttribute('fill'))
            );
            expect(glows.length).toBe(2);

            const outerGlow = glows.find(e => e.getAttribute('fill') === '#4A90D9');
            expect(outerGlow).toBeInTheDocument();
            expect(outerGlow.getAttribute('cx')).toBe('18');
            expect(outerGlow.getAttribute('cy')).toBe('28');
            expect(outerGlow.getAttribute('rx')).toBe('6');
            expect(outerGlow.getAttribute('ry')).toBe('2');
            expect(outerGlow.getAttribute('opacity')).toBe('0.07');

            const innerGlow = glows.find(e => e.getAttribute('fill') === '#66BBFF');
            expect(innerGlow).toBeInTheDocument();
            expect(innerGlow.getAttribute('cx')).toBe('18');
            expect(innerGlow.getAttribute('cy')).toBe('29');
            expect(innerGlow.getAttribute('rx')).toBe('3');
            expect(innerGlow.getAttribute('ry')).toBe('1');
            expect(innerGlow.getAttribute('opacity')).toBe('0.05');
        });
    });

    describe('hinges', () => {
        it('should render iron hinges on both sides', () => {
            const { container } = render(<DungeonSVG />);
            const hinges = [...container.querySelectorAll('rect')].filter(r =>
                r.getAttribute('fill') === '#555' && r.getAttribute('height') === '4' && r.getAttribute('rx') === '0.2'
            );
            expect(hinges.length).toBe(2);
            expect(hinges[0].getAttribute('x')).toBe('4');
            expect(hinges[0].getAttribute('y')).toBe('12');
            expect(hinges[0].getAttribute('width')).toBe('0.8');
            expect(hinges[1].getAttribute('x')).toBe('31.2');
            expect(hinges[1].getAttribute('y')).toBe('12');
        });
    });

    describe('element types', () => {
        it('should render all expected SVG element types', () => {
            const { container } = render(<DungeonSVG />);
            const group = container.querySelector('g');
            expect(group.querySelector('ellipse')).toBeInTheDocument();
            expect(group.querySelector('rect')).toBeInTheDocument();
            expect(group.querySelector('line')).toBeInTheDocument();
            expect(group.querySelector('polygon')).toBeInTheDocument();
            expect(group.querySelector('path')).toBeInTheDocument();
        });
    });

    describe('color palette', () => {
        it('should use all expected fill colors', () => {
            const { container } = render(<DungeonSVG />);
            const group = container.querySelector('g');
            const allElements = group.querySelectorAll('*');
            const fills = new Set();
            allElements.forEach(el => {
                if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
            });
            const expectedFills = [
                '#333', '#4A4A4A', '#3A3A3A', '#6E6E6E', '#1A1A1A',
                '#222', '#5E5E5E', '#555', '#2A2A2A', '#666',
                '#FF8C00', '#FFD700', '#4A90D9', '#66BBFF',
            ];
            expectedFills.forEach(color => expect(fills).toContain(color));
        });

        it('should use all expected stroke colors', () => {
            const { container } = render(<DungeonSVG />);
            const group = container.querySelector('g');
            const allElements = group.querySelectorAll('*');
            const strokes = new Set();
            allElements.forEach(el => {
                if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
            });
            const expectedStrokes = ['#333', '#444', '#5E5E5E'];
            expectedStrokes.forEach(color => expect(strokes).toContain(color));
        });
    });
});
