// @improved-by-ai
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
        expect(container.querySelector('g')).toBeInTheDocument();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderArrowSlit({ id: 'arrow-slit-1' });
        expect(container.querySelector('g')).toHaveAttribute('id', 'arrow-slit-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderArrowSlit({ className: 'arrow-slit-custom' });
        expect(container.querySelector('g')).toHaveClass('arrow-slit-custom');
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
        expect(bgRect).toBeInTheDocument();
        expect(bgRect).toHaveAttribute('width', '36');
        expect(bgRect).toHaveAttribute('height', '36');
        expect(bgRect).toHaveAttribute('opacity', '0.85');
    });

    it('should render the main wall polygon', () => {
        const { container } = renderArrowSlit();
        const wallPolygon = container.querySelector('polygon[fill="#2a2a2a"]');
        expect(wallPolygon).toBeInTheDocument();
        expect(wallPolygon).toHaveAttribute('points', '16,4 20,4 30,36 6,36');
    });

    it('should render the left shadow polygon', () => {
        const { container } = renderArrowSlit();
        const leftShadow = container.querySelector('polygon[fill="#3a3a3a"]');
        expect(leftShadow).toBeInTheDocument();
        expect(leftShadow).toHaveAttribute('opacity', '0.4');
    });

    it('should render the right shadow polygon', () => {
        const { container } = renderArrowSlit();
        const rightShadow = container.querySelector('polygon[fill="#4a4a4a"]');
        expect(rightShadow).toBeInTheDocument();
        expect(rightShadow).toHaveAttribute('opacity', '0.3');
    });

    it('should render the center line', () => {
        const { container } = renderArrowSlit();
        const centerLine = container.querySelector('line');
        expect(centerLine).toBeInTheDocument();
        expect(centerLine).toHaveAttribute('stroke', '#4a4a4a');
        expect(centerLine).toHaveAttribute('x1', '18');
        expect(centerLine).toHaveAttribute('x2', '18');
    });

    it('should render polygon elements', () => {
        const { container } = renderArrowSlit();
        const polygons = container.querySelectorAll('polygon');
        expect(polygons.length).toBeGreaterThan(0);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderArrowSlit({ 'data-test': 'arrow-slit' });
        expect(container.querySelector('g')).toHaveAttribute('data-test', 'arrow-slit');
    });
});
