// @improved-by-ai
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
    describe('component identity and forwardRef', () => {
        it('should have the correct displayName', () => {
            expect(BoulderSVG.displayName).toBe('BoulderSVG');
        });

        it('should support forwardRef', () => {
            const ref = vi.fn();
            renderBoulder({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('root group element', () => {
        it('should render the root <g> element', () => {
            const { container } = renderBoulder();
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('should apply the given id to the root group', () => {
            const { container } = renderBoulder({ id: 'boulder-svg-1' });
            expect(container.querySelector('g')).toHaveAttribute('id', 'boulder-svg-1');
        });

        it('should apply the given className to the root group', () => {
            const { container } = renderBoulder({ className: 'boulder-custom' });
            expect(container.querySelector('g')).toHaveClass('boulder-custom');
        });

        it('should pass through rest props to the root group', () => {
            const { container } = renderBoulder({ 'data-test': 'boulder' });
            expect(container.querySelector('g')).toHaveAttribute('data-test', 'boulder');
        });
    });

    describe('SVG elements', () => {
        it('should render the shadow ellipse', () => {
            const { container } = renderBoulder();
            const shadow = container.querySelector(
                'ellipse[cx="18"][cy="34"][rx="14"][ry="3"]'
            );
            expect(shadow).toBeInTheDocument();
            expect(shadow).toHaveAttribute('fill', '#000');
            expect(shadow).toHaveAttribute('opacity', '0.12');
        });

        it('should render the main body path', () => {
            const { container } = renderBoulder();
            const bodyPath = container.querySelector(
                'path[d="M 8 32 Q 4 20 10 10 Q 12 4 18 6 Q 24 4 26 10 Q 32 20 28 32 Z"]'
            );
            expect(bodyPath).toBeInTheDocument();
            expect(bodyPath).toHaveAttribute('fill', '#7A7A6A');
            expect(bodyPath).toHaveAttribute('stroke', '#5A5A4E');
            expect(bodyPath).toHaveAttribute('stroke-width', '0.8');
        });

        it('should render the highlight face path', () => {
            const { container } = renderBoulder();
            const highlightPath = container.querySelector(
                'path[d="M 10 28 Q 8 20 12 14 Q 14 8 18 8 Q 20 8 22 10 Q 18 14 16 18 Q 14 24 12 28 Z"]'
            );
            expect(highlightPath).toBeInTheDocument();
            expect(highlightPath).toHaveAttribute('fill', '#8B8B7A');
            expect(highlightPath).toHaveAttribute('opacity', '0.6');
        });

        it('should render the shadow face path', () => {
            const { container } = renderBoulder();
            const shadowPath = container.querySelector(
                'path[d="M 26 28 Q 28 20 24 14 Q 22 10 20 10 Q 22 14 22 18 Q 22 24 24 28 Z"]'
            );
            expect(shadowPath).toBeInTheDocument();
            expect(shadowPath).toHaveAttribute('fill', '#5A5A4E');
            expect(shadowPath).toHaveAttribute('opacity', '0.4');
        });

        it('should render the first crack line', () => {
            const { container } = renderBoulder();
            const crackPath = container.querySelector(
                'path[d="M 16 12 Q 14 16 16 20 Q 17 22 16 26"]'
            );
            expect(crackPath).toBeInTheDocument();
            expect(crackPath).toHaveAttribute('fill', 'none');
            expect(crackPath).toHaveAttribute('stroke', '#5A5A4E');
            expect(crackPath).toHaveAttribute('stroke-width', '0.5');
            expect(crackPath).toHaveAttribute('opacity', '0.6');
        });

        it('should render the second crack line', () => {
            const { container } = renderBoulder();
            const crackPath = container.querySelector(
                'path[d="M 20 14 Q 22 18 20 22"]'
            );
            expect(crackPath).toBeInTheDocument();
            expect(crackPath).toHaveAttribute('fill', 'none');
            expect(crackPath).toHaveAttribute('stroke', '#5A5A4E');
            expect(crackPath).toHaveAttribute('stroke-width', '0.4');
            expect(crackPath).toHaveAttribute('opacity', '0.5');
        });

        it('should render the top highlight ellipse', () => {
            const { container } = renderBoulder();
            const topHighlight = container.querySelector(
                'ellipse[cx="16"][cy="12"][rx="4"][ry="2"]'
            );
            expect(topHighlight).toBeInTheDocument();
            expect(topHighlight).toHaveAttribute('fill', '#9A9A8A');
            expect(topHighlight).toHaveAttribute('opacity', '0.3');
        });
    });

    describe('element counts', () => {
        it('should render at least 2 ellipses', () => {
            const { container } = renderBoulder();
            const ellipses = container.querySelectorAll('ellipse');
            expect(ellipses.length).toBeGreaterThanOrEqual(2);
        });

        it('should render at least 5 paths', () => {
            const { container } = renderBoulder();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBeGreaterThanOrEqual(5);
        });
    });
});
