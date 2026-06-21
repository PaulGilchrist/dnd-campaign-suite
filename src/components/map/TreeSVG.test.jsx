// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TreeSVG from './TreeSVG.jsx';

const renderTree = (props = {}) =>
    render(
        <svg>
            <TreeSVG {...props} />
        </svg>
    );

describe('TreeSVG', () => {
    describe('root element', () => {
        it('should render the root <g> element', () => {
            const { container } = renderTree();
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('should apply the given id to the root group', () => {
            const { container } = renderTree({ id: 'tree-svg-1' });
            expect(container.querySelector('g')).toHaveAttribute('id', 'tree-svg-1');
        });

        it('should apply the given className to the root group', () => {
            const { container } = renderTree({ className: 'tree-custom' });
            expect(container.querySelector('g')).toHaveClass('tree-custom');
        });

        it('should pass through rest props to the root group', () => {
            const { container } = renderTree({ 'data-test': 'tree' });
            expect(container.querySelector('g')).toHaveAttribute('data-test', 'tree');
        });
    });

    describe('component metadata', () => {
        it('should render with displayName', () => {
            expect(TreeSVG.displayName).toBe('TreeSVG');
        });

        it('should render as a forwardRef component', () => {
            const ref = vi.fn();
            renderTree({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('shadow and trunk', () => {
        it('should render the shadow ellipse', () => {
            const { container } = renderTree();
            const shadow = container.querySelector('ellipse');
            expect(shadow).toBeInTheDocument();
            expect(shadow).toHaveAttribute('fill', '#000');
            expect(shadow).toHaveAttribute('opacity', '0.15');
        });

        it('should render the trunk rect', () => {
            const { container } = renderTree();
            const trunk = container.querySelector('rect');
            expect(trunk).toBeInTheDocument();
            expect(trunk).toHaveAttribute('rx', '1.5');
            expect(trunk).toHaveAttribute('fill', '#6B3E1F');
            expect(trunk).toHaveAttribute('stroke', '#4A2810');
            expect(trunk).toHaveAttribute('stroke-width', '0.5');
        });

        it('should render the trunk grain path', () => {
            const { container } = renderTree();
            const grainPath = container.querySelector('path[d="M 17 18 Q 16 23 17 33"]');
            expect(grainPath).toBeInTheDocument();
            expect(grainPath).toHaveAttribute('fill', 'none');
            expect(grainPath).toHaveAttribute('stroke', '#5C3317');
            expect(grainPath).toHaveAttribute('stroke-width', '0.6');
            expect(grainPath).toHaveAttribute('opacity', '0.5');
        });
    });

    describe('foliage layers', () => {
        it('should render the bottom foliage layer (darkest)', () => {
            const { container } = renderTree();
            const bottomFoliage = container.querySelector(
                'path[d="M 18 4 Q 4 12 6 24 Q 10 20 12 24 Q 14 18 18 20 Q 22 18 24 24 Q 26 20 30 24 Q 32 12 18 4 Z"]'
            );
            expect(bottomFoliage).toBeInTheDocument();
            expect(bottomFoliage).toHaveAttribute('fill', '#2D5E37');
            expect(bottomFoliage).toHaveAttribute('stroke', '#1E4025');
            expect(bottomFoliage).toHaveAttribute('stroke-width', '0.5');
        });

        it('should render the middle foliage layer', () => {
            const { container } = renderTree();
            const midFoliage = container.querySelector(
                'path[d="M 18 6 Q 6 13 8 22 Q 12 18 14 22 Q 16 17 18 18 Q 20 17 22 22 Q 24 18 28 22 Q 30 13 18 6 Z"]'
            );
            expect(midFoliage).toBeInTheDocument();
            expect(midFoliage).toHaveAttribute('fill', '#3D7A4A');
            expect(midFoliage).toHaveAttribute('stroke', '#2D5E37');
            expect(midFoliage).toHaveAttribute('stroke-width', '0.4');
        });

        it('should render the top foliage layer (lightest)', () => {
            const { container } = renderTree();
            const topFoliage = container.querySelector(
                'path[d="M 18 8 Q 8 14 10 21 Q 13 17 15 20 Q 17 16 18 17 Q 19 16 21 20 Q 23 17 26 21 Q 28 14 18 8 Z"]'
            );
            expect(topFoliage).toBeInTheDocument();
            expect(topFoliage).toHaveAttribute('fill', '#4A9A5A');
            expect(topFoliage).toHaveAttribute('stroke', '#3D7A4A');
            expect(topFoliage).toHaveAttribute('stroke-width', '0.3');
        });
    });

    describe('highlight spots', () => {
        it('should render the first highlight spot ellipse', () => {
            const { container } = renderTree();
            const highlight1 = container.querySelector('ellipse[cx="14"][cy="14"]');
            expect(highlight1).toBeInTheDocument();
            expect(highlight1).toHaveAttribute('fill', '#5AAB6A');
            expect(highlight1).toHaveAttribute('opacity', '0.4');
        });

        it('should render the second highlight spot ellipse', () => {
            const { container } = renderTree();
            const highlight2 = container.querySelector('ellipse[cx="22"][cy="12"]');
            expect(highlight2).toBeInTheDocument();
            expect(highlight2).toHaveAttribute('fill', '#5AAB6A');
            expect(highlight2).toHaveAttribute('opacity', '0.3');
        });
    });

    describe('element counts', () => {
        it('should render ellipses', () => {
            const { container } = renderTree();
            const ellipses = container.querySelectorAll('ellipse');
            expect(ellipses.length).toBeGreaterThanOrEqual(3);
        });

        it('should render rects', () => {
            const { container } = renderTree();
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBeGreaterThanOrEqual(1);
        });

        it('should render paths', () => {
            const { container } = renderTree();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBeGreaterThanOrEqual(4);
        });
    });
});
