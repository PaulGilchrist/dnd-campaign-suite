// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FountainSVG from './FountainSVG.jsx';

const renderFountain = (props = {}) =>
    render(
        <svg>
            <FountainSVG {...props} />
        </svg>
    );

describe('FountainSVG', () => {
    describe('root element', () => {
        it('should render the root <g> element', () => {
            const { container } = renderFountain();
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toBeInTheDocument();
        });

        it('should apply the given id to the root group', () => {
            const { container } = renderFountain({ id: 'fountain-svg-1' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('id', 'fountain-svg-1');
        });

        it('should apply the given className to the root group', () => {
            const { container } = renderFountain({ className: 'fountain-custom' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveClass('fountain-custom');
        });

        it('should pass through rest props to the root group', () => {
            const { container } = renderFountain({ 'data-test': 'fountain' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('data-test', 'fountain');
        });

        it('should render with displayName', () => {
            expect(FountainSVG.displayName).toBe('FountainSVG');
        });

        it('should render as a forwardRef component', () => {
            const ref = vi.fn();
            renderFountain({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('floor shadow', () => {
        it('should render the floor shadow circle', () => {
            const { container } = renderFountain();
            const shadow = container.querySelector(
                'circle[cx="18"][cy="19"][r="16"]'
            );
            expect(shadow).toBeInTheDocument();
            expect(shadow).toHaveAttribute('fill', '#555');
            expect(shadow).toHaveAttribute('opacity', '0.12');
        });
    });

    describe('basin', () => {
        it('should render the outer basin wall path', () => {
            const { container } = renderFountain();
            const basinPath = container.querySelector(
                'path[fill="#888"][stroke="#666"]'
            );
            expect(basinPath).toBeInTheDocument();
            expect(basinPath).toHaveAttribute('stroke-width', '0.6');
            expect(basinPath).toHaveAttribute('fill-rule', 'evenodd');
        });

        it('should render the basin rim highlight circle', () => {
            const { container } = renderFountain();
            const rimHighlight = container.querySelector(
                'circle[cx="18"][cy="18"][r="14.5"][fill="none"]'
            );
            expect(rimHighlight).toBeInTheDocument();
            expect(rimHighlight).toHaveAttribute('stroke', '#999');
            expect(rimHighlight).toHaveAttribute('stroke-width', '0.4');
            expect(rimHighlight).toHaveAttribute('opacity', '0.6');
        });

        it('should render the basin wall shadow path', () => {
            const { container } = renderFountain();
            const wallShadow = container.querySelector(
                'path[d="M 6 24 A 12 12 0 0 0 30 24"]'
            );
            expect(wallShadow).toBeInTheDocument();
            expect(wallShadow).toHaveAttribute('fill', 'none');
            expect(wallShadow).toHaveAttribute('stroke', '#555');
            expect(wallShadow).toHaveAttribute('stroke-width', '1.5');
            expect(wallShadow).toHaveAttribute('opacity', '0.3');
            expect(wallShadow).toHaveAttribute('stroke-linecap', 'round');
        });
    });

    describe('water features', () => {
        it('should render the water surface circle', () => {
            const { container } = renderFountain();
            const waterSurface = container.querySelector(
                'circle[cx="18"][cy="18"][r="11.5"]'
            );
            expect(waterSurface).toBeInTheDocument();
            expect(waterSurface).toHaveAttribute('fill', '#3498DB');
            expect(waterSurface).toHaveAttribute('opacity', '0.45');
        });

        it('should render the water highlight path', () => {
            const { container } = renderFountain();
            const waterHighlight = container.querySelector(
                'path[d="M 8 15 A 10 10 0 0 1 28 15"]'
            );
            expect(waterHighlight).toBeInTheDocument();
            expect(waterHighlight).toHaveAttribute('stroke', '#5DADE2');
            expect(waterHighlight).toHaveAttribute('stroke-width', '1.8');
            expect(waterHighlight).toHaveAttribute('opacity', '0.35');
            expect(waterHighlight).toHaveAttribute('stroke-linecap', 'round');
        });

        it('should render the water ripple circles', () => {
            const { container } = renderFountain();
            const ripples = container.querySelectorAll(
                'circle[fill="none"][stroke="#5DADE2"]'
            );
            expect(ripples.length).toBeGreaterThanOrEqual(3);

            const ripple5 = container.querySelector(
                'circle[cx="18"][cy="18"][r="5"]'
            );
            expect(ripple5).toHaveAttribute('stroke-width', '0.4');
            expect(ripple5).toHaveAttribute('opacity', '0.3');

            const ripple75 = container.querySelector(
                'circle[cx="18"][cy="18"][r="7.5"]'
            );
            expect(ripple75).toHaveAttribute('opacity', '0.25');

            const ripple10 = container.querySelector(
                'circle[cx="18"][cy="18"][r="10"]'
            );
            expect(ripple10).toHaveAttribute('stroke-width', '0.3');
            expect(ripple10).toHaveAttribute('opacity', '0.2');
        });

        it('should render the flowing water arc paths', () => {
            const { container } = renderFountain();
            const arcs = container.querySelectorAll(
                'path[stroke="#5DADE2"][stroke-width="0.8"]'
            );
            expect(arcs.length).toBeGreaterThanOrEqual(4);

            const arc1 = container.querySelector(
                'path[d="M 15 15 Q 12 13 11 16"]'
            );
            expect(arc1).toBeInTheDocument();
            expect(arc1).toHaveAttribute('opacity', '0.5');
            expect(arc1).toHaveAttribute('stroke-linecap', 'round');

            const arc2 = container.querySelector(
                'path[d="M 21 15 Q 24 13 25 16"]'
            );
            expect(arc2).toBeInTheDocument();

            const arc3 = container.querySelector(
                'path[d="M 15 21 Q 12 23 11 20"]'
            );
            expect(arc3).toBeInTheDocument();

            const arc4 = container.querySelector(
                'path[d="M 21 21 Q 24 23 25 20"]'
            );
            expect(arc4).toBeInTheDocument();
        });

        it('should render the water droplet circles', () => {
            const { container } = renderFountain();
            const droplets = container.querySelectorAll(
                'circle[fill="#5DADE2"][r="0.7"]'
            );
            expect(droplets.length).toBeGreaterThanOrEqual(4);

            const droplet1 = container.querySelector('circle[cx="10"][cy="13"]');
            expect(droplet1).toBeInTheDocument();
            expect(droplet1).toHaveAttribute('opacity', '0.6');

            const droplet2 = container.querySelector('circle[cx="26"][cy="13"]');
            expect(droplet2).toBeInTheDocument();

            const droplet3 = container.querySelector('circle[cx="10"][cy="23"]');
            expect(droplet3).toBeInTheDocument();

            const droplet4 = container.querySelector('circle[cx="26"][cy="23"]');
            expect(droplet4).toBeInTheDocument();
        });
    });

    describe('central pillar', () => {
        it('should render the central pillar circles', () => {
            const { container } = renderFountain();
            const pillarCircle = container.querySelector(
                'circle[cx="18"][cy="18"][r="3.5"]'
            );
            expect(pillarCircle).toBeInTheDocument();
            expect(pillarCircle).toHaveAttribute('fill', '#888');
            expect(pillarCircle).toHaveAttribute('stroke', '#666');
            expect(pillarCircle).toHaveAttribute('stroke-width', '0.6');

            const topCircle = container.querySelector(
                'circle[cx="18"][cy="18"][r="2.5"]'
            );
            expect(topCircle).toBeInTheDocument();
            expect(topCircle).toHaveAttribute('fill', '#999');
            expect(topCircle).toHaveAttribute('stroke', '#777');
            expect(topCircle).toHaveAttribute('stroke-width', '0.3');
        });

        it('should render the pillar center highlight', () => {
            const { container } = renderFountain();
            const highlight = container.querySelector(
                'circle[cx="17.5"][cy="17.5"][r="0.8"]'
            );
            expect(highlight).toBeInTheDocument();
            expect(highlight).toHaveAttribute('fill', '#AAA');
            expect(highlight).toHaveAttribute('opacity', '0.4');
        });
    });

    describe('element counts', () => {
        it('should render circle elements', () => {
            const { container } = renderFountain();
            const circles = container.querySelectorAll('circle');
            expect(circles.length).toBeGreaterThan(0);
        });

        it('should render path elements', () => {
            const { container } = renderFountain();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBeGreaterThan(0);
        });
    });
});
