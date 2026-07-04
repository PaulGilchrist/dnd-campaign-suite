// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LoreSiteSVG from './LoreSiteSVG.jsx';

describe('LoreSiteSVG', () => {
    describe('props and rendering', () => {
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
    });

    describe('ground shadow', () => {
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
    });

    describe('platform', () => {
        it('should render the stone circle platform ellipse', () => {
            const { container } = render(<LoreSiteSVG />);
            const platform = [...container.querySelectorAll('ellipse')].find(e =>
                e.getAttribute('fill') === 'none' && e.getAttribute('stroke') === '#78909C'
            );
            expect(platform).toBeInTheDocument();
            expect(platform.getAttribute('cx')).toBe('18');
            expect(platform.getAttribute('cy')).toBe('26');
            expect(platform.getAttribute('rx')).toBe('14');
            expect(platform.getAttribute('ry')).toBe('4');
            expect(platform.getAttribute('stroke-width')).toBe('0.4');
            expect(platform.getAttribute('opacity')).toBe('0.2');
        });
    });

    describe('standing stones', () => {
        const standingStoneRects = (container) =>
            [...container.querySelectorAll('rect')].filter(r =>
                r.getAttribute('fill') === '#78909C' && r.getAttribute('stroke') === '#546E7A'
            );

        it('should render 5 standing stones with correct body rects', () => {
            const { container } = render(<LoreSiteSVG />);
            const stones = standingStoneRects(container);
            expect(stones.length).toBe(5);

            const expected = [
                { x: '8', y: '12', width: '3', height: '14', rx: '0.4' },
                { x: '24', y: '14', width: '3', height: '12', rx: '0.4' },
                { x: '17', y: '8', width: '3', height: '18', rx: '0.4' },
                { x: '13', y: '18', width: '2.5', height: '8', rx: '0.3' },
                { x: '21', y: '19', width: '2.5', height: '7', rx: '0.3' },
            ];

            expected.forEach((exp, i) => {
                expect(stones[i].getAttribute('x')).toBe(exp.x);
                expect(stones[i].getAttribute('y')).toBe(exp.y);
                expect(stones[i].getAttribute('width')).toBe(exp.width);
                expect(stones[i].getAttribute('height')).toBe(exp.height);
                expect(stones[i].getAttribute('rx')).toBe(exp.rx);
                expect(stones[i].getAttribute('stroke-width')).toBe('0.5');
            });
        });

        it('should render 3 highlight rects on standing stones', () => {
            const { container } = render(<LoreSiteSVG />);
            const highlights = [...container.querySelectorAll('rect')].filter(r =>
                r.getAttribute('fill') === '#90A4AE' && r.getAttribute('opacity') === '0.4'
            );
            expect(highlights.length).toBe(3);

            highlights.forEach(h => {
                expect(h.getAttribute('rx')).toBe('0.2');
            });
        });

        it('should render stone tops with correct shapes and positions', () => {
            const { container } = render(<LoreSiteSVG />);

            const tops = [...container.querySelectorAll('ellipse')].filter(e =>
                e.getAttribute('fill') === '#78909C' && e.getAttribute('stroke') === '#546E7A'
            );
            expect(tops.length).toBe(3);

            const expectedEllipses = [
                { cx: '9.5', cy: '12', rx: '1.5', ry: '0.8' },
                { cx: '18.5', cy: '8', rx: '1.5', ry: '0.8' },
                { cx: '22.25', cy: '19', rx: '1.25', ry: '0.6' },
            ];
            expectedEllipses.forEach((exp, i) => {
                expect(tops[i].getAttribute('cx')).toBe(exp.cx);
                expect(tops[i].getAttribute('cy')).toBe(exp.cy);
                expect(tops[i].getAttribute('rx')).toBe(exp.rx);
                expect(tops[i].getAttribute('ry')).toBe(exp.ry);
                expect(tops[i].getAttribute('stroke-width')).toBe('0.4');
            });

            const polygons = [...container.querySelectorAll('polygon')];
            expect(polygons.length).toBe(2);
            expect(polygons[0].getAttribute('points')).toBe('24,14 27,14 25.5,11');
            expect(polygons[1].getAttribute('points')).toBe('13,18 15.5,18 14.25,15.5');
        });
    });

    describe('rune marks', () => {
        it('should render the rune path mark', () => {
            const { container } = render(<LoreSiteSVG />);
            const runePath = container.querySelector('path[stroke="#546E7A"]');
            expect(runePath).toBeInTheDocument();
            expect(runePath.getAttribute('d')).toBe('M 18 12 L 19 13 L 18 14');
            expect(runePath.getAttribute('stroke-width')).toBe('0.3');
            expect(runePath.getAttribute('opacity')).toBe('0.6');
        });

        it('should render the rune circle mark', () => {
            const { container } = render(<LoreSiteSVG />);
            const runeCircle = container.querySelector('circle[fill="none"][stroke="#546E7A"]');
            expect(runeCircle).toBeInTheDocument();
            expect(runeCircle.getAttribute('cx')).toBe('18.5');
            expect(runeCircle.getAttribute('cy')).toBe('16');
            expect(runeCircle.getAttribute('r')).toBe('0.5');
            expect(runeCircle.getAttribute('stroke-width')).toBe('0.3');
            expect(runeCircle.getAttribute('opacity')).toBe('0.6');
        });
    });

    describe('moss patches', () => {
        it('should render 3 moss ellipse patches with correct positions', () => {
            const { container } = render(<LoreSiteSVG />);
            const mosses = [...container.querySelectorAll('ellipse')].filter(e =>
                e.getAttribute('fill') === '#8D6E63'
            );
            expect(mosses.length).toBe(3);

            const expected = [
                { cx: '10', cy: '24', rx: '1.5', ry: '0.6', opacity: '0.3' },
                { cx: '25', cy: '23', rx: '1', ry: '0.5', opacity: '0.25' },
                { cx: '19', cy: '24', rx: '1', ry: '0.4', opacity: '0.2' },
            ];

            expected.forEach((exp, i) => {
                expect(mosses[i].getAttribute('cx')).toBe(exp.cx);
                expect(mosses[i].getAttribute('cy')).toBe(exp.cy);
                expect(mosses[i].getAttribute('rx')).toBe(exp.rx);
                expect(mosses[i].getAttribute('ry')).toBe(exp.ry);
                expect(mosses[i].getAttribute('opacity')).toBe(exp.opacity);
            });
        });
    });

    describe('ground stones', () => {
        it('should render ground stones with correct positions and sizes', () => {
            const { container } = render(<LoreSiteSVG />);
            const stones = [...container.querySelectorAll('circle')].filter(c =>
                c.getAttribute('fill') === '#546E7A'
            );
            expect(stones.length).toBe(4);

            const expected = [
                { cx: '6', cy: '28', r: '0.5', opacity: '0.3' },
                { cx: '30', cy: '27', r: '0.6', opacity: '0.3' },
                { cx: '14', cy: '29', r: '0.4', opacity: '0.25' },
                { cx: '22', cy: '29', r: '0.5', opacity: '0.25' },
            ];

            expected.forEach((exp, i) => {
                expect(stones[i].getAttribute('cx')).toBe(exp.cx);
                expect(stones[i].getAttribute('cy')).toBe(exp.cy);
                expect(stones[i].getAttribute('r')).toBe(exp.r);
                expect(stones[i].getAttribute('opacity')).toBe(exp.opacity);
            });
        });
    });

    describe('element types', () => {
        it('should render all expected SVG element types', () => {
            const { container } = render(<LoreSiteSVG />);
            const group = container.querySelector('g');
            expect(group.querySelector('ellipse')).toBeInTheDocument();
            expect(group.querySelector('rect')).toBeInTheDocument();
            expect(group.querySelector('polygon')).toBeInTheDocument();
            expect(group.querySelector('circle')).toBeInTheDocument();
            expect(group.querySelector('path')).toBeInTheDocument();
        });
    });

    describe('colors', () => {
        it('should use stone grays and brown for moss patches', () => {
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
            expect(fills).toContain('#8D6E63');
            expect(strokes).toContain('#546E7A');
        });
    });
});
