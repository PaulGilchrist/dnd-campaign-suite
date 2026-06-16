import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ArrowSlitWallSVG from './ArrowSlitWallSVG.jsx';

const renderArrowSlit = (props = {}) =>
    render(
        <svg>
            <ArrowSlitWallSVG {...props} />
        </svg>
    );

describe('ArrowSlitWallSVG', () => {
    it('should render the root <g> element', () => {
        const { container } = renderArrowSlit();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderArrowSlit({ id: 'arrow-slit-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('arrow-slit-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderArrowSlit({ className: 'arrow-slit-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('arrow-slit-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(ArrowSlitWallSVG.displayName).toBe('ArrowSlitWallSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderArrowSlit({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the background rect', () => {
        const { container } = renderArrowSlit();
        const bgRect = container.querySelector('rect[fill="#696969"]');
        expect(bgRect).not.toBeNull();
        expect(bgRect.getAttribute('width')).toBe('36');
        expect(bgRect.getAttribute('height')).toBe('36');
        expect(bgRect.getAttribute('opacity')).toBe('0.85');
    });

    it('should render the main wall polygon', () => {
        const { container } = renderArrowSlit();
        const wallPolygon = container.querySelector('polygon[fill="#2a2a2a"]');
        expect(wallPolygon).not.toBeNull();
        expect(wallPolygon.getAttribute('points')).toBe('16,4 20,4 30,36 6,36');
    });

    it('should render the left shadow polygon', () => {
        const { container } = renderArrowSlit();
        const leftShadow = container.querySelector('polygon[fill="#3a3a3a"]');
        expect(leftShadow).not.toBeNull();
        expect(leftShadow.getAttribute('opacity')).toBe('0.4');
    });

    it('should render the right shadow polygon', () => {
        const { container } = renderArrowSlit();
        const rightShadow = container.querySelector('polygon[fill="#4a4a4a"]');
        expect(rightShadow).not.toBeNull();
        expect(rightShadow.getAttribute('opacity')).toBe('0.3');
    });

    it('should render the center line', () => {
        const { container } = renderArrowSlit();
        const centerLine = container.querySelector('line');
        expect(centerLine).not.toBeNull();
        expect(centerLine.getAttribute('x1')).toBe('18');
        expect(centerLine.getAttribute('y1')).toBe('4');
        expect(centerLine.getAttribute('x2')).toBe('18');
        expect(centerLine.getAttribute('y2')).toBe('36');
        expect(centerLine.getAttribute('stroke')).toBe('#4a4a4a');
        expect(centerLine.getAttribute('stroke-width')).toBe('1');
    });

    it('should render total rect count', () => {
        const { container } = renderArrowSlit();
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(1);
    });

    it('should render total polygon count', () => {
        const { container } = renderArrowSlit();
        const polygons = container.querySelectorAll('polygon');
        expect(polygons.length).toBe(3);
    });

    it('should render total line count', () => {
        const { container } = renderArrowSlit();
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(1);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderArrowSlit({ 'data-test': 'arrow-slit' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('arrow-slit');
    });
});
