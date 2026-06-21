// @improved-by-ai
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
    describe('root <g> element', () => {
        it('renders the root group element', () => {
            const { container } = renderPillar();
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('applies the given id to the root group', () => {
            const { container } = renderPillar({ id: 'pillar-svg-1' });
            expect(container.querySelector('g')).toHaveAttribute('id', 'pillar-svg-1');
        });

        it('applies the given className to the root group', () => {
            const { container } = renderPillar({ className: 'pillar-custom' });
            expect(container.querySelector('g')).toHaveClass('pillar-custom');
        });

        it('passes through rest props to the root group', () => {
            const { container } = renderPillar({ 'data-test': 'pillar' });
            expect(container.querySelector('g')).toHaveAttribute('data-test', 'pillar');
        });
    });

    describe('component behavior', () => {
        it('has displayName set to PillarSVG', () => {
            expect(PillarSVG.displayName).toBe('PillarSVG');
        });

        it('renders as a forwardRef component', () => {
            const ref = vi.fn();
            renderPillar({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('SVG elements', () => {
        it('renders the main body circle', () => {
            const { container } = renderPillar();
            const bodyCircle = container.querySelector('circle[cx="18"][cy="18"][r="7"]');
            expect(bodyCircle).toBeInTheDocument();
            expect(bodyCircle).toHaveAttribute('fill', '#888888');
        });

        it('renders the subtle darker ring for depth', () => {
            const { container } = renderPillar();
            const ring = container.querySelector('circle[cx="18"][cy="18"][r="6"]');
            expect(ring).toBeInTheDocument();
            expect(ring).toHaveAttribute('fill', 'none');
            expect(ring).toHaveAttribute('stroke', '#666666');
            expect(ring).toHaveAttribute('stroke-width', '0.8');
        });

        it('renders the highlight arc for 3D effect', () => {
            const { container } = renderPillar();
            const highlightPath = container.querySelector('path[d="M 12 12 A 7 7 0 0 1 18 11"]');
            expect(highlightPath).toBeInTheDocument();
            expect(highlightPath).toHaveAttribute('fill', 'none');
            expect(highlightPath).toHaveAttribute('stroke', '#AAAAAA');
            expect(highlightPath).toHaveAttribute('stroke-width', '0.8');
        });

        it('renders 2 circles', () => {
            const { container } = renderPillar();
            const circles = container.querySelectorAll('circle');
            expect(circles.length).toBeGreaterThanOrEqual(2);
        });

        it('renders 1 path', () => {
            const { container } = renderPillar();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBeGreaterThanOrEqual(1);
        });
    });
});
