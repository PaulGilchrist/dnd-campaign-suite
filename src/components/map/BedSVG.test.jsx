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
    it('should render the root <g> element', () => {
        const { container } = renderBed();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderBed({ id: 'bed-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('bed-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderBed({ className: 'bed-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('bed-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(BedSVG.displayName).toBe('BedSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderBed({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the outer wooden frame rect', () => {
        const { container } = renderBed();
        const frame = container.querySelector(
            'rect[x="2"][y="4"][width="68"][height="28"]'
        );
        expect(frame).not.toBeNull();
        expect(frame.getAttribute('rx')).toBe('3');
        expect(frame.getAttribute('ry')).toBe('3');
        expect(frame.getAttribute('fill')).toBe('#A0652D');
        expect(frame.getAttribute('stroke')).toBe('#6B3E1F');
        expect(frame.getAttribute('stroke-width')).toBe('0.8');
    });

    it('should render the mattress rect', () => {
        const { container } = renderBed();
        const mattress = container.querySelector(
            'rect[x="6"][y="8"][width="60"][height="20"]'
        );
        expect(mattress).not.toBeNull();
        expect(mattress.getAttribute('rx')).toBe('2');
        expect(mattress.getAttribute('ry')).toBe('2');
        expect(mattress.getAttribute('fill')).toBe('#D4A574');
        expect(mattress.getAttribute('stroke')).toBe('#B87A3A');
        expect(mattress.getAttribute('stroke-width')).toBe('0.5');
    });

    it('should render the pillow rect', () => {
        const { container } = renderBed();
        const pillow = container.querySelector(
            'rect[x="4"][y="10"][width="14"][height="16"]'
        );
        expect(pillow).not.toBeNull();
        expect(pillow.getAttribute('rx')).toBe('4');
        expect(pillow.getAttribute('ry')).toBe('4');
        expect(pillow.getAttribute('fill')).toBe('#F5F0E8');
        expect(pillow.getAttribute('stroke')).toBe('#D4CFC4');
    });

    it('should render the pillow shading rect', () => {
        const { container } = renderBed();
        const padding = container.querySelector(
            'rect[x="4"][y="10"][width="5"][height="16"]'
        );
        expect(padding).not.toBeNull();
        expect(padding.getAttribute('fill')).toBe('#E0DBD0');
        expect(padding.getAttribute('opacity')).toBe('0.5');
    });

    it('should render the pillow highlight rect', () => {
        const { container } = renderBed();
        const highlight = container.querySelector(
            'rect[x="13"][y="10"][width="5"][height="16"]'
        );
        expect(highlight).not.toBeNull();
        expect(highlight.getAttribute('fill')).toBe('#FAF7F2');
        expect(highlight.getAttribute('opacity')).toBe('0.4');
    });

    it('should render the blanket rect', () => {
        const { container } = renderBed();
        const blanket = container.querySelector(
            'rect[x="20"][y="6"][width="46"][height="24"]'
        );
        expect(blanket).not.toBeNull();
        expect(blanket.getAttribute('fill')).toBe('#3B5998');
        expect(blanket.getAttribute('stroke')).toBe('#2A4070');
        expect(blanket.getAttribute('stroke-width')).toBe('0.5');
    });

    it('should render the blanket fold rect', () => {
        const { container } = renderBed();
        const fold = container.querySelector(
            'rect[x="20"][y="28"][width="46"][height="3"]'
        );
        expect(fold).not.toBeNull();
        expect(fold.getAttribute('fill')).toBe('#2A4070');
        expect(fold.getAttribute('opacity')).toBe('0.6');
    });

    it('should render the blanket shading rect', () => {
        const { container } = renderBed();
        const shading = container.querySelector(
            'rect[x="20"][y="6"][width="12"][height="24"]'
        );
        expect(shading).not.toBeNull();
        expect(shading.getAttribute('fill')).toBe('#2A4070');
        expect(shading.getAttribute('opacity')).toBe('0.3');
    });

    it('should render the blanket highlight rect', () => {
        const { container } = renderBed();
        const highlight = container.querySelector(
            'rect[x="50"][y="6"][width="16"][height="24"]'
        );
        expect(highlight).not.toBeNull();
        expect(highlight.getAttribute('fill')).toBe('#4A6FB5');
        expect(highlight.getAttribute('opacity')).toBe('0.3');
    });

    it('should render the blanket fold line path', () => {
        const { container } = renderBed();
        const foldPath = container.querySelector(
            'path[d="M 20 18 Q 24 17 28 18"]'
        );
        expect(foldPath).not.toBeNull();
        expect(foldPath.getAttribute('fill')).toBe('none');
        expect(foldPath.getAttribute('stroke')).toBe('#2A4070');
        expect(foldPath.getAttribute('stroke-width')).toBe('0.5');
        expect(foldPath.getAttribute('opacity')).toBe('0.5');
    });

    it('should render the wood grain lines on frame edges', () => {
        const { container } = renderBed();
        const grainPaths = container.querySelectorAll(
            'path[stroke="#7A4E20"][stroke-width="0.3"][opacity="0.4"]'
        );
        expect(grainPaths.length).toBe(4);
    });

    it('should render the left top wood grain line', () => {
        const { container } = renderBed();
        const grainPath = container.querySelector(
            'path[d="M 8 10 Q 14 9 20 10"]'
        );
        expect(grainPath).not.toBeNull();
        expect(grainPath.getAttribute('fill')).toBe('none');
    });

    it('should render the left bottom wood grain line', () => {
        const { container } = renderBed();
        const grainPath = container.querySelector(
            'path[d="M 8 26 Q 14 25 20 26"]'
        );
        expect(grainPath).not.toBeNull();
        expect(grainPath.getAttribute('fill')).toBe('none');
    });

    it('should render the right top wood grain line', () => {
        const { container } = renderBed();
        const grainPath = container.querySelector(
            'path[d="M 56 10 Q 62 9 66 10"]'
        );
        expect(grainPath).not.toBeNull();
        expect(grainPath.getAttribute('fill')).toBe('none');
    });

    it('should render the right bottom wood grain line', () => {
        const { container } = renderBed();
        const grainPath = container.querySelector(
            'path[d="M 56 26 Q 62 25 66 26"]'
        );
        expect(grainPath).not.toBeNull();
        expect(grainPath.getAttribute('fill')).toBe('none');
    });

    it('should render the left side shading rect', () => {
        const { container } = renderBed();
        const shading = container.querySelector(
            'rect[x="2"][y="4"][width="10"][height="28"]'
        );
        expect(shading).not.toBeNull();
        expect(shading.getAttribute('fill')).toBe('#8B5524');
        expect(shading.getAttribute('opacity')).toBe('0.35');
    });

    it('should render the right side highlight rect', () => {
        const { container } = renderBed();
        const highlight = container.querySelector(
            'rect[x="58"][y="4"][width="12"][height="28"]'
        );
        expect(highlight).not.toBeNull();
        expect(highlight.getAttribute('fill')).toBe('#B87A3A');
        expect(highlight.getAttribute('opacity')).toBe('0.3');
    });

    it('should render the top edge bevel highlight rect', () => {
        const { container } = renderBed();
        const bevel = container.querySelector(
            'rect[x="4"][y="5"][width="64"][height="1.5"]'
        );
        expect(bevel).not.toBeNull();
        expect(bevel.getAttribute('fill')).toBe('#C4944A');
        expect(bevel.getAttribute('opacity')).toBe('0.4');
    });

    it('should render the front edge shadow rect', () => {
        const { container } = renderBed();
        const shadow = container.querySelector(
            'rect[x="4"][y="30"][width="64"][height="1.5"]'
        );
        expect(shadow).not.toBeNull();
        expect(shadow.getAttribute('fill')).toBe('#6B3E1F');
        expect(shadow.getAttribute('opacity')).toBe('0.3');
    });

    it('should render total rect count (13 rects)', () => {
        const { container } = renderBed();
        const rects = container.querySelectorAll('rect');
        // outer frame, mattress, pillow, pillow shading, pillow highlight,
        // blanket, blanket fold, blanket shading, blanket highlight,
        // left shading, right highlight, top bevel, front shadow = 13
        expect(rects.length).toBe(13);
    });

    it('should render total path count (5 paths)', () => {
        const { container } = renderBed();
        const paths = container.querySelectorAll('path');
        // blanket fold line, 4 wood grain lines = 5
        expect(paths.length).toBe(5);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderBed({ 'data-test': 'bed' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('bed');
    });
});
