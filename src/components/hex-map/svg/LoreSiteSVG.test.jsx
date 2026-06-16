import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoreSiteSVG from './LoreSiteSVG.jsx';

describe('LoreSiteSVG', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the SVG group element', () => {
        const { container } = render(<LoreSiteSVG />);
        const group = container.querySelector('g');
        expect(group).toBeInTheDocument();
    });

    it('should render with the provided id attribute', () => {
        const { container } = render(<LoreSiteSVG id="lore-1" />);
        const group = container.querySelector('g');
        expect(group.getAttribute('id')).toBe('lore-1');
    });

    it('should render with the provided className', () => {
        const { container } = render(<LoreSiteSVG className="lore-site-icon" />);
        const group = container.querySelector('g');
        expect(group.getAttribute('class')).toBe('lore-site-icon');
    });

    it('should pass through additional props via spread', () => {
        const { container } = render(<LoreSiteSVG data-testid="lore-svg" onClick={vi.fn()} />);
        const group = container.querySelector('g');
        expect(group.getAttribute('data-testid')).toBe('lore-svg');
    });

    it('should support ref forwarding', () => {
        const ref = vi.fn();
        render(<LoreSiteSVG ref={ref} />);
        expect(ref).toHaveBeenCalled();
    });

    it('should render with displayName LoreSiteSVG', () => {
        expect(LoreSiteSVG.displayName).toBe('LoreSiteSVG');
    });

    // Ground shadow / circle shadow
    it('should render the ground shadow ellipse', () => {
        const { container } = render(<LoreSiteSVG />);
        const shadow = container.querySelector('ellipse[fill="#546E7A"]');
        expect(shadow).toBeInTheDocument();
        expect(shadow.getAttribute('cx')).toBe('18');
        expect(shadow.getAttribute('cy')).toBe('26');
        expect(shadow.getAttribute('rx')).toBe('16');
        expect(shadow.getAttribute('ry')).toBe('6');
        expect(shadow.getAttribute('opacity')).toBe('0.08');
    });

    // Stone circle platform / ground ring
    it('should render the stone circle platform ellipse', () => {
        const { container } = render(<LoreSiteSVG />);
        const platform = container.querySelector('ellipse[stroke="#78909C"]');
        expect(platform).toBeInTheDocument();
        expect(platform.getAttribute('cx')).toBe('18');
        expect(platform.getAttribute('cy')).toBe('26');
        expect(platform.getAttribute('rx')).toBe('14');
        expect(platform.getAttribute('ry')).toBe('4');
        expect(platform.getAttribute('stroke-width')).toBe('0.4');
        expect(platform.getAttribute('opacity')).toBe('0.2');
    });

    // Standing Stone 1 (back-left)
    it('should render Standing Stone 1 body rect', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone1Rect = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '8' && r.getAttribute('y') === '12' && r.getAttribute('width') === '3' && r.getAttribute('height') === '14'
        );
        expect(stone1Rect).toBeInTheDocument();
        expect(stone1Rect.getAttribute('rx')).toBe('0.4');
        expect(stone1Rect.getAttribute('stroke-width')).toBe('0.5');
    });

    it('should render Standing Stone 1 highlight', () => {
        const { container } = render(<LoreSiteSVG />);
        const highlight = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '8' && r.getAttribute('fill') === '#90A4AE' && r.getAttribute('opacity') === '0.4'
        );
        expect(highlight).toBeInTheDocument();
        expect(highlight.getAttribute('width')).toBe('1');
        expect(highlight.getAttribute('height')).toBe('14');
        expect(highlight.getAttribute('rx')).toBe('0.2');
    });

    it('should render Standing Stone 1 top rounded ellipse', () => {
        const { container } = render(<LoreSiteSVG />);
        const top = [...container.querySelectorAll('ellipse')].find(e =>
            e.getAttribute('cx') === '9.5' && e.getAttribute('cy') === '12'
        );
        expect(top).toBeInTheDocument();
        expect(top.getAttribute('rx')).toBe('1.5');
        expect(top.getAttribute('ry')).toBe('0.8');
        expect(top.getAttribute('stroke')).toBe('#546E7A');
    });

    // Standing Stone 2 (back-right)
    it('should render Standing Stone 2 body rect', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone2 = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '24' && r.getAttribute('y') === '14' && r.getAttribute('width') === '3' && r.getAttribute('height') === '12'
        );
        expect(stone2).toBeInTheDocument();
        expect(stone2.getAttribute('fill')).toBe('#78909C');
        expect(stone2.getAttribute('stroke')).toBe('#546E7A');
    });

    it('should render Standing Stone 2 highlight', () => {
        const { container } = render(<LoreSiteSVG />);
        const highlight = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '24' && r.getAttribute('fill') === '#90A4AE' && r.getAttribute('opacity') === '0.4'
        );
        expect(highlight).toBeInTheDocument();
        expect(highlight.getAttribute('height')).toBe('12');
    });

    it('should render Standing Stone 2 top pointed polygon', () => {
        const { container } = render(<LoreSiteSVG />);
        const top = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('points') === '24,14 27,14 25.5,11'
        );
        expect(top).toBeInTheDocument();
        expect(top.getAttribute('fill')).toBe('#78909C');
        expect(top.getAttribute('stroke')).toBe('#546E7A');
    });

    // Standing Stone 3 (center, tallest)
    it('should render Standing Stone 3 body rect', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone3 = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '17' && r.getAttribute('y') === '8' && r.getAttribute('width') === '3' && r.getAttribute('height') === '18'
        );
        expect(stone3).toBeInTheDocument();
        expect(stone3.getAttribute('fill')).toBe('#78909C');
    });

    it('should render Standing Stone 3 highlight', () => {
        const { container } = render(<LoreSiteSVG />);
        const highlight = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '17' && r.getAttribute('fill') === '#90A4AE' && r.getAttribute('opacity') === '0.4'
        );
        expect(highlight).toBeInTheDocument();
        expect(highlight.getAttribute('height')).toBe('18');
    });

    it('should render Standing Stone 3 top rounded ellipse', () => {
        const { container } = render(<LoreSiteSVG />);
        const top = [...container.querySelectorAll('ellipse')].find(e =>
            e.getAttribute('cx') === '18.5' && e.getAttribute('cy') === '8'
        );
        expect(top).toBeInTheDocument();
        expect(top.getAttribute('rx')).toBe('1.5');
        expect(top.getAttribute('ry')).toBe('0.8');
    });

    // Standing Stone 4 (front-left)
    it('should render Standing Stone 4 body rect', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone4 = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '13' && r.getAttribute('y') === '18' && r.getAttribute('width') === '2.5' && r.getAttribute('height') === '8'
        );
        expect(stone4).toBeInTheDocument();
        expect(stone4.getAttribute('rx')).toBe('0.3');
    });

    it('should render Standing Stone 4 top pointed polygon', () => {
        const { container } = render(<LoreSiteSVG />);
        const top = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('points') === '13,18 15.5,18 14.25,15.5'
        );
        expect(top).toBeInTheDocument();
        expect(top.getAttribute('fill')).toBe('#78909C');
    });

    // Standing Stone 5 (front-right)
    it('should render Standing Stone 5 body rect', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone5 = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '21' && r.getAttribute('y') === '19' && r.getAttribute('width') === '2.5' && r.getAttribute('height') === '7'
        );
        expect(stone5).toBeInTheDocument();
        expect(stone5.getAttribute('rx')).toBe('0.3');
    });

    it('should render Standing Stone 5 top rounded ellipse', () => {
        const { container } = render(<LoreSiteSVG />);
        const top = [...container.querySelectorAll('ellipse')].find(e =>
            e.getAttribute('cx') === '22.25' && e.getAttribute('cy') === '19'
        );
        expect(top).toBeInTheDocument();
        expect(top.getAttribute('rx')).toBe('1.25');
        expect(top.getAttribute('ry')).toBe('0.6');
    });

    // Ancient rune marks
    it('should render the rune path mark', () => {
        const { container } = render(<LoreSiteSVG />);
        const runePath = container.querySelector('path[stroke="#546E7A"]');
        expect(runePath).toBeInTheDocument();
        expect(runePath.getAttribute('stroke-width')).toBe('0.3');
        expect(runePath.getAttribute('opacity')).toBe('0.6');
    });

    it('should render the rune circle mark', () => {
        const { container } = render(<LoreSiteSVG />);
        const runeCircle = [...container.querySelectorAll('circle')].find(c =>
            c.getAttribute('cx') === '18.5' && c.getAttribute('cy') === '16'
        );
        expect(runeCircle).toBeInTheDocument();
        expect(runeCircle.getAttribute('r')).toBe('0.5');
        expect(runeCircle.getAttribute('fill')).toBe('none');
    });

    // Moss / lichen patches
    it('should render moss patches', () => {
        const { container } = render(<LoreSiteSVG />);
        const mosses = [...container.querySelectorAll('ellipse')].filter(e =>
            e.getAttribute('fill') === '#8D6E63'
        );
        expect(mosses.length).toBe(3);
        expect(mosses[0].getAttribute('cx')).toBe('10');
        expect(mosses[1].getAttribute('cx')).toBe('25');
        expect(mosses[2].getAttribute('cx')).toBe('19');
    });

    // Ground stones / rubble
    it('should render ground stones', () => {
        const { container } = render(<LoreSiteSVG />);
        const stones = [...container.querySelectorAll('circle')].filter(c =>
            c.getAttribute('fill') === '#546E7A'
        );
        expect(stones.length).toBe(4);
    });

    it('should render the left ground stone', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone = [...container.querySelectorAll('circle')].find(c =>
            c.getAttribute('cx') === '6' && c.getAttribute('cy') === '28'
        );
        expect(stone).toBeInTheDocument();
        expect(stone.getAttribute('r')).toBe('0.5');
    });

    it('should render the right ground stone', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone = [...container.querySelectorAll('circle')].find(c =>
            c.getAttribute('cx') === '30' && c.getAttribute('cy') === '27'
        );
        expect(stone).toBeInTheDocument();
        expect(stone.getAttribute('r')).toBe('0.6');
    });

    // Element counts
    it('should render the correct count of ellipse elements', () => {
        const { container } = render(<LoreSiteSVG />);
        const ellipses = container.querySelectorAll('ellipse');
        expect(ellipses.length).toBe(8);
    });

    it('should render the correct count of rect elements', () => {
        const { container } = render(<LoreSiteSVG />);
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(8);
    });

    it('should render the correct count of polygon elements', () => {
        const { container } = render(<LoreSiteSVG />);
        const polygons = container.querySelectorAll('polygon');
        expect(polygons.length).toBe(2);
    });

    it('should render the correct count of circle elements', () => {
        const { container } = render(<LoreSiteSVG />);
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(5);
    });

    it('should render the correct count of path elements', () => {
        const { container } = render(<LoreSiteSVG />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(1);
    });

    it('should render exactly 1 path element (rune mark)', () => {
        const { container } = render(<LoreSiteSVG />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(1);
    });

    it('should render the correct total count of SVG children in group', () => {
        const { container } = render(<LoreSiteSVG />);
        const group = container.querySelector('g');
        const children = group.children;
        expect(children.length).toBe(24);
    });

    // Element types
    it('should render with all expected SVG element types', () => {
        const { container } = render(<LoreSiteSVG />);
        const group = container.querySelector('g');
        expect(group.querySelector('ellipse')).toBeInTheDocument();
        expect(group.querySelector('rect')).toBeInTheDocument();
        expect(group.querySelector('polygon')).toBeInTheDocument();
        expect(group.querySelector('circle')).toBeInTheDocument();
        expect(group.querySelector('path')).toBeInTheDocument();
    });

    // Colors
    it('should render with stone colors', () => {
        const { container } = render(<LoreSiteSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        const strokes = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
            if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
        });
        expect(fills).toContain('#78909C');
        expect(fills).toContain('#546E7A');
        expect(fills).toContain('#90A4AE');
        expect(strokes).toContain('#546E7A');
    });

    it('should render with moss colors', () => {
        const { container } = render(<LoreSiteSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
        });
        expect(fills).toContain('#8D6E63');
    });

    it('should render with rune mark opacity', () => {
        const { container } = render(<LoreSiteSVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const opacities = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('opacity')) opacities.add(el.getAttribute('opacity'));
        });
        expect(opacities).toContain('0.6');
    });

    // Stone-specific positioning
    it('should render the tallest stone (stone 3) at the center', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone3 = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '17' && r.getAttribute('height') === '18'
        );
        expect(stone3).toBeInTheDocument();
        expect(stone3.getAttribute('y')).toBe('8');
    });

    it('should render the back-left stone (stone 1) at y=12', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone1 = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '8' && r.getAttribute('y') === '12'
        );
        expect(stone1).toBeInTheDocument();
    });

    it('should render the back-right stone (stone 2) at y=14', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone2 = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '24' && r.getAttribute('y') === '14'
        );
        expect(stone2).toBeInTheDocument();
    });

    it('should render the front-left stone (stone 4) at y=18', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone4 = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '13' && r.getAttribute('y') === '18'
        );
        expect(stone4).toBeInTheDocument();
    });

    it('should render the front-right stone (stone 5) at y=19', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone5 = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '21' && r.getAttribute('y') === '19'
        );
        expect(stone5).toBeInTheDocument();
    });

    // Stone heights
    it('should render standing stones with varying heights', () => {
        const { container } = render(<LoreSiteSVG />);
        const stoneHeights = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#78909C' && r.getAttribute('stroke') === '#546E7A'
        ).map(r => parseInt(r.getAttribute('height')));
        expect(stoneHeights).toContain(18);
        expect(stoneHeights).toContain(14);
        expect(stoneHeights).toContain(12);
        expect(stoneHeights).toContain(8);
        expect(stoneHeights).toContain(7);
    });

    // Stroke widths
    it('should render stones with stroke-width 0.5', () => {
        const { container } = render(<LoreSiteSVG />);
        const stones = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#78909C' && r.getAttribute('stroke-width') === '0.5'
        );
        expect(stones.length).toBe(5);
    });

    it('should render stone tops with stroke-width 0.4', () => {
        const { container } = render(<LoreSiteSVG />);
        const tops = [...container.querySelectorAll('ellipse')].filter(e =>
            e.getAttribute('stroke-width') === '0.4'
        );
        expect(tops.length).toBe(4);
    });

    it('should render polygon tops with stroke-width 0.4', () => {
        const { container } = render(<LoreSiteSVG />);
        const polygons = [...container.querySelectorAll('polygon')].filter(p =>
            p.getAttribute('stroke-width') === '0.4'
        );
        expect(polygons.length).toBe(2);
    });

    it('should render rune marks with stroke-width 0.3', () => {
        const { container } = render(<LoreSiteSVG />);
        const runes = [...container.querySelectorAll('path, circle')].filter(el =>
            el.getAttribute('stroke-width') === '0.3'
        );
        expect(runes.length).toBe(2);
    });

    // Highlight rects
    it('should render 3 stone highlight rects', () => {
        const { container } = render(<LoreSiteSVG />);
        const highlights = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#90A4AE' && r.getAttribute('opacity') === '0.4'
        );
        expect(highlights.length).toBe(3);
    });

    // Platform ellipse
    it('should render the stone circle platform with no fill', () => {
        const { container } = render(<LoreSiteSVG />);
        const platform = [...container.querySelectorAll('ellipse')].find(e =>
            e.getAttribute('fill') === 'none' && e.getAttribute('stroke') === '#78909C'
        );
        expect(platform).toBeInTheDocument();
    });

    // Ground stones opacity
    it('should render ground stones with varying opacity', () => {
        const { container } = render(<LoreSiteSVG />);
        const stones = [...container.querySelectorAll('circle')].filter(c =>
            c.getAttribute('fill') === '#546E7A'
        );
        const opacities = stones.map(c => c.getAttribute('opacity'));
        expect(opacities).toContain('0.3');
        expect(opacities).toContain('0.25');
    });

    // Moss opacity
    it('should render moss patches with varying opacity', () => {
        const { container } = render(<LoreSiteSVG />);
        const mosses = [...container.querySelectorAll('ellipse')].filter(e =>
            e.getAttribute('fill') === '#8D6E63'
        );
        const opacities = mosses.map(e => e.getAttribute('opacity'));
        expect(opacities).toContain('0.3');
        expect(opacities).toContain('0.25');
        expect(opacities).toContain('0.2');
    });

    // Stone 1 width
    it('should render standing stone 1 with width 3', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone1 = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '8' && r.getAttribute('width') === '3'
        );
        expect(stone1).toBeInTheDocument();
    });

    // Stone 2 width
    it('should render standing stone 2 with width 3', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone2 = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '24' && r.getAttribute('width') === '3'
        );
        expect(stone2).toBeInTheDocument();
    });

    // Stone 3 width
    it('should render standing stone 3 with width 3', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone3 = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '17' && r.getAttribute('width') === '3'
        );
        expect(stone3).toBeInTheDocument();
    });

    // Stone 4 width
    it('should render standing stone 4 with width 2.5', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone4 = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '13' && r.getAttribute('width') === '2.5'
        );
        expect(stone4).toBeInTheDocument();
    });

    // Stone 5 width
    it('should render standing stone 5 with width 2.5', () => {
        const { container } = render(<LoreSiteSVG />);
        const stone5 = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '21' && r.getAttribute('width') === '2.5'
        );
        expect(stone5).toBeInTheDocument();
    });

    // All elements within group
    it('should render all elements within the group', () => {
        const { container } = render(<LoreSiteSVG />);
        const group = container.querySelector('g');
        const children = group.children;
        expect(children.length).toBeGreaterThan(0);
    });
});
