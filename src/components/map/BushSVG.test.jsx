// @improved-by-ai
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
    describe('root element', () => {
        it('should render the root <g> element', () => {
            const { container } = renderBush();
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toBeInTheDocument();
        });

        it('should apply the given id to the root group', () => {
            const { container } = renderBush({ id: 'bush-svg-1' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('id', 'bush-svg-1');
        });

        it('should apply the given className to the root group', () => {
            const { container } = renderBush({ className: 'bush-custom' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveClass('bush-custom');
        });

        it('should pass through rest props to the root group', () => {
            const { container } = renderBush({ 'data-test': 'bush' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('data-test', 'bush');
        });
    });

    describe('component configuration', () => {
        it('should render with displayName', () => {
            expect(BushSVG.displayName).toBe('BushSVG');
        });

        it('should render as a forwardRef component', () => {
            const ref = vi.fn();
            renderBush({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('shadow', () => {
        it('should render the shadow ellipse with correct attributes', () => {
            const { container } = renderBush();
            const shadow = container.querySelector(
                'ellipse[cx="18"][cy="33"][rx="11"][ry="2.5"]'
            );
            expect(shadow).toBeInTheDocument();
            expect(shadow).toHaveAttribute('fill', '#000');
            expect(shadow).toHaveAttribute('opacity', '0.12');
        });
    });

    describe('bottom layer circles', () => {
        it('should render the bottom center circle', () => {
            const { container } = renderBush();
            const bottomCenter = container.querySelector(
                'circle[cx="18"][cy="22"][r="12"]'
            );
            expect(bottomCenter).toBeInTheDocument();
            expect(bottomCenter).toHaveAttribute('fill', '#3D7A4A');
            expect(bottomCenter).toHaveAttribute('stroke', '#2D5E37');
            expect(bottomCenter).toHaveAttribute('stroke-width', '0.5');
        });

        it('should render the bottom left circle', () => {
            const { container } = renderBush();
            const bottomLeft = container.querySelector(
                'circle[cx="10"][cy="24"][r="8"]'
            );
            expect(bottomLeft).toBeInTheDocument();
            expect(bottomLeft).toHaveAttribute('fill', '#3D7A4A');
        });

        it('should render the bottom right circle', () => {
            const { container } = renderBush();
            const bottomRight = container.querySelector(
                'circle[cx="26"][cy="24"][r="8"]'
            );
            expect(bottomRight).toBeInTheDocument();
            expect(bottomRight).toHaveAttribute('fill', '#3D7A4A');
        });
    });

    describe('middle layer circles', () => {
        it('should render the middle center circle', () => {
            const { container } = renderBush();
            const midCenter = container.querySelector(
                'circle[cx="18"][cy="20"][r="10"]'
            );
            expect(midCenter).toBeInTheDocument();
            expect(midCenter).toHaveAttribute('fill', '#4A9A5A');
        });

        it('should render the middle left circle', () => {
            const { container } = renderBush();
            const midLeft = container.querySelector(
                'circle[cx="12"][cy="22"][r="7"]'
            );
            expect(midLeft).toBeInTheDocument();
            expect(midLeft).toHaveAttribute('fill', '#4A9A5A');
        });

        it('should render the middle right circle', () => {
            const { container } = renderBush();
            const midRight = container.querySelector(
                'circle[cx="24"][cy="22"][r="7"]'
            );
            expect(midRight).toBeInTheDocument();
            expect(midRight).toHaveAttribute('fill', '#4A9A5A');
        });
    });

    describe('top layer circles', () => {
        it('should render the top center circle', () => {
            const { container } = renderBush();
            const topCenter = container.querySelector(
                'circle[cx="18"][cy="18"][r="7"]'
            );
            expect(topCenter).toBeInTheDocument();
            expect(topCenter).toHaveAttribute('fill', '#5AAB6A');
        });

        it('should render the top left circle', () => {
            const { container } = renderBush();
            const topLeft = container.querySelector(
                'circle[cx="14"][cy="19"][r="5"]'
            );
            expect(topLeft).toBeInTheDocument();
            expect(topLeft).toHaveAttribute('fill', '#5AAB6A');
        });

        it('should render the top right circle', () => {
            const { container } = renderBush();
            const topRight = container.querySelector(
                'circle[cx="22"][cy="19"][r="5"]'
            );
            expect(topRight).toBeInTheDocument();
            expect(topRight).toHaveAttribute('fill', '#5AAB6A');
        });
    });

    describe('top highlights', () => {
        it('should render the top highlight circles', () => {
            const { container } = renderBush();
            const highlight1 = container.querySelector(
                'circle[cx="16"][cy="16"][r="3"]'
            );
            expect(highlight1).toBeInTheDocument();
            expect(highlight1).toHaveAttribute('fill', '#6ABC7A');
            expect(highlight1).toHaveAttribute('opacity', '0.5');

            const highlight2 = container.querySelector(
                'circle[cx="20"][cy="17"][r="2"]'
            );
            expect(highlight2).toBeInTheDocument();
            expect(highlight2).toHaveAttribute('fill', '#6ABC7A');
            expect(highlight2).toHaveAttribute('opacity', '0.4');
        });
    });

    describe('branch details', () => {
        it('should render the small branch detail paths', () => {
            const { container } = renderBush();
            const branchLeft = container.querySelector(
                'path[d="M 10 20 Q 8 16 9 14"]'
            );
            expect(branchLeft).toBeInTheDocument();
            expect(branchLeft).toHaveAttribute('fill', 'none');
            expect(branchLeft).toHaveAttribute('stroke', '#4A9A5A');
            expect(branchLeft).toHaveAttribute('stroke-width', '0.8');

            const branchRight = container.querySelector(
                'path[d="M 26 20 Q 28 16 27 14"]'
            );
            expect(branchRight).toBeInTheDocument();
            expect(branchRight).toHaveAttribute('fill', 'none');
            expect(branchRight).toHaveAttribute('stroke', '#4A9A5A');
            expect(branchRight).toHaveAttribute('stroke-width', '0.8');
        });
    });

    describe('element counts', () => {
        it('should render 11 circles', () => {
            const { container } = renderBush();
            const circles = container.querySelectorAll('circle');
            expect(circles.length).toBeGreaterThanOrEqual(11);
        });

        it('should render at least 1 ellipse', () => {
            const { container } = renderBush();
            const ellipses = container.querySelectorAll('ellipse');
            expect(ellipses.length).toBeGreaterThan(0);
        });

        it('should render at least 2 paths', () => {
            const { container } = renderBush();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBeGreaterThanOrEqual(2);
        });
    });
});