import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BoulderSVG from './BoulderSVG.jsx';

const renderBoulder = (props = {}) =>
    render(
        <svg>
            <BoulderSVG {...props} />
        </svg>
    );

describe('BoulderSVG', () => {
    it('should render the root <g> element', () => {
        const { container } = renderBoulder();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderBoulder({ id: 'boulder-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('boulder-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderBoulder({ className: 'boulder-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('boulder-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(BoulderSVG.displayName).toBe('BoulderSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderBoulder({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the shadow ellipse', () => {
        const { container } = renderBoulder();
        const shadow = container.querySelector(
            'ellipse[cx="18"][cy="34"][rx="14"][ry="3"]'
        );
        expect(shadow).not.toBeNull();
        expect(shadow.getAttribute('fill')).toBe('#000');
        expect(shadow.getAttribute('opacity')).toBe('0.12');
    });

    it('should render the main body path', () => {
        const { container } = renderBoulder();
        const bodyPath = container.querySelector(
            'path[d="M 8 32 Q 4 20 10 10 Q 12 4 18 6 Q 24 4 26 10 Q 32 20 28 32 Z"]'
        );
        expect(bodyPath).not.toBeNull();
        expect(bodyPath.getAttribute('fill')).toBe('#7A7A6A');
        expect(bodyPath.getAttribute('stroke')).toBe('#5A5A4E');
        expect(bodyPath.getAttribute('stroke-width')).toBe('0.8');
    });

    it('should render the highlight face path', () => {
        const { container } = renderBoulder();
        const highlightPath = container.querySelector(
            'path[d="M 10 28 Q 8 20 12 14 Q 14 8 18 8 Q 20 8 22 10 Q 18 14 16 18 Q 14 24 12 28 Z"]'
        );
        expect(highlightPath).not.toBeNull();
        expect(highlightPath.getAttribute('fill')).toBe('#8B8B7A');
        expect(highlightPath.getAttribute('opacity')).toBe('0.6');
    });

    it('should render the shadow face path', () => {
        const { container } = renderBoulder();
        const shadowPath = container.querySelector(
            'path[d="M 26 28 Q 28 20 24 14 Q 22 10 20 10 Q 22 14 22 18 Q 22 24 24 28 Z"]'
        );
        expect(shadowPath).not.toBeNull();
        expect(shadowPath.getAttribute('fill')).toBe('#5A5A4E');
        expect(shadowPath.getAttribute('opacity')).toBe('0.4');
    });

    it('should render the first crack line', () => {
        const { container } = renderBoulder();
        const crackPath = container.querySelector(
            'path[d="M 16 12 Q 14 16 16 20 Q 17 22 16 26"]'
        );
        expect(crackPath).not.toBeNull();
        expect(crackPath.getAttribute('fill')).toBe('none');
        expect(crackPath.getAttribute('stroke')).toBe('#5A5A4E');
        expect(crackPath.getAttribute('stroke-width')).toBe('0.5');
        expect(crackPath.getAttribute('opacity')).toBe('0.6');
    });

    it('should render the second crack line', () => {
        const { container } = renderBoulder();
        const crackPath = container.querySelector(
            'path[d="M 20 14 Q 22 18 20 22"]'
        );
        expect(crackPath).not.toBeNull();
        expect(crackPath.getAttribute('fill')).toBe('none');
        expect(crackPath.getAttribute('stroke')).toBe('#5A5A4E');
        expect(crackPath.getAttribute('stroke-width')).toBe('0.4');
        expect(crackPath.getAttribute('opacity')).toBe('0.5');
    });

    it('should render the top highlight ellipse', () => {
        const { container } = renderBoulder();
        const topHighlight = container.querySelector(
            'ellipse[cx="16"][cy="12"][rx="4"][ry="2"]'
        );
        expect(topHighlight).not.toBeNull();
        expect(topHighlight.getAttribute('fill')).toBe('#9A9A8A');
        expect(topHighlight.getAttribute('opacity')).toBe('0.3');
    });

    it('should render total ellipse count (2 ellipses)', () => {
        const { container } = renderBoulder();
        const ellipses = container.querySelectorAll('ellipse');
        expect(ellipses.length).toBe(2);
    });

    it('should render total path count (5 paths)', () => {
        const { container } = renderBoulder();
        const paths = container.querySelectorAll('path');
        // main body, highlight face, shadow face, 2 crack lines = 5
        expect(paths.length).toBe(5);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderBoulder({ 'data-test': 'boulder' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('boulder');
    });
});
