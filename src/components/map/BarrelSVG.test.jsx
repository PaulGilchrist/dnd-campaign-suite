// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BarrelSVG from './BarrelSVG.jsx';

const renderBarrel = (props = {}) =>
    render(
        <svg>
            <BarrelSVG {...props} />
        </svg>
    );

describe('BarrelSVG', () => {
    describe('root element', () => {
        it('should render the root <g> element', () => {
            const { container } = renderBarrel();
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('should apply the given id to the root group', () => {
            const { container } = renderBarrel({ id: 'barrel-svg-1' });
            expect(container.querySelector('g')).toHaveAttribute('id', 'barrel-svg-1');
        });

        it('should apply the given className to the root group', () => {
            const { container } = renderBarrel({ className: 'barrel-custom' });
            expect(container.querySelector('g')).toHaveClass('barrel-custom');
        });

        it('should pass through rest props to the root group', () => {
            const { container } = renderBarrel({ 'data-test': 'barrel' });
            expect(container.querySelector('g')).toHaveAttribute('data-test', 'barrel');
        });
    });

    describe('component metadata', () => {
        it('should render with displayName', () => {
            expect(BarrelSVG.displayName).toBe('BarrelSVG');
        });

        it('should render as a forwardRef component', () => {
            const ref = vi.fn();
            renderBarrel({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('barrel body', () => {
        it('should render the barrel body path with correct attributes', () => {
            const { container } = renderBarrel();
            const bodyPath = container.querySelector(
                'path[d="M 10 4 Q 6 18 10 32 L 26 32 Q 30 18 26 4 Z"]'
            );
            expect(bodyPath).toBeInTheDocument();
            expect(bodyPath).toHaveAttribute('fill', '#A0652D');
            expect(bodyPath).toHaveAttribute('stroke', '#6B3E1F');
            expect(bodyPath).toHaveAttribute('stroke-width', '0.8');
        });

        it('should render the left side shading path', () => {
            const { container } = renderBarrel();
            const shadingPath = container.querySelector(
                'path[d="M 10 4 Q 6 18 10 32 L 16 32 Q 12 18 16 4 Z"]'
            );
            expect(shadingPath).toBeInTheDocument();
            expect(shadingPath).toHaveAttribute('fill', '#8B5524');
            expect(shadingPath).toHaveAttribute('opacity', '0.5');
        });

        it('should render the right side highlight path', () => {
            const { container } = renderBarrel();
            const highlightPath = container.querySelector(
                'path[d="M 26 4 Q 30 18 26 32 L 22 32 Q 26 18 22 4 Z"]'
            );
            expect(highlightPath).toBeInTheDocument();
            expect(highlightPath).toHaveAttribute('fill', '#B87A3A');
            expect(highlightPath).toHaveAttribute('opacity', '0.4');
        });
    });

    describe('rims and openings', () => {
        it('should render the top rim ellipse', () => {
            const { container } = renderBarrel();
            const topRim = container.querySelector(
                'ellipse[cx="18"][cy="4"][rx="8"][ry="2.5"]'
            );
            expect(topRim).toBeInTheDocument();
            expect(topRim).toHaveAttribute('fill', '#8B5524');
            expect(topRim).toHaveAttribute('stroke', '#6B3E1F');
            expect(topRim).toHaveAttribute('stroke-width', '0.6');
        });

        it('should render the bottom rim ellipse', () => {
            const { container } = renderBarrel();
            const bottomRim = container.querySelector(
                'ellipse[cx="18"][cy="32"][rx="8"][ry="2.5"]'
            );
            expect(bottomRim).toBeInTheDocument();
            expect(bottomRim).toHaveAttribute('fill', '#8B5524');
            expect(bottomRim).toHaveAttribute('stroke', '#6B3E1F');
        });

        it('should render the top opening ellipse', () => {
            const { container } = renderBarrel();
            const opening = container.querySelector(
                'ellipse[cx="18"][cy="4"][rx="6"][ry="1.8"]'
            );
            expect(opening).toBeInTheDocument();
            expect(opening).toHaveAttribute('fill', '#5C3317');
            expect(opening).toHaveAttribute('stroke', '#4A2810');
        });
    });

    describe('metal bands', () => {
        it('should render the top metal band rects', () => {
            const { container } = renderBarrel();
            const topBandDark = container.querySelector(
                'rect[x="9.5"][y="10"][width="17"][height="2"]'
            );
            expect(topBandDark).toBeInTheDocument();
            expect(topBandDark).toHaveAttribute('fill', '#555');
            expect(topBandDark).toHaveAttribute('rx', '0.5');

            const topBandLight = container.querySelector(
                'rect[x="9.5"][y="10"][width="17"][height="0.5"]'
            );
            expect(topBandLight).toBeInTheDocument();
            expect(topBandLight).toHaveAttribute('fill', '#777');
        });

        it('should render the middle metal band rects', () => {
            const { container } = renderBarrel();
            const midBandDark = container.querySelector(
                'rect[x="9"][y="18"][width="18"][height="2"]'
            );
            expect(midBandDark).toBeInTheDocument();
            expect(midBandDark).toHaveAttribute('fill', '#555');
            expect(midBandDark).toHaveAttribute('rx', '0.5');

            const midBandLight = container.querySelector(
                'rect[x="9"][y="18"][width="18"][height="0.5"]'
            );
            expect(midBandLight).toBeInTheDocument();
            expect(midBandLight).toHaveAttribute('fill', '#777');
        });

        it('should render the bottom metal band rects', () => {
            const { container } = renderBarrel();
            const bottomBandDark = container.querySelector(
                'rect[x="9.5"][y="26"][width="17"][height="2"]'
            );
            expect(bottomBandDark).toBeInTheDocument();
            expect(bottomBandDark).toHaveAttribute('fill', '#555');
            expect(bottomBandDark).toHaveAttribute('rx', '0.5');

            const bottomBandLight = container.querySelector(
                'rect[x="9.5"][y="26"][width="17"][height="0.5"]'
            );
            expect(bottomBandLight).toBeInTheDocument();
            expect(bottomBandLight).toHaveAttribute('fill', '#777');
        });
    });

    describe('wood grain lines', () => {
        it('should render wood grain lines with correct styling', () => {
            const { container } = renderBarrel();
            const grainPaths = container.querySelectorAll(
                'path[stroke="#7A4E20"][stroke-width="0.4"][opacity="0.6"]'
            );
            expect(grainPaths.length).toBeGreaterThan(0);
        });

        it('should render the left wood grain line', () => {
            const { container } = renderBarrel();
            const grainPath = container.querySelector(
                'path[d="M 14 8 Q 13 18 14 28"]'
            );
            expect(grainPath).toBeInTheDocument();
            expect(grainPath).toHaveAttribute('fill', 'none');
        });

        it('should render the center wood grain line', () => {
            const { container } = renderBarrel();
            const grainPath = container.querySelector(
                'path[d="M 18 7 Q 17 18 18 29"]'
            );
            expect(grainPath).toBeInTheDocument();
            expect(grainPath).toHaveAttribute('fill', 'none');
        });

        it('should render the right wood grain line', () => {
            const { container } = renderBarrel();
            const grainPath = container.querySelector(
                'path[d="M 22 8 Q 23 18 22 28"]'
            );
            expect(grainPath).toBeInTheDocument();
            expect(grainPath).toHaveAttribute('fill', 'none');
        });
    });

    describe('element counts', () => {
        it('should render at least 6 metal band rects', () => {
            const { container } = renderBarrel();
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBeGreaterThanOrEqual(6);
        });

        it('should render at least 3 ellipses', () => {
            const { container } = renderBarrel();
            const ellipses = container.querySelectorAll('ellipse');
            expect(ellipses.length).toBeGreaterThanOrEqual(3);
        });

        it('should render at least 6 paths', () => {
            const { container } = renderBarrel();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBeGreaterThanOrEqual(6);
        });
    });
});
