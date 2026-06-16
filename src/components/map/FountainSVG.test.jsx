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
    it('should render the root <g> element', () => {
        const { container } = renderFountain();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderFountain({ id: 'fountain-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('fountain-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderFountain({ className: 'fountain-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('fountain-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(FountainSVG.displayName).toBe('FountainSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderFountain({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the floor shadow circle', () => {
        const { container } = renderFountain();
        const shadow = container.querySelector(
            'circle[cx="18"][cy="19"][r="16"]'
        );
        expect(shadow).not.toBeNull();
        expect(shadow.getAttribute('fill')).toBe('#555');
        expect(shadow.getAttribute('opacity')).toBe('0.12');
    });

    it('should render the outer basin wall path', () => {
        const { container } = renderFountain();
        const basinPath = container.querySelector(
            'path[fill="#888"][stroke="#666"]'
        );
        expect(basinPath).not.toBeNull();
        expect(basinPath.getAttribute('stroke-width')).toBe('0.6');
        expect(basinPath.getAttribute('fill-rule')).toBe('evenodd');
    });

    it('should render the basin rim highlight circle', () => {
        const { container } = renderFountain();
        const rimHighlight = container.querySelector(
            'circle[cx="18"][cy="18"][r="14.5"][fill="none"]'
        );
        expect(rimHighlight).not.toBeNull();
        expect(rimHighlight.getAttribute('stroke')).toBe('#999');
        expect(rimHighlight.getAttribute('stroke-width')).toBe('0.4');
        expect(rimHighlight.getAttribute('opacity')).toBe('0.6');
    });

    it('should render the basin wall shadow path', () => {
        const { container } = renderFountain();
        const wallShadow = container.querySelector(
            'path[d="M 6 24 A 12 12 0 0 0 30 24"]'
        );
        expect(wallShadow).not.toBeNull();
        expect(wallShadow.getAttribute('fill')).toBe('none');
        expect(wallShadow.getAttribute('stroke')).toBe('#555');
        expect(wallShadow.getAttribute('stroke-width')).toBe('1.5');
        expect(wallShadow.getAttribute('opacity')).toBe('0.3');
        expect(wallShadow.getAttribute('stroke-linecap')).toBe('round');
    });

    it('should render the water surface circle', () => {
        const { container } = renderFountain();
        const waterSurface = container.querySelector(
            'circle[cx="18"][cy="18"][r="11.5"]'
        );
        expect(waterSurface).not.toBeNull();
        expect(waterSurface.getAttribute('fill')).toBe('#3498DB');
        expect(waterSurface.getAttribute('opacity')).toBe('0.45');
    });

    it('should render the water highlight path', () => {
        const { container } = renderFountain();
        const waterHighlight = container.querySelector(
            'path[d="M 8 15 A 10 10 0 0 1 28 15"]'
        );
        expect(waterHighlight).not.toBeNull();
        expect(waterHighlight.getAttribute('stroke')).toBe('#5DADE2');
        expect(waterHighlight.getAttribute('stroke-width')).toBe('1.8');
        expect(waterHighlight.getAttribute('opacity')).toBe('0.35');
        expect(waterHighlight.getAttribute('stroke-linecap')).toBe('round');
    });

    it('should render the central pillar circles', () => {
        const { container } = renderFountain();
        const pillarCircle = container.querySelector(
            'circle[cx="18"][cy="18"][r="3.5"]'
        );
        expect(pillarCircle).not.toBeNull();
        expect(pillarCircle.getAttribute('fill')).toBe('#888');
        expect(pillarCircle.getAttribute('stroke')).toBe('#666');
        expect(pillarCircle.getAttribute('stroke-width')).toBe('0.6');

        const topCircle = container.querySelector(
            'circle[cx="18"][cy="18"][r="2.5"]'
        );
        expect(topCircle).not.toBeNull();
        expect(topCircle.getAttribute('fill')).toBe('#999');
        expect(topCircle.getAttribute('stroke')).toBe('#777');
        expect(topCircle.getAttribute('stroke-width')).toBe('0.3');
    });

    it('should render the pillar center highlight', () => {
        const { container } = renderFountain();
        const highlight = container.querySelector(
            'circle[cx="17.5"][cy="17.5"][r="0.8"]'
        );
        expect(highlight).not.toBeNull();
        expect(highlight.getAttribute('fill')).toBe('#AAA');
        expect(highlight.getAttribute('opacity')).toBe('0.4');
    });

    it('should render the water ripple circles', () => {
        const { container } = renderFountain();
        const ripples = container.querySelectorAll(
            'circle[fill="none"][stroke="#5DADE2"]'
        );
        expect(ripples.length).toBe(3);

        const ripple5 = container.querySelector(
            'circle[cx="18"][cy="18"][r="5"]'
        );
        expect(ripple5.getAttribute('stroke-width')).toBe('0.4');
        expect(ripple5.getAttribute('opacity')).toBe('0.3');

        const ripple75 = container.querySelector(
            'circle[cx="18"][cy="18"][r="7.5"]'
        );
        expect(ripple75.getAttribute('opacity')).toBe('0.25');

        const ripple10 = container.querySelector(
            'circle[cx="18"][cy="18"][r="10"]'
        );
        expect(ripple10.getAttribute('stroke-width')).toBe('0.3');
        expect(ripple10.getAttribute('opacity')).toBe('0.2');
    });

    it('should render the flowing water arc paths', () => {
        const { container } = renderFountain();
        const arcs = container.querySelectorAll(
            'path[stroke="#5DADE2"][stroke-width="0.8"]'
        );
        expect(arcs.length).toBe(4);

        const arc1 = container.querySelector(
            'path[d="M 15 15 Q 12 13 11 16"]'
        );
        expect(arc1).not.toBeNull();
        expect(arc1.getAttribute('opacity')).toBe('0.5');
        expect(arc1.getAttribute('stroke-linecap')).toBe('round');

        const arc2 = container.querySelector(
            'path[d="M 21 15 Q 24 13 25 16"]'
        );
        expect(arc2).not.toBeNull();

        const arc3 = container.querySelector(
            'path[d="M 15 21 Q 12 23 11 20"]'
        );
        expect(arc3).not.toBeNull();

        const arc4 = container.querySelector(
            'path[d="M 21 21 Q 24 23 25 20"]'
        );
        expect(arc4).not.toBeNull();
    });

    it('should render the water droplet circles', () => {
        const { container } = renderFountain();
        const droplets = container.querySelectorAll(
            'circle[fill="#5DADE2"][r="0.7"]'
        );
        expect(droplets.length).toBe(4);

        const droplet1 = container.querySelector('circle[cx="10"][cy="13"]');
        expect(droplet1).not.toBeNull();
        expect(droplet1.getAttribute('opacity')).toBe('0.6');

        const droplet2 = container.querySelector('circle[cx="26"][cy="13"]');
        expect(droplet2).not.toBeNull();

        const droplet3 = container.querySelector('circle[cx="10"][cy="23"]');
        expect(droplet3).not.toBeNull();

        const droplet4 = container.querySelector('circle[cx="26"][cy="23"]');
        expect(droplet4).not.toBeNull();
    });

    it('should render total circle count (12 circles)', () => {
        const { container } = renderFountain();
        const circles = container.querySelectorAll('circle');
        // floor shadow, rim highlight, water surface, pillar (3), ripples (3), droplets (4) = 13
        expect(circles.length).toBe(13);
    });

    it('should render total path count (6 paths)', () => {
        const { container } = renderFountain();
        const paths = container.querySelectorAll('path');
        // basin wall, wall shadow, water highlight, 4 water arcs = 7
        expect(paths.length).toBe(7);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderFountain({ 'data-test': 'fountain' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('fountain');
    });
});
