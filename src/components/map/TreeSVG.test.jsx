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
    it('should render the root <g> element', () => {
        const { container } = renderTree();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderTree({ id: 'tree-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('tree-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderTree({ className: 'tree-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('tree-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(TreeSVG.displayName).toBe('TreeSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderTree({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the shadow ellipse', () => {
        const { container } = renderTree();
        const shadow = container.querySelector(
            'ellipse[cx="18"][cy="33"][rx="12"][ry="3"]'
        );
        expect(shadow).not.toBeNull();
        expect(shadow.getAttribute('fill')).toBe('#000');
        expect(shadow.getAttribute('opacity')).toBe('0.15');
    });

    it('should render the trunk rect', () => {
        const { container } = renderTree();
        const trunk = container.querySelector(
            'rect[x="15"][y="18"][width="6"][height="15"]'
        );
        expect(trunk).not.toBeNull();
        expect(trunk.getAttribute('rx')).toBe('1.5');
        expect(trunk.getAttribute('fill')).toBe('#6B3E1F');
        expect(trunk.getAttribute('stroke')).toBe('#4A2810');
        expect(trunk.getAttribute('stroke-width')).toBe('0.5');
    });

    it('should render the trunk grain path', () => {
        const { container } = renderTree();
        const grainPath = container.querySelector(
            'path[d="M 17 18 Q 16 23 17 33"]'
        );
        expect(grainPath).not.toBeNull();
        expect(grainPath.getAttribute('fill')).toBe('none');
        expect(grainPath.getAttribute('stroke')).toBe('#5C3317');
        expect(grainPath.getAttribute('stroke-width')).toBe('0.6');
        expect(grainPath.getAttribute('opacity')).toBe('0.5');
    });

    it('should render the bottom foliage layer (darkest)', () => {
        const { container } = renderTree();
        const bottomFoliage = container.querySelector(
            'path[d="M 18 4 Q 4 12 6 24 Q 10 20 12 24 Q 14 18 18 20 Q 22 18 24 24 Q 26 20 30 24 Q 32 12 18 4 Z"]'
        );
        expect(bottomFoliage).not.toBeNull();
        expect(bottomFoliage.getAttribute('fill')).toBe('#2D5E37');
        expect(bottomFoliage.getAttribute('stroke')).toBe('#1E4025');
        expect(bottomFoliage.getAttribute('stroke-width')).toBe('0.5');
    });

    it('should render the middle foliage layer', () => {
        const { container } = renderTree();
        const midFoliage = container.querySelector(
            'path[d="M 18 6 Q 6 13 8 22 Q 12 18 14 22 Q 16 17 18 18 Q 20 17 22 22 Q 24 18 28 22 Q 30 13 18 6 Z"]'
        );
        expect(midFoliage).not.toBeNull();
        expect(midFoliage.getAttribute('fill')).toBe('#3D7A4A');
        expect(midFoliage.getAttribute('stroke')).toBe('#2D5E37');
        expect(midFoliage.getAttribute('stroke-width')).toBe('0.4');
    });

    it('should render the top foliage layer (lightest)', () => {
        const { container } = renderTree();
        const topFoliage = container.querySelector(
            'path[d="M 18 8 Q 8 14 10 21 Q 13 17 15 20 Q 17 16 18 17 Q 19 16 21 20 Q 23 17 26 21 Q 28 14 18 8 Z"]'
        );
        expect(topFoliage).not.toBeNull();
        expect(topFoliage.getAttribute('fill')).toBe('#4A9A5A');
        expect(topFoliage.getAttribute('stroke')).toBe('#3D7A4A');
        expect(topFoliage.getAttribute('stroke-width')).toBe('0.3');
    });

    it('should render the first highlight spot ellipse', () => {
        const { container } = renderTree();
        const highlight1 = container.querySelector(
            'ellipse[cx="14"][cy="14"][rx="3"][ry="2"]'
        );
        expect(highlight1).not.toBeNull();
        expect(highlight1.getAttribute('fill')).toBe('#5AAB6A');
        expect(highlight1.getAttribute('opacity')).toBe('0.4');
    });

    it('should render the second highlight spot ellipse', () => {
        const { container } = renderTree();
        const highlight2 = container.querySelector(
            'ellipse[cx="22"][cy="12"][rx="2"][ry="1.5"]'
        );
        expect(highlight2).not.toBeNull();
        expect(highlight2.getAttribute('fill')).toBe('#5AAB6A');
        expect(highlight2.getAttribute('opacity')).toBe('0.3');
    });

    it('should render total ellipse count (3 ellipses)', () => {
        const { container } = renderTree();
        const ellipses = container.querySelectorAll('ellipse');
        expect(ellipses.length).toBe(3);
    });

    it('should render total rect count (1 rect)', () => {
        const { container } = renderTree();
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(1);
    });

    it('should render total path count (4 paths)', () => {
        const { container } = renderTree();
        const paths = container.querySelectorAll('path');
        // trunk grain + 3 foliage layers = 4
        expect(paths.length).toBe(4);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderTree({ 'data-test': 'tree' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('tree');
    });
});
