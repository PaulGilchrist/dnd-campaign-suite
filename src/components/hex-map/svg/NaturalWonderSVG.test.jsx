// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NaturalWonderSVG from './NaturalWonderSVG.jsx';

describe('NaturalWonderSVG', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('props and rendering', () => {
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

        it('should have displayName NaturalWonderSVG', () => {
            expect(NaturalWonderSVG.displayName).toBe('NaturalWonderSVG');
        });
    });

    describe('magic glow aura', () => {
        it('should render 3 glow circles centered at 18,18', () => {
            const { container } = render(<NaturalWonderSVG />);
            const glowCircles = [...container.querySelectorAll('circle')].filter(c =>
                c.getAttribute('cx') === '18' && c.getAttribute('cy') === '18'
            );
            expect(glowCircles.length).toBe(3);
        });

        it('should render glow circles with correct radii, fills, and opacities', () => {
            const { container } = render(<NaturalWonderSVG />);
            const outer = container.querySelector('circle[r="16"]');
            expect(outer).toHaveAttribute('fill', '#4A90D9');
            expect(outer).toHaveAttribute('opacity', '0.06');

            const mid = container.querySelector('circle[r="12"]');
            expect(mid).toHaveAttribute('fill', '#7CB342');
            expect(mid).toHaveAttribute('opacity', '0.06');

            const inner = container.querySelector('circle[r="8"]');
            expect(inner).toHaveAttribute('fill', '#C5E1A5');
            expect(inner).toHaveAttribute('opacity', '0.05');
        });
    });

    describe('crystal base', () => {
        it('should render the ground shadow ellipse', () => {
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
    });

    describe('crystal facets', () => {
        const facets = [
            { fill: '#6B9B37', strokeWidth: '0.6', name: 'left' },
            { fill: '#7CB342', strokeWidth: '0.6', name: 'right' },
            { fill: '#8BC34A', strokeWidth: '0.5', name: 'front' },
            { fill: '#9CCC65', strokeWidth: '0.4', name: 'top-left' },
            { fill: '#AED581', strokeWidth: '0.4', name: 'top-right' },
        ];

        facets.forEach(({ fill, strokeWidth, name }) => {
            it(`should render the ${name} crystal facet polygon`, () => {
                const { container } = render(<NaturalWonderSVG />);
                const facet = container.querySelector(`polygon[fill="${fill}"]`);
                expect(facet).toBeInTheDocument();
                expect(facet.getAttribute('stroke')).toBe('#558B2F');
                expect(facet.getAttribute('stroke-width')).toBe(strokeWidth);
                expect(facet.getAttribute('stroke-linejoin')).toBe('round');
            });
        });

        it('should render a crystal highlight sparkle polygon', () => {
            const { container } = render(<NaturalWonderSVG />);
            const sparkle = container.querySelector('polygon[opacity="0.4"]');
            expect(sparkle).toBeInTheDocument();
            expect(sparkle.getAttribute('fill')).toBe('#C5E1A5');
        });
    });

    describe('inner glow line', () => {
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
    });

    describe('sparkles', () => {
        const sparkles = [
            { d: 'M 5 6 L 5.5 5 L 6 6 L 5.5 7 Z', opacity: '0.8', name: 'top-left' },
            { d: 'M 30 4 L 30.5 3 L 31 4 L 30.5 5 Z', opacity: '0.8', name: 'top-right' },
            { d: 'M 3 16 L 3.5 15 L 4 16 L 3.5 17 Z', opacity: '0.6', name: 'left' },
            { d: 'M 32 14 L 32.5 13 L 33 14 L 32.5 15 Z', opacity: '0.7', name: 'right' },
            { d: 'M 20 32 L 20.5 31 L 21 32 L 20.5 33 Z', opacity: '0.5', name: 'bottom' },
        ];

        it('should render 5 sparkle path elements', () => {
            const { container } = render(<NaturalWonderSVG />);
            const sparklePaths = [...container.querySelectorAll('path')].filter(p =>
                p.getAttribute('fill') === '#C5E1A5'
            );
            expect(sparklePaths.length).toBe(5);
        });

        it('should render 2 sparkle line paths with white stroke', () => {
            const { container } = render(<NaturalWonderSVG />);
            const sparkleLines = [...container.querySelectorAll('path')].filter(p =>
                p.getAttribute('stroke') === '#FFF'
            );
            expect(sparkleLines.length).toBe(2);
        });

        sparkles.forEach(({ d, opacity, name }) => {
            it(`should render sparkle ${name} with correct shape and opacity`, () => {
                const { container } = render(<NaturalWonderSVG />);
                const sparkle = [...container.querySelectorAll('path')].find(p =>
                    p.getAttribute('d') === d
                );
                expect(sparkle).toBeInTheDocument();
                expect(sparkle.getAttribute('opacity')).toBe(opacity);
            });
        });
    });

    describe('light motes', () => {
        it('should render 6 floating light motes', () => {
            const { container } = render(<NaturalWonderSVG />);
            const allCircles = [...container.querySelectorAll('circle')];
            const motes = allCircles.filter(c =>
                c.getAttribute('cx') !== '18' || c.getAttribute('cy') !== '18'
            );
            expect(motes.length).toBe(6);
        });

        it('should render light motes at correct positions', () => {
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
    });

    describe('small crystals', () => {
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
    });

    describe('colors', () => {
        it('should use crystal green fill colors', () => {
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

        it('should use highlight colors', () => {
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

        it('should use sparkle colors', () => {
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

        it('should use glow colors', () => {
            const { container } = render(<NaturalWonderSVG />);
            const group = container.querySelector('g');
            const allElements = group.querySelectorAll('*');
            const fills = new Set();
            allElements.forEach(el => {
                if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
            });
            expect(fills).toContain('#4A90D9');
        });

        it('should use stroke color #558B2F for crystal facets', () => {
            const { container } = render(<NaturalWonderSVG />);
            const group = container.querySelector('g');
            const allElements = group.querySelectorAll('*');
            const strokes = new Set();
            allElements.forEach(el => {
                if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
            });
            expect(strokes).toContain('#558B2F');
        });
    });

    describe('element types', () => {
        it('should render all expected SVG element types', () => {
            const { container } = render(<NaturalWonderSVG />);
            const group = container.querySelector('g');
            expect(group.querySelector('circle')).toBeInTheDocument();
            expect(group.querySelector('ellipse')).toBeInTheDocument();
            expect(group.querySelector('polygon')).toBeInTheDocument();
            expect(group.querySelector('line')).toBeInTheDocument();
            expect(group.querySelector('path')).toBeInTheDocument();
        });
    });

    describe('opacities', () => {
        it('should render with expected opacity values', () => {
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
});
