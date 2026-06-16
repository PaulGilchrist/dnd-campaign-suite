import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PillarSVG from './PillarSVG.jsx';

const renderPillar = (props = {}) =>
    render(
        <svg>
            <PillarSVG {...props} />
        </svg>
    );

describe('PillarSVG', () => {
    it('should render the root <g> element', () => {
        const { container } = renderPillar();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderPillar({ id: 'pillar-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('pillar-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderPillar({ className: 'pillar-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('pillar-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(PillarSVG.displayName).toBe('PillarSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderPillar({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the main body circle', () => {
        const { container } = renderPillar();
        const bodyCircle = container.querySelector(
            'circle[cx="18"][cy="18"][r="7"]'
        );
        expect(bodyCircle).not.toBeNull();
        expect(bodyCircle.getAttribute('fill')).toBe('#888888');
    });

    it('should render the subtle darker ring for depth', () => {
        const { container } = renderPillar();
        const ring = container.querySelector(
            'circle[cx="18"][cy="18"][r="6"]'
        );
        expect(ring).not.toBeNull();
        expect(ring.getAttribute('fill')).toBe('none');
        expect(ring.getAttribute('stroke')).toBe('#666666');
        expect(ring.getAttribute('stroke-width')).toBe('0.8');
    });

    it('should render the highlight arc for 3D effect', () => {
        const { container } = renderPillar();
        const highlightPath = container.querySelector(
            'path[d="M 12 12 A 7 7 0 0 1 18 11"]'
        );
        expect(highlightPath).not.toBeNull();
        expect(highlightPath.getAttribute('fill')).toBe('none');
        expect(highlightPath.getAttribute('stroke')).toBe('#AAAAAA');
        expect(highlightPath.getAttribute('stroke-width')).toBe('0.8');
    });

    it('should render total circle count (2 circles)', () => {
        const { container } = renderPillar();
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(2);
    });

    it('should render total path count (1 path)', () => {
        const { container } = renderPillar();
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(1);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderPillar({ 'data-test': 'pillar' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('pillar');
    });
});
