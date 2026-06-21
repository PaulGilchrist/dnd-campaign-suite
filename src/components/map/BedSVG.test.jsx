// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BedSVG from './BedSVG.jsx';

const renderBed = (props = {}) =>
    render(
        <svg>
            <BedSVG {...props} />
        </svg>
    );

describe('BedSVG', () => {
    describe('root element', () => {
        it('renders the root <g> element', () => {
            const { container } = renderBed();
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('applies the given id to the root group', () => {
            const { container } = renderBed({ id: 'bed-svg-1' });
            expect(container.querySelector('g#bed-svg-1')).toBeInTheDocument();
        });

        it('applies the given className to the root group', () => {
            const { container } = renderBed({ className: 'bed-custom' });
            expect(container.querySelector('g')).toHaveClass('bed-custom');
        });

        it('passes through rest props to the root group', () => {
            const { container } = renderBed({ 'data-test': 'bed' });
            expect(container.querySelector('g')).toHaveAttribute('data-test', 'bed');
        });
    });

    describe('component configuration', () => {
        it('renders with displayName', () => {
            expect(BedSVG.displayName).toBe('BedSVG');
        });

        it('renders as a forwardRef component', () => {
            const ref = vi.fn();
            renderBed({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('bed elements', () => {
        it('renders the outer wooden frame rect', () => {
            const { container } = renderBed();
            const frame = container.querySelector(
                'rect[x="2"][y="4"][width="68"][height="28"]'
            );
            expect(frame).toBeInTheDocument();
            expect(frame.getAttribute('rx')).toBe('3');
            expect(frame.getAttribute('ry')).toBe('3');
            expect(frame.getAttribute('fill')).toBe('#A0652D');
            expect(frame.getAttribute('stroke')).toBe('#6B3E1F');
            expect(frame.getAttribute('stroke-width')).toBe('0.8');
        });

        it('renders the mattress rect', () => {
            const { container } = renderBed();
            const mattress = container.querySelector(
                'rect[x="6"][y="8"][width="60"][height="20"]'
            );
            expect(mattress).toBeInTheDocument();
            expect(mattress.getAttribute('rx')).toBe('2');
            expect(mattress.getAttribute('ry')).toBe('2');
            expect(mattress.getAttribute('fill')).toBe('#D4A574');
            expect(mattress.getAttribute('stroke')).toBe('#B87A3A');
            expect(mattress.getAttribute('stroke-width')).toBe('0.5');
        });

        it('renders the pillow rect', () => {
            const { container } = renderBed();
            const pillow = container.querySelector(
                'rect[x="4"][y="10"][width="14"][height="16"]'
            );
            expect(pillow).toBeInTheDocument();
            expect(pillow.getAttribute('rx')).toBe('4');
            expect(pillow.getAttribute('ry')).toBe('4');
            expect(pillow.getAttribute('fill')).toBe('#F5F0E8');
            expect(pillow.getAttribute('stroke')).toBe('#D4CFC4');
        });

        it('renders the pillow shading rect', () => {
            const { container } = renderBed();
            const shading = container.querySelector(
                'rect[x="4"][y="10"][width="5"][height="16"]'
            );
            expect(shading).toBeInTheDocument();
            expect(shading.getAttribute('fill')).toBe('#E0DBD0');
            expect(shading.getAttribute('opacity')).toBe('0.5');
        });

        it('renders the pillow highlight rect', () => {
            const { container } = renderBed();
            const highlight = container.querySelector(
                'rect[x="13"][y="10"][width="5"][height="16"]'
            );
            expect(highlight).toBeInTheDocument();
            expect(highlight.getAttribute('fill')).toBe('#FAF7F2');
            expect(highlight.getAttribute('opacity')).toBe('0.4');
        });

        it('renders the blanket rect', () => {
            const { container } = renderBed();
            const blanket = container.querySelector(
                'rect[x="20"][y="6"][width="46"][height="24"]'
            );
            expect(blanket).toBeInTheDocument();
            expect(blanket.getAttribute('fill')).toBe('#3B5998');
            expect(blanket.getAttribute('stroke')).toBe('#2A4070');
            expect(blanket.getAttribute('stroke-width')).toBe('0.5');
        });

        it('renders the blanket fold rect', () => {
            const { container } = renderBed();
            const fold = container.querySelector(
                'rect[x="20"][y="28"][width="46"][height="3"]'
            );
            expect(fold).toBeInTheDocument();
            expect(fold.getAttribute('fill')).toBe('#2A4070');
            expect(fold.getAttribute('opacity')).toBe('0.6');
        });

        it('renders the blanket shading rect', () => {
            const { container } = renderBed();
            const shading = container.querySelector(
                'rect[x="20"][y="6"][width="12"][height="24"]'
            );
            expect(shading).toBeInTheDocument();
            expect(shading.getAttribute('fill')).toBe('#2A4070');
            expect(shading.getAttribute('opacity')).toBe('0.3');
        });

        it('renders the blanket highlight rect', () => {
            const { container } = renderBed();
            const highlight = container.querySelector(
                'rect[x="50"][y="6"][width="16"][height="24"]'
            );
            expect(highlight).toBeInTheDocument();
            expect(highlight.getAttribute('fill')).toBe('#4A6FB5');
            expect(highlight.getAttribute('opacity')).toBe('0.3');
        });

        it('renders the blanket fold line path', () => {
            const { container } = renderBed();
            const foldPath = container.querySelector(
                'path[d="M 20 18 Q 24 17 28 18"]'
            );
            expect(foldPath).toBeInTheDocument();
            expect(foldPath.getAttribute('fill')).toBe('none');
            expect(foldPath.getAttribute('stroke')).toBe('#2A4070');
            expect(foldPath.getAttribute('stroke-width')).toBe('0.5');
            expect(foldPath.getAttribute('opacity')).toBe('0.5');
        });
    });

    describe('wood grain lines', () => {
        it('renders wood grain lines on frame edges', () => {
            const { container } = renderBed();
            const grainPaths = container.querySelectorAll(
                'path[stroke="#7A4E20"][stroke-width="0.3"][opacity="0.4"]'
            );
            expect(grainPaths.length).toBeGreaterThanOrEqual(4);
        });

        it('renders the left top wood grain line', () => {
            const { container } = renderBed();
            const grainPath = container.querySelector(
                'path[d="M 8 10 Q 14 9 20 10"]'
            );
            expect(grainPath).toBeInTheDocument();
            expect(grainPath.getAttribute('fill')).toBe('none');
        });

        it('renders the left bottom wood grain line', () => {
            const { container } = renderBed();
            const grainPath = container.querySelector(
                'path[d="M 8 26 Q 14 25 20 26"]'
            );
            expect(grainPath).toBeInTheDocument();
            expect(grainPath.getAttribute('fill')).toBe('none');
        });

        it('renders the right top wood grain line', () => {
            const { container } = renderBed();
            const grainPath = container.querySelector(
                'path[d="M 56 10 Q 62 9 66 10"]'
            );
            expect(grainPath).toBeInTheDocument();
            expect(grainPath.getAttribute('fill')).toBe('none');
        });

        it('renders the right bottom wood grain line', () => {
            const { container } = renderBed();
            const grainPath = container.querySelector(
                'path[d="M 56 26 Q 62 25 66 26"]'
            );
            expect(grainPath).toBeInTheDocument();
            expect(grainPath.getAttribute('fill')).toBe('none');
        });
    });

    describe('frame shading and highlights', () => {
        it('renders the left side shading rect', () => {
            const { container } = renderBed();
            const shading = container.querySelector(
                'rect[x="2"][y="4"][width="10"][height="28"]'
            );
            expect(shading).toBeInTheDocument();
            expect(shading.getAttribute('fill')).toBe('#8B5524');
            expect(shading.getAttribute('opacity')).toBe('0.35');
        });

        it('renders the right side highlight rect', () => {
            const { container } = renderBed();
            const highlight = container.querySelector(
                'rect[x="58"][y="4"][width="12"][height="28"]'
            );
            expect(highlight).toBeInTheDocument();
            expect(highlight.getAttribute('fill')).toBe('#B87A3A');
            expect(highlight.getAttribute('opacity')).toBe('0.3');
        });

        it('renders the top edge bevel highlight rect', () => {
            const { container } = renderBed();
            const bevel = container.querySelector(
                'rect[x="4"][y="5"][width="64"][height="1.5"]'
            );
            expect(bevel).toBeInTheDocument();
            expect(bevel.getAttribute('fill')).toBe('#C4944A');
            expect(bevel.getAttribute('opacity')).toBe('0.4');
        });

        it('renders the front edge shadow rect', () => {
            const { container } = renderBed();
            const shadow = container.querySelector(
                'rect[x="4"][y="30"][width="64"][height="1.5"]'
            );
            expect(shadow).toBeInTheDocument();
            expect(shadow.getAttribute('fill')).toBe('#6B3E1F');
            expect(shadow.getAttribute('opacity')).toBe('0.3');
        });
    });

    describe('element counts', () => {
        it('renders at least 13 rects', () => {
            const { container } = renderBed();
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBeGreaterThanOrEqual(13);
        });

        it('renders at least 5 paths', () => {
            const { container } = renderBed();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBeGreaterThanOrEqual(5);
        });
    });
});
