import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FirePitSVG from './FirePitSVG.jsx';

const renderFirePit = (props = {}) =>
    render(
        <svg>
            <FirePitSVG {...props} />
        </svg>
    );

describe('FirePitSVG', () => {
    it('should render the root <g> element', () => {
        const { container } = renderFirePit();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderFirePit({ id: 'fire-pit-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('fire-pit-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderFirePit({ className: 'fire-pit-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('fire-pit-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(FirePitSVG.displayName).toBe('FirePitSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderFirePit({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render 3 ambient glow circles', () => {
        const { container } = renderFirePit();
        const glowCircles = container.querySelectorAll('circle[cx="18"][cy="10"][r="17"]');
        expect(glowCircles.length).toBe(1);

        const glowCircle2 = container.querySelectorAll('circle[cx="18"][cy="10"][r="14"]');
        expect(glowCircle2.length).toBe(1);

        const glowCircle3 = container.querySelectorAll('circle[cx="18"][cy="18"][r="18"]');
        expect(glowCircle3.length).toBe(1);
    });

    it('should render the ambient glow circles with correct colors and opacities', () => {
        const { container } = renderFirePit();
        const glowCircle = container.querySelector('circle[cx="18"][cy="10"][r="17"]');
        expect(glowCircle.getAttribute('fill')).toBe('#E87A20');
        expect(glowCircle.getAttribute('opacity')).toBe('0.1');

        const glowCircle2 = container.querySelector('circle[cx="18"][cy="10"][r="14"]');
        expect(glowCircle2.getAttribute('opacity')).toBe('0.08');

        const glowCircle3 = container.querySelector('circle[cx="18"][cy="18"][r="18"]');
        expect(glowCircle3.getAttribute('opacity')).toBe('0.03');
    });

    it('should render the stone ring circle', () => {
        const { container } = renderFirePit();
        const stoneRing = container.querySelector('circle[cx="18"][cy="20"][r="9"]');
        expect(stoneRing).not.toBeNull();
        expect(stoneRing.getAttribute('fill')).toBe('#555');
        expect(stoneRing.getAttribute('stroke')).toBe('#333');
        expect(stoneRing.getAttribute('stroke-width')).toBe('1.5');
    });

    it('should render the ember ellipse at base', () => {
        const { container } = renderFirePit();
        const emberEllipse = container.querySelector('ellipse[cx="18"][cy="20"][rx="6"][ry="2"]');
        expect(emberEllipse).not.toBeNull();
        expect(emberEllipse.getAttribute('fill')).toBe('#2a1510');
    });

    it('should render 4 ember circles at base of fire', () => {
        const { container } = renderFirePit();
        const embers = container.querySelectorAll('ellipse[cx="18"][cy="20"]');
        expect(embers.length).toBe(1);

        const emberCircle1 = container.querySelector('circle[cx="14"][cy="19"][r="1.5"]');
        expect(emberCircle1).not.toBeNull();
        expect(emberCircle1.getAttribute('fill')).toBe('#8B3A1A');
        expect(emberCircle1.getAttribute('opacity')).toBe('0.6');

        const emberCircle2 = container.querySelector('circle[cx="20"][cy="18"][r="1.2"]');
        expect(emberCircle2).not.toBeNull();
        expect(emberCircle2.getAttribute('fill')).toBe('#A04020');
        expect(emberCircle2.getAttribute('opacity')).toBe('0.5');

        const emberCircle3 = container.querySelector('circle[cx="16"][cy="21"][r="1"]');
        expect(emberCircle3).not.toBeNull();
        expect(emberCircle3.getAttribute('opacity')).toBe('0.5');

        const emberCircle4 = container.querySelector('circle[cx="22"][cy="20"][r="0.8"]');
        expect(emberCircle4).not.toBeNull();
        expect(emberCircle4.getAttribute('opacity')).toBe('0.4');
    });

    it('should render 7 outer flame paths with dark orange color', () => {
        const { container } = renderFirePit();
        const outerFlames = container.querySelectorAll(
            'path[fill="#D35400"]'
        );
        expect(outerFlames.length).toBe(7);
    });

    it('should render the center outer flame path', () => {
        const { container } = renderFirePit();
        const outerFlame = container.querySelector(
            'path[d="M 18 18 Q 10 13 14 4 Q 15 1 18 1 Q 21 1 22 4 Q 26 13 18 18 Z"]'
        );
        expect(outerFlame).not.toBeNull();
        expect(outerFlame.getAttribute('fill')).toBe('#D35400');
        expect(outerFlame.getAttribute('opacity')).toBe('0.85');
    });

    it('should render 5 mid flame paths with orange color', () => {
        const { container } = renderFirePit();
        const midFlames = container.querySelectorAll(
            'path[fill="#E87A20"]'
        );
        expect(midFlames.length).toBe(5);
    });

    it('should render the center mid flame path', () => {
        const { container } = renderFirePit();
        const midFlame = container.querySelector(
            'path[d="M 18 17 Q 12 12 15 5 Q 16 2.5 18 2.5 Q 20 2.5 21 5 Q 24 12 18 17 Z"]'
        );
        expect(midFlame).not.toBeNull();
        expect(midFlame.getAttribute('fill')).toBe('#E87A20');
        expect(midFlame.getAttribute('opacity')).toBe('0.95');
    });

    it('should render 3 inner flame paths with yellow color', () => {
        const { container } = renderFirePit();
        const innerFlames = container.querySelectorAll(
            'path[fill="#F5D060"]'
        );
        expect(innerFlames.length).toBe(3);
    });

    it('should render the center inner flame path', () => {
        const { container } = renderFirePit();
        const innerFlame = container.querySelector(
            'path[d="M 18 15 Q 14 11 16 6 Q 16.5 4 18 4 Q 19.5 4 20 6 Q 22 11 18 15 Z"]'
        );
        expect(innerFlame).not.toBeNull();
        expect(innerFlame.getAttribute('fill')).toBe('#F5D060');
        expect(innerFlame.getAttribute('opacity')).toBe('0.95');
    });

    it('should render the core white-hot path', () => {
        const { container } = renderFirePit();
        const corePath = container.querySelector(
            'path[d="M 18 13 Q 15.5 10 16.5 7 Q 17 5.5 18 5.5 Q 19 5.5 19.5 7 Q 20.5 10 18 13 Z"]'
        );
        expect(corePath).not.toBeNull();
        expect(corePath.getAttribute('fill')).toBe('#FFF8E0');
        expect(corePath.getAttribute('opacity')).toBe('0.9');
    });

    it('should render the core white ellipse', () => {
        const { container } = renderFirePit();
        const coreEllipse = container.querySelector('ellipse[cx="18"][cy="9"][rx="1.5"][ry="2"]');
        expect(coreEllipse).not.toBeNull();
        expect(coreEllipse.getAttribute('fill')).toBe('#FFFFFF');
        expect(coreEllipse.getAttribute('opacity')).toBe('0.6');
    });

    it('should render the core path with correct fill', () => {
        const { container } = renderFirePit();
        const corePath = container.querySelector(
            'path[d="M 18 13 Q 15.5 10 16.5 7 Q 17 5.5 18 5.5 Q 19 5.5 19.5 7 Q 20.5 10 18 13 Z"]'
        );
        expect(corePath.getAttribute('fill')).toBe('#FFF8E0');
    });

    it('should render 10 floating spark circles', () => {
        const { container } = renderFirePit();
        const sparks = container.querySelectorAll('circle[cx="14"][cy="3"]');
        expect(sparks.length).toBe(1);

        const spark2 = container.querySelector('circle[cx="22"][cy="2"]');
        expect(spark2).not.toBeNull();

        const spark3 = container.querySelector('circle[cx="10"][cy="7"]');
        expect(spark3).not.toBeNull();

        const spark4 = container.querySelector('circle[cx="25"][cy="6"]');
        expect(spark4).not.toBeNull();

        const spark5 = container.querySelector('circle[cx="16"][cy="1"]');
        expect(spark5).not.toBeNull();

        const spark6 = container.querySelector('circle[cx="20"][cy="1.5"]');
        expect(spark6).not.toBeNull();

        const spark7 = container.querySelector('circle[cx="7"][cy="10"]');
        expect(spark7).not.toBeNull();

        const spark8 = container.querySelector('circle[cx="29"][cy="9"]');
        expect(spark8).not.toBeNull();

        const spark9 = container.querySelector('circle[cx="12"][cy="5"]');
        expect(spark9).not.toBeNull();

        const spark10 = container.querySelector('circle[cx="24"][cy="4"]');
        expect(spark10).not.toBeNull();
    });

    it('should render spark circles with correct colors', () => {
        const { container } = renderFirePit();
        const spark1 = container.querySelector('circle[cx="14"][cy="3"]');
        expect(spark1.getAttribute('fill')).toBe('#F5D060');
        expect(spark1.getAttribute('opacity')).toBe('0.8');

        const spark2 = container.querySelector('circle[cx="22"][cy="2"]');
        expect(spark2.getAttribute('fill')).toBe('#E87A20');
        expect(spark2.getAttribute('opacity')).toBe('0.7');

        const spark4 = container.querySelector('circle[cx="25"][cy="6"]');
        expect(spark4.getAttribute('fill')).toBe('#FFF8E0');
        expect(spark4.getAttribute('opacity')).toBe('0.7');
    });

    it('should render total circle count (4 glow + 4 ember + 10 sparks = 18)', () => {
        const { container } = renderFirePit();
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(18);
    });

    it('should render total ellipse count (1 ember + 1 core = 2)', () => {
        const { container } = renderFirePit();
        const ellipses = container.querySelectorAll('ellipse');
        expect(ellipses.length).toBe(2);
    });

    it('should render total path count (7 outer + 5 mid + 3 inner + 1 core = 16)', () => {
        const { container } = renderFirePit();
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(16);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderFirePit({ 'data-test': 'fire-pit' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('fire-pit');
    });

    it('should render no rect elements', () => {
        const { container } = renderFirePit();
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(0);
    });
});
