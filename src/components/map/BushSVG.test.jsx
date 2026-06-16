import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BushSVG from './BushSVG.jsx';

const renderBush = (props = {}) =>
    render(
        <svg>
            <BushSVG {...props} />
        </svg>
    );

describe('BushSVG', () => {
    it('should render the root <g> element', () => {
        const { container } = renderBush();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderBush({ id: 'bush-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('bush-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderBush({ className: 'bush-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('bush-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(BushSVG.displayName).toBe('BushSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderBush({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the shadow ellipse', () => {
        const { container } = renderBush();
        const shadow = container.querySelector(
            'ellipse[cx="18"][cy="33"][rx="11"][ry="2.5"]'
        );
        expect(shadow).not.toBeNull();
        expect(shadow.getAttribute('fill')).toBe('#000');
        expect(shadow.getAttribute('opacity')).toBe('0.12');
    });

    it('should render the bottom layer circles', () => {
        const { container } = renderBush();

        const bottomCenter = container.querySelector(
            'circle[cx="18"][cy="22"][r="12"]'
        );
        expect(bottomCenter).not.toBeNull();
        expect(bottomCenter.getAttribute('fill')).toBe('#3D7A4A');
        expect(bottomCenter.getAttribute('stroke')).toBe('#2D5E37');
        expect(bottomCenter.getAttribute('stroke-width')).toBe('0.5');

        const bottomLeft = container.querySelector(
            'circle[cx="10"][cy="24"][r="8"]'
        );
        expect(bottomLeft).not.toBeNull();
        expect(bottomLeft.getAttribute('fill')).toBe('#3D7A4A');

        const bottomRight = container.querySelector(
            'circle[cx="26"][cy="24"][r="8"]'
        );
        expect(bottomRight).not.toBeNull();
        expect(bottomRight.getAttribute('fill')).toBe('#3D7A4A');
    });

    it('should render the middle layer circles', () => {
        const { container } = renderBush();

        const midCenter = container.querySelector(
            'circle[cx="18"][cy="20"][r="10"]'
        );
        expect(midCenter).not.toBeNull();
        expect(midCenter.getAttribute('fill')).toBe('#4A9A5A');

        const midLeft = container.querySelector(
            'circle[cx="12"][cy="22"][r="7"]'
        );
        expect(midLeft).not.toBeNull();
        expect(midLeft.getAttribute('fill')).toBe('#4A9A5A');

        const midRight = container.querySelector(
            'circle[cx="24"][cy="22"][r="7"]'
        );
        expect(midRight).not.toBeNull();
        expect(midRight.getAttribute('fill')).toBe('#4A9A5A');
    });

    it('should render the top layer circles', () => {
        const { container } = renderBush();

        const topCenter = container.querySelector(
            'circle[cx="18"][cy="18"][r="7"]'
        );
        expect(topCenter).not.toBeNull();
        expect(topCenter.getAttribute('fill')).toBe('#5AAB6A');

        const topLeft = container.querySelector(
            'circle[cx="14"][cy="19"][r="5"]'
        );
        expect(topLeft).not.toBeNull();
        expect(topLeft.getAttribute('fill')).toBe('#5AAB6A');

        const topRight = container.querySelector(
            'circle[cx="22"][cy="19"][r="5"]'
        );
        expect(topRight).not.toBeNull();
        expect(topRight.getAttribute('fill')).toBe('#5AAB6A');
    });

    it('should render the top highlight circles', () => {
        const { container } = renderBush();

        const highlight1 = container.querySelector(
            'circle[cx="16"][cy="16"][r="3"]'
        );
        expect(highlight1).not.toBeNull();
        expect(highlight1.getAttribute('fill')).toBe('#6ABC7A');
        expect(highlight1.getAttribute('opacity')).toBe('0.5');

        const highlight2 = container.querySelector(
            'circle[cx="20"][cy="17"][r="2"]'
        );
        expect(highlight2).not.toBeNull();
        expect(highlight2.getAttribute('fill')).toBe('#6ABC7A');
        expect(highlight2.getAttribute('opacity')).toBe('0.4');
    });

    it('should render the small branch detail paths', () => {
        const { container } = renderBush();

        const branchLeft = container.querySelector(
            'path[d="M 10 20 Q 8 16 9 14"]'
        );
        expect(branchLeft).not.toBeNull();
        expect(branchLeft.getAttribute('fill')).toBe('none');
        expect(branchLeft.getAttribute('stroke')).toBe('#4A9A5A');
        expect(branchLeft.getAttribute('stroke-width')).toBe('0.8');

        const branchRight = container.querySelector(
            'path[d="M 26 20 Q 28 16 27 14"]'
        );
        expect(branchRight).not.toBeNull();
        expect(branchRight.getAttribute('fill')).toBe('none');
        expect(branchRight.getAttribute('stroke')).toBe('#4A9A5A');
        expect(branchRight.getAttribute('stroke-width')).toBe('0.8');
    });

    it('should render total circle count (11 circles)', () => {
        const { container } = renderBush();
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(11);
    });

    it('should render total ellipse count (1 ellipse)', () => {
        const { container } = renderBush();
        const ellipses = container.querySelectorAll('ellipse');
        expect(ellipses.length).toBe(1);
    });

    it('should render total path count (2 paths)', () => {
        const { container } = renderBush();
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(2);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderBush({ 'data-test': 'bush' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('bush');
    });
});
