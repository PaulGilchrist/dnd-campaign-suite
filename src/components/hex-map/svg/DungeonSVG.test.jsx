import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DungeonSVG from './DungeonSVG.jsx';

describe('DungeonSVG', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the SVG group element', () => {
        const { container } = render(<DungeonSVG />);
        const group = container.querySelector('g');
        expect(group).toBeInTheDocument();
    });

    it('should render with the provided id attribute', () => {
        const { container } = render(<DungeonSVG id="dungeon-1" />);
        const group = container.querySelector('g');
        expect(group.getAttribute('id')).toBe('dungeon-1');
    });

    it('should render with the provided className', () => {
        const { container } = render(<DungeonSVG className="dungeon-icon" />);
        const group = container.querySelector('g');
        expect(group.getAttribute('class')).toBe('dungeon-icon');
    });

    it('should pass through additional props via spread', () => {
        const { container } = render(<DungeonSVG data-testid="dungeon-svg" onClick={vi.fn()} />);
        const group = container.querySelector('g');
        expect(group.getAttribute('data-testid')).toBe('dungeon-svg');
    });

    it('should support ref forwarding', () => {
        const ref = vi.fn();
        render(<DungeonSVG ref={ref} />);
        expect(ref).toHaveBeenCalled();
    });

    it('should render with displayName DungeonSVG', () => {
        expect(DungeonSVG.displayName).toBe('DungeonSVG');
    });

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

    it('should render 3 stone texture horizontal lines', () => {
        const { container } = render(<DungeonSVG />);
        const textureLines = [...container.querySelectorAll('line')].filter(l =>
            l.getAttribute('stroke') === '#3A3A3A' && l.getAttribute('stroke-width') === '0.4' && l.getAttribute('opacity') === '0.4'
        );
        expect(textureLines.length).toBe(3);
        expect(textureLines[0].getAttribute('y1')).toBe('10');
        expect(textureLines[1].getAttribute('y1')).toBe('16');
        expect(textureLines[2].getAttribute('y1')).toBe('22');
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

    it('should render 6 voussoir stone block rects', () => {
        const { container } = render(<DungeonSVG />);
        const voussoirs = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#555' && r.getAttribute('stroke') === '#444' && r.getAttribute('opacity') === '0.6' && r.getAttribute('height') === '3'
        );
        expect(voussoirs.length).toBe(6);
    });

    it('should render voussoirs at correct positions (left and right sides)', () => {
        const { container } = render(<DungeonSVG />);
        const leftVoussoirs = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('x') === '6' && r.getAttribute('fill') === '#555' && r.getAttribute('opacity') === '0.6'
        );
        const rightVoussoirs = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('x') === '27' && r.getAttribute('fill') === '#555' && r.getAttribute('opacity') === '0.6'
        );
        expect(leftVoussoirs.length).toBe(3);
        expect(rightVoussoirs.length).toBe(3);
    });

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

    it('should render 7 portcullis vertical bars', () => {
        const { container } = render(<DungeonSVG />);
        const portcullisBars = [...container.querySelectorAll('line')].filter(l =>
            l.getAttribute('stroke') === '#666' && l.getAttribute('stroke-width') === '0.6' && l.getAttribute('opacity') === '0.6'
        );
        expect(portcullisBars.length).toBe(7);
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

    it('should render left torch sconce', () => {
        const { container } = render(<DungeonSVG />);
        const sconce = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '3' && r.getAttribute('y') === '17' && r.getAttribute('fill') === '#666'
        );
        expect(sconce).toBeInTheDocument();
        expect(sconce.getAttribute('width')).toBe('1.5');
        expect(sconce.getAttribute('height')).toBe('0.8');
    });

    it('should render left torch flame outer ellipse', () => {
        const { container } = render(<DungeonSVG />);
        const leftFlame = [...container.querySelectorAll('ellipse')].find(e =>
            e.getAttribute('cx') === '3.75' && e.getAttribute('cy') === '16' && e.getAttribute('fill') === '#FF8C00'
        );
        expect(leftFlame).toBeInTheDocument();
        expect(leftFlame.getAttribute('rx')).toBe('1.2');
        expect(leftFlame.getAttribute('ry')).toBe('1.8');
        expect(leftFlame.getAttribute('opacity')).toBe('0.4');
    });

    it('should render left torch flame inner ellipse', () => {
        const { container } = render(<DungeonSVG />);
        const leftInnerFlame = [...container.querySelectorAll('ellipse')].find(e =>
            e.getAttribute('cx') === '3.75' && e.getAttribute('cy') === '16' && e.getAttribute('fill') === '#FFD700'
        );
        expect(leftInnerFlame).toBeInTheDocument();
        expect(leftInnerFlame.getAttribute('rx')).toBe('0.6');
        expect(leftInnerFlame.getAttribute('ry')).toBe('1');
        expect(leftInnerFlame.getAttribute('opacity')).toBe('0.3');
    });

    it('should render right torch sconce', () => {
        const { container } = render(<DungeonSVG />);
        const rightSconce = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '31.5' && r.getAttribute('y') === '17' && r.getAttribute('fill') === '#666'
        );
        expect(rightSconce).toBeInTheDocument();
        expect(rightSconce.getAttribute('width')).toBe('1.5');
        expect(rightSconce.getAttribute('height')).toBe('0.8');
    });

    it('should render right torch flame outer ellipse', () => {
        const { container } = render(<DungeonSVG />);
        const rightFlame = [...container.querySelectorAll('ellipse')].find(e =>
            e.getAttribute('cx') === '32.25' && e.getAttribute('cy') === '16' && e.getAttribute('fill') === '#FF8C00'
        );
        expect(rightFlame).toBeInTheDocument();
        expect(rightFlame.getAttribute('rx')).toBe('1.2');
        expect(rightFlame.getAttribute('ry')).toBe('1.8');
    });

    it('should render right torch flame inner ellipse', () => {
        const { container } = render(<DungeonSVG />);
        const rightInnerFlame = [...container.querySelectorAll('ellipse')].find(e =>
            e.getAttribute('cx') === '32.25' && e.getAttribute('cy') === '16' && e.getAttribute('fill') === '#FFD700'
        );
        expect(rightInnerFlame).toBeInTheDocument();
        expect(rightInnerFlame.getAttribute('rx')).toBe('0.6');
        expect(rightInnerFlame.getAttribute('ry')).toBe('1');
    });

    it('should render faint magical glow deep interior outer ellipse', () => {
        const { container } = render(<DungeonSVG />);
        const glow = [...container.querySelectorAll('ellipse')].find(e =>
            e.getAttribute('cx') === '18' && e.getAttribute('cy') === '28' && e.getAttribute('fill') === '#4A90D9'
        );
        expect(glow).toBeInTheDocument();
        expect(glow.getAttribute('rx')).toBe('6');
        expect(glow.getAttribute('ry')).toBe('2');
        expect(glow.getAttribute('opacity')).toBe('0.07');
    });

    it('should render faint magical glow deep interior inner ellipse', () => {
        const { container } = render(<DungeonSVG />);
        const innerGlow = [...container.querySelectorAll('ellipse')].find(e =>
            e.getAttribute('cx') === '18' && e.getAttribute('cy') === '29' && e.getAttribute('fill') === '#66BBFF'
        );
        expect(innerGlow).toBeInTheDocument();
        expect(innerGlow.getAttribute('rx')).toBe('3');
        expect(innerGlow.getAttribute('ry')).toBe('1');
        expect(innerGlow.getAttribute('opacity')).toBe('0.05');
    });

    it('should render iron hinge on left side', () => {
        const { container } = render(<DungeonSVG />);
        const leftHinge = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '4' && r.getAttribute('y') === '12' && r.getAttribute('fill') === '#555' && r.getAttribute('width') === '0.8'
        );
        expect(leftHinge).toBeInTheDocument();
        expect(leftHinge.getAttribute('height')).toBe('4');
        expect(leftHinge.getAttribute('rx')).toBe('0.2');
    });

    it('should render iron hinge on right side', () => {
        const { container } = render(<DungeonSVG />);
        const rightHinge = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '31.2' && r.getAttribute('y') === '12' && r.getAttribute('fill') === '#555' && r.getAttribute('width') === '0.8'
        );
        expect(rightHinge).toBeInTheDocument();
        expect(rightHinge.getAttribute('height')).toBe('4');
    });

    it('should render 7 ellipse elements (shadow + 4 torch flames + 2 magical glow)', () => {
        const { container } = render(<DungeonSVG />);
        const ellipses = container.querySelectorAll('ellipse');
        expect(ellipses.length).toBe(7);
    });

    it('should render 3 path elements (doorway + arch surround + inner arch)', () => {
        const { container } = render(<DungeonSVG />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(3);
    });

    it('should render 1 polygon element (keystone)', () => {
        const { container } = render(<DungeonSVG />);
        const polygons = container.querySelectorAll('polygon');
        expect(polygons.length).toBe(1);
    });

    it('should render with all expected fill colors', () => {
        const { container } = render(<DungeonSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
        });
        expect(fills).toContain('#333');
        expect(fills).toContain('#4A4A4A');
        expect(fills).toContain('#3A3A3A');
        expect(fills).toContain('#6E6E6E');
        expect(fills).toContain('#1A1A1A');
        expect(fills).toContain('#222');
        expect(fills).toContain('#5E5E5E');
        expect(fills).toContain('#555');
        expect(fills).toContain('#2A2A2A');
        expect(fills).toContain('#666');
        expect(fills).toContain('#FF8C00');
        expect(fills).toContain('#FFD700');
        expect(fills).toContain('#4A90D9');
        expect(fills).toContain('#66BBFF');
    });

    it('should render with all expected stroke colors', () => {
        const { container } = render(<DungeonSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const strokes = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
        });
        expect(strokes).toContain('#333');
        expect(strokes).toContain('#444');
        expect(strokes).toContain('#5E5E5E');
    });

    it('should render the correct count of rect elements', () => {
        const { container } = render(<DungeonSVG />);
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(18);
    });

    it('should render the correct count of line elements', () => {
        const { container } = render(<DungeonSVG />);
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(13);
    });

    it('should render all elements within the group', () => {
        const { container } = render(<DungeonSVG />);
        const group = container.querySelector('g');
        const children = group.children;
        expect(children.length).toBeGreaterThan(0);
    });

    it('should render all expected SVG element types', () => {
        const { container } = render(<DungeonSVG />);
        const group = container.querySelector('g');
        expect(group.querySelector('ellipse')).toBeInTheDocument();
        expect(group.querySelector('rect')).toBeInTheDocument();
        expect(group.querySelector('line')).toBeInTheDocument();
        expect(group.querySelector('polygon')).toBeInTheDocument();
        expect(group.querySelector('path')).toBeInTheDocument();
    });

    it('should render the correct total count of SVG children in group', () => {
        const { container } = render(<DungeonSVG />);
        const group = container.querySelector('g');
        const children = group.children;
        expect(children.length).toBe(42);
    });

    it('should render stair rects with correct heights', () => {
        const { container } = render(<DungeonSVG />);
        const stairs = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('rx') === '0.2'
        );
        expect(stairs[0].getAttribute('height')).toBe('1.2');
        expect(stairs[1].getAttribute('height')).toBe('1.2');
        expect(stairs[2].getAttribute('height')).toBe('1.2');
    });

    it('should render stone frame with correct rx border radius', () => {
        const { container } = render(<DungeonSVG />);
        const frame = container.querySelector('rect[rx="2"]');
        expect(frame).toBeInTheDocument();
        expect(frame.getAttribute('fill')).toBe('#4A4A4A');
    });

    it('should render voussoirs with rx 0.3', () => {
        const { container } = render(<DungeonSVG />);
        const voussoirs = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('rx') === '0.3' && r.getAttribute('fill') === '#555' && r.getAttribute('opacity') === '0.6'
        );
        expect(voussoirs.length).toBe(6);
    });

    it('should render torch sconces with rx 0.2', () => {
        const { container } = render(<DungeonSVG />);
        const sconces = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('rx') === '0.2' && r.getAttribute('fill') === '#666' && r.getAttribute('height') === '0.8'
        );
        expect(sconces.length).toBe(2);
    });

    it('should render iron hinges with rx 0.2', () => {
        const { container } = render(<DungeonSVG />);
        const hinges = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('rx') === '0.2' && r.getAttribute('fill') === '#555' && r.getAttribute('height') === '4'
        );
        expect(hinges.length).toBe(2);
    });

    it('should render keystone cap with rx 0.3', () => {
        const { container } = render(<DungeonSVG />);
        const cap = container.querySelector('rect[rx="0.3"]');
        expect(cap).toBeInTheDocument();
        expect(cap.getAttribute('fill')).toBe('#6E6E6E');
    });

    it('should render stone highlights with rx border radius', () => {
        const { container } = render(<DungeonSVG />);
        const topHighlight = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('rx') === '0.5' && r.getAttribute('fill') === '#6E6E6E'
        );
        expect(topHighlight).toBeInTheDocument();
        const leftHighlight = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('rx') === '0.3' && r.getAttribute('fill') === '#6E6E6E' && r.getAttribute('height') === '26'
        );
        expect(leftHighlight).toBeInTheDocument();
    });

    it('should render portcullis bars with correct x positions', () => {
        const { container } = render(<DungeonSVG />);
        const portcullisLines = [...container.querySelectorAll('line')].filter(l =>
            l.getAttribute('stroke') === '#666' && l.getAttribute('stroke-width') === '0.6' && l.getAttribute('opacity') === '0.6'
        );
        const xPositions = portcullisLines.map(l => l.getAttribute('x1'));
        expect(xPositions).toContain('9');
        expect(xPositions).toContain('12');
        expect(xPositions).toContain('15');
        expect(xPositions).toContain('18');
        expect(xPositions).toContain('21');
        expect(xPositions).toContain('24');
        expect(xPositions).toContain('27');
    });

    it('should render torch flames with correct rx/ry values', () => {
        const { container } = render(<DungeonSVG />);
        const outerFlames = [...container.querySelectorAll('ellipse')].filter(e =>
            e.getAttribute('fill') === '#FF8C00' && e.getAttribute('rx') === '1.2' && e.getAttribute('ry') === '1.8'
        );
        const innerFlames = [...container.querySelectorAll('ellipse')].filter(e =>
            e.getAttribute('fill') === '#FFD700' && e.getAttribute('rx') === '0.6' && e.getAttribute('ry') === '1'
        );
        expect(outerFlames.length).toBe(2);
        expect(innerFlames.length).toBe(2);
    });

    it('should render stone texture lines at correct positions', () => {
        const { container } = render(<DungeonSVG />);
        const textureLines = [...container.querySelectorAll('line')].filter(l =>
            l.getAttribute('stroke') === '#3A3A3A' && l.getAttribute('stroke-width') === '0.4' && l.getAttribute('opacity') === '0.4'
        );
        expect(textureLines[0].getAttribute('x1')).toBe('4');
        expect(textureLines[0].getAttribute('x2')).toBe('32');
        expect(textureLines[1].getAttribute('x1')).toBe('4');
        expect(textureLines[1].getAttribute('x2')).toBe('32');
        expect(textureLines[2].getAttribute('x1')).toBe('4');
        expect(textureLines[2].getAttribute('x2')).toBe('32');
    });
});
