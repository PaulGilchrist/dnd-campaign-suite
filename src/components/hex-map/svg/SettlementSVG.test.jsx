import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettlementSVG from './SettlementSVG.jsx';

describe('SettlementSVG', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the SVG group element', () => {
        const { container } = render(<SettlementSVG />);
        const group = container.querySelector('g');
        expect(group).toBeInTheDocument();
    });

    it('should render with the provided id attribute', () => {
        const { container } = render(<SettlementSVG id="settlement-1" />);
        const group = container.querySelector('g');
        expect(group.getAttribute('id')).toBe('settlement-1');
    });

    it('should render with the provided className', () => {
        const { container } = render(<SettlementSVG className="settlement-icon" />);
        const group = container.querySelector('g');
        expect(group.getAttribute('class')).toBe('settlement-icon');
    });

    it('should pass through additional props via spread', () => {
        const { container } = render(<SettlementSVG data-testid="settlement-svg" onClick={vi.fn()} />);
        const group = container.querySelector('g');
        expect(group.getAttribute('data-testid')).toBe('settlement-svg');
    });

    it('should support ref forwarding', () => {
        const ref = vi.fn();
        render(<SettlementSVG ref={ref} />);
        expect(ref).toHaveBeenCalled();
    });

    it('should render with displayName SettlementSVG', () => {
        expect(SettlementSVG.displayName).toBe('SettlementSVG');
    });

    it('should render the ground shadow ellipse', () => {
        const { container } = render(<SettlementSVG />);
        const shadow = container.querySelector('ellipse');
        expect(shadow).toBeInTheDocument();
        expect(shadow.getAttribute('cx')).toBe('18');
        expect(shadow.getAttribute('cy')).toBe('20');
        expect(shadow.getAttribute('rx')).toBe('16');
        expect(shadow.getAttribute('ry')).toBe('6');
        expect(shadow.getAttribute('fill')).toBe('#8B5A2B');
        expect(shadow.getAttribute('opacity')).toBe('0.1');
    });

    it('should render the path/road between buildings', () => {
        const { container } = render(<SettlementSVG />);
        const path = container.querySelector('path');
        expect(path).toBeInTheDocument();
        expect(path.getAttribute('d')).toBe('M 9 24 Q 14 22 18 20 Q 22 18 27 22');
        expect(path.getAttribute('fill')).toBe('none');
        expect(path.getAttribute('stroke')).toBe('#A08060');
        expect(path.getAttribute('stroke-width')).toBe('1.2');
        expect(path.getAttribute('opacity')).toBe('0.4');
        expect(path.getAttribute('stroke-linecap')).toBe('round');
    });

    it('should render Building 1 (left) walls rect', () => {
        const { container } = render(<SettlementSVG />);
        const wall = container.querySelector('rect[x="4"][y="15"][width="10"][height="10"]');
        expect(wall).toBeInTheDocument();
        expect(wall.getAttribute('fill')).toBe('#C49A6C');
        expect(wall.getAttribute('stroke')).toBe('#8B5A2B');
        expect(wall.getAttribute('stroke-width')).toBe('0.6');
        expect(wall.getAttribute('rx')).toBe('0.5');
    });

    it('should render Building 1 roof triangle polygon', () => {
        const { container } = render(<SettlementSVG />);
        const roof = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('points') === '2,15 9,8 16,15'
        );
        expect(roof).toBeInTheDocument();
        expect(roof.getAttribute('fill')).toBe('#6B3E1F');
        expect(roof.getAttribute('stroke')).toBe('#5A2E10');
        expect(roof.getAttribute('stroke-width')).toBe('0.6');
        expect(roof.getAttribute('stroke-linejoin')).toBe('round');
    });

    it('should render Building 1 roof highlight polygon', () => {
        const { container } = render(<SettlementSVG />);
        const highlight = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('points') === '6,13 9,9 12,13'
        );
        expect(highlight).toBeInTheDocument();
        expect(highlight.getAttribute('fill')).toBe('#7A4E28');
        expect(highlight.getAttribute('opacity')).toBe('0.3');
    });

    it('should render Building 1 door rect', () => {
        const { container } = render(<SettlementSVG />);
        const door = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '7' && r.getAttribute('y') === '20' && r.getAttribute('width') === '3'
        );
        expect(door).toBeInTheDocument();
        expect(door.getAttribute('fill')).toBe('#5A2E10');
        expect(door.getAttribute('rx')).toBe('0.3');
    });

    it('should render Building 2 (right) walls rect', () => {
        const { container } = render(<SettlementSVG />);
        const wall = container.querySelector('rect[x="20"][y="17"][width="12"][height="8"]');
        expect(wall).toBeInTheDocument();
        expect(wall.getAttribute('fill')).toBe('#B8925C');
        expect(wall.getAttribute('stroke')).toBe('#8B5A2B');
        expect(wall.getAttribute('stroke-width')).toBe('0.6');
        expect(wall.getAttribute('rx')).toBe('0.5');
    });

    it('should render Building 2 roof triangle polygon', () => {
        const { container } = render(<SettlementSVG />);
        const roof = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('points') === '18,17 26,11 34,17'
        );
        expect(roof).toBeInTheDocument();
        expect(roof.getAttribute('fill')).toBe('#6B3E1F');
        expect(roof.getAttribute('stroke')).toBe('#5A2E10');
        expect(roof.getAttribute('stroke-width')).toBe('0.6');
        expect(roof.getAttribute('stroke-linejoin')).toBe('round');
    });

    it('should render Building 2 roof highlight polygon', () => {
        const { container } = render(<SettlementSVG />);
        const highlight = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('points') === '22,15 26,12 30,15'
        );
        expect(highlight).toBeInTheDocument();
        expect(highlight.getAttribute('fill')).toBe('#7A4E28');
        expect(highlight.getAttribute('opacity')).toBe('0.3');
    });

    it('should render Building 2 door rect', () => {
        const { container } = render(<SettlementSVG />);
        const door = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '24' && r.getAttribute('y') === '20' && r.getAttribute('width') === '3'
        );
        expect(door).toBeInTheDocument();
        expect(door.getAttribute('fill')).toBe('#5A2E10');
        expect(door.getAttribute('rx')).toBe('0.3');
    });

    it('should render Building 3 (small, middle) walls rect', () => {
        const { container } = render(<SettlementSVG />);
        const wall = container.querySelector('rect[x="14"][y="20"][width="7"][height="5"]');
        expect(wall).toBeInTheDocument();
        expect(wall.getAttribute('fill')).toBe('#C49A6C');
        expect(wall.getAttribute('stroke')).toBe('#8B5A2B');
        expect(wall.getAttribute('stroke-width')).toBe('0.5');
        expect(wall.getAttribute('rx')).toBe('0.4');
    });

    it('should render Building 3 roof polygon', () => {
        const { container } = render(<SettlementSVG />);
        const roof = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('points') === '12,20 17.5,16 23,20'
        );
        expect(roof).toBeInTheDocument();
        expect(roof.getAttribute('fill')).toBe('#6B3E1F');
        expect(roof.getAttribute('stroke')).toBe('#5A2E10');
        expect(roof.getAttribute('stroke-width')).toBe('0.5');
        expect(roof.getAttribute('stroke-linejoin')).toBe('round');
    });

    it('should render Building 3 door rect', () => {
        const { container } = render(<SettlementSVG />);
        const door = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '16' && r.getAttribute('y') === '22' && r.getAttribute('width') === '2'
        );
        expect(door).toBeInTheDocument();
        expect(door.getAttribute('fill')).toBe('#5A2E10');
        expect(door.getAttribute('rx')).toBe('0.2');
    });

    it('should render window highlights (lit squares)', () => {
        const { container } = render(<SettlementSVG />);
        const windows = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#F5D060' && r.getAttribute('opacity') === '0.4'
        );
        expect(windows.length).toBe(2);
        expect(windows[0].getAttribute('x')).toBe('5.5');
        expect(windows[0].getAttribute('y')).toBe('17');
        expect(windows[0].getAttribute('width')).toBe('1.5');
        expect(windows[0].getAttribute('height')).toBe('1.5');
        expect(windows[0].getAttribute('rx')).toBe('0.2');
        expect(windows[1].getAttribute('x')).toBe('22');
        expect(windows[1].getAttribute('y')).toBe('19');
    });

    it('should render exactly 1 ellipse element', () => {
        const { container } = render(<SettlementSVG />);
        const ellipses = container.querySelectorAll('ellipse');
        expect(ellipses.length).toBe(1);
    });

    it('should render exactly 1 path element', () => {
        const { container } = render(<SettlementSVG />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(1);
    });

    it('should render the correct count of polygon elements', () => {
        const { container } = render(<SettlementSVG />);
        const polygons = container.querySelectorAll('polygon');
        expect(polygons.length).toBe(5);
    });

    it('should render the correct count of rect elements', () => {
        const { container } = render(<SettlementSVG />);
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(8);
    });

    it('should render all elements within the group', () => {
        const { container } = render(<SettlementSVG />);
        const group = container.querySelector('g');
        const children = group.children;
        expect(children.length).toBeGreaterThan(0);
    });

    it('should render with all expected wall colors', () => {
        const { container } = render(<SettlementSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        const strokes = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
            if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
        });
        expect(fills).toContain('#C49A6C');
        expect(fills).toContain('#B8925C');
        expect(strokes).toContain('#8B5A2B');
    });

    it('should render with all expected roof colors', () => {
        const { container } = render(<SettlementSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
        });
        expect(fills).toContain('#6B3E1F');
        expect(fills).toContain('#7A4E28');
    });

    it('should render with all expected dark colors for doors and paths', () => {
        const { container } = render(<SettlementSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        const strokes = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
            if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
        });
        expect(fills).toContain('#5A2E10');
        expect(strokes).toContain('#A08060');
    });

    it('should render with window highlight color', () => {
        const { container } = render(<SettlementSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
        });
        expect(fills).toContain('#F5D060');
    });

    it('should render window rects with rx 0.2', () => {
        const { container } = render(<SettlementSVG />);
        const windows = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#F5D060' && r.getAttribute('rx') === '0.2'
        );
        expect(windows.length).toBe(2);
    });

    it('should render door rects with rx', () => {
        const { container } = render(<SettlementSVG />);
        const doors = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#5A2E10'
        );
        expect(doors.length).toBe(3);
        doors.forEach(door => {
            expect(['0.3', '0.3', '0.2']).toContain(door.getAttribute('rx'));
        });
    });

    it('should render building wall rects with rx 0.5', () => {
        const { container } = render(<SettlementSVG />);
        const walls = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('rx') === '0.5' && r.getAttribute('stroke') === '#8B5A2B'
        );
        expect(walls.length).toBe(2);
    });

    it('should render Building 3 wall rect with rx 0.4', () => {
        const { container } = render(<SettlementSVG />);
        const wall = container.querySelector('rect[rx="0.4"]');
        expect(wall).toBeInTheDocument();
        expect(wall.getAttribute('fill')).toBe('#C49A6C');
    });

    it('should render building roofs with strokeLinejoin round', () => {
        const { container } = render(<SettlementSVG />);
        const roofs = container.querySelectorAll('polygon[stroke-linejoin="round"]');
        expect(roofs.length).toBe(3);
    });

    it('should render path with strokeLinecap round', () => {
        const { container } = render(<SettlementSVG />);
        const path = container.querySelector('path[stroke-linecap="round"]');
        expect(path).toBeInTheDocument();
    });

    it('should render all elements with correct SVG element types', () => {
        const { container } = render(<SettlementSVG />);
        const group = container.querySelector('g');
        expect(group.querySelector('ellipse')).toBeInTheDocument();
        expect(group.querySelector('rect')).toBeInTheDocument();
        expect(group.querySelector('polygon')).toBeInTheDocument();
        expect(group.querySelector('path')).toBeInTheDocument();
    });

    it('should render the correct total count of SVG children in group', () => {
        const { container } = render(<SettlementSVG />);
        const group = container.querySelector('g');
        const children = group.children;
        expect(children.length).toBe(15);
    });
});
