// @improved-by-ai
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
    describe('component setup', () => {
        it('renders as a forwardRef component', () => {
            const ref = vi.fn();
            renderFirePit({ ref });
            expect(ref).toHaveBeenCalled();
        });

        it('has correct displayName', () => {
            expect(FirePitSVG.displayName).toBe('FirePitSVG');
        });

        it('renders the root <g> element', () => {
            const { container } = renderFirePit();
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toBeInTheDocument();
        });
    });

    describe('root group attributes', () => {
        it('applies the given id to the root group', () => {
            const { container } = renderFirePit({ id: 'fire-pit-1' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('id', 'fire-pit-1');
        });

        it('applies the given className to the root group', () => {
            const { container } = renderFirePit({ className: 'fire-pit-custom' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveClass('fire-pit-custom');
        });

        it('passes through rest props to the root group', () => {
            const { container } = renderFirePit({ 'data-test': 'fire-pit' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('data-test', 'fire-pit');
        });
    });

    describe('ambient glow', () => {
        it('renders glow circles with correct colors and opacities', () => {
            const { container } = renderFirePit();

            const glow1 = container.querySelector('circle[cx="18"][cy="10"][r="17"]');
            expect(glow1).toBeInTheDocument();
            expect(glow1).toHaveAttribute('fill', '#E87A20');
            expect(glow1).toHaveAttribute('opacity', '0.1');

            const glow2 = container.querySelector('circle[cx="18"][cy="10"][r="14"]');
            expect(glow2).toBeInTheDocument();
            expect(glow2).toHaveAttribute('opacity', '0.08');

            const glow3 = container.querySelector('circle[cx="18"][cy="18"][r="18"]');
            expect(glow3).toBeInTheDocument();
            expect(glow3).toHaveAttribute('opacity', '0.03');
        });
    });

    describe('stone ring', () => {
        it('renders the stone ring circle with correct attributes', () => {
            const { container } = renderFirePit();
            const stoneRing = container.querySelector('circle[cx="18"][cy="20"][r="9"]');
            expect(stoneRing).toBeInTheDocument();
            expect(stoneRing).toHaveAttribute('fill', '#555');
            expect(stoneRing).toHaveAttribute('stroke', '#333');
            expect(stoneRing).toHaveAttribute('stroke-width', '1.5');
        });
    });

    describe('embers', () => {
        it('renders the ember ellipse at base', () => {
            const { container } = renderFirePit();
            const emberEllipse = container.querySelector('ellipse[cx="18"][cy="20"][rx="6"][ry="2"]');
            expect(emberEllipse).toBeInTheDocument();
            expect(emberEllipse).toHaveAttribute('fill', '#2a1510');
        });

        it('renders ember circles at base of fire with correct attributes', () => {
            const { container } = renderFirePit();

            const ember1 = container.querySelector('circle[cx="14"][cy="19"][r="1.5"]');
            expect(ember1).toBeInTheDocument();
            expect(ember1).toHaveAttribute('fill', '#8B3A1A');
            expect(ember1).toHaveAttribute('opacity', '0.6');

            const ember2 = container.querySelector('circle[cx="20"][cy="18"][r="1.2"]');
            expect(ember2).toBeInTheDocument();
            expect(ember2).toHaveAttribute('fill', '#A04020');
            expect(ember2).toHaveAttribute('opacity', '0.5');

            const ember3 = container.querySelector('circle[cx="16"][cy="21"][r="1"]');
            expect(ember3).toBeInTheDocument();
            expect(ember3).toHaveAttribute('opacity', '0.5');

            const ember4 = container.querySelector('circle[cx="22"][cy="20"][r="0.8"]');
            expect(ember4).toBeInTheDocument();
            expect(ember4).toHaveAttribute('opacity', '0.4');
        });
    });

    describe('outer flames', () => {
        it('renders outer flame paths with dark orange color', () => {
            const { container } = renderFirePit();
            const outerFlames = container.querySelectorAll('path[fill="#D35400"]');
            expect(outerFlames.length).toBeGreaterThan(0);
        });

        it('renders the center outer flame path with correct attributes', () => {
            const { container } = renderFirePit();
            const outerFlame = container.querySelector(
                'path[d="M 18 18 Q 10 13 14 4 Q 15 1 18 1 Q 21 1 22 4 Q 26 13 18 18 Z"]'
            );
            expect(outerFlame).toBeInTheDocument();
            expect(outerFlame).toHaveAttribute('fill', '#D35400');
            expect(outerFlame).toHaveAttribute('opacity', '0.85');
        });
    });

    describe('mid flames', () => {
        it('renders mid flame paths with orange color', () => {
            const { container } = renderFirePit();
            const midFlames = container.querySelectorAll('path[fill="#E87A20"]');
            expect(midFlames.length).toBeGreaterThan(0);
        });

        it('renders the center mid flame path with correct attributes', () => {
            const { container } = renderFirePit();
            const midFlame = container.querySelector(
                'path[d="M 18 17 Q 12 12 15 5 Q 16 2.5 18 2.5 Q 20 2.5 21 5 Q 24 12 18 17 Z"]'
            );
            expect(midFlame).toBeInTheDocument();
            expect(midFlame).toHaveAttribute('fill', '#E87A20');
            expect(midFlame).toHaveAttribute('opacity', '0.95');
        });
    });

    describe('inner flames', () => {
        it('renders inner flame paths with yellow color', () => {
            const { container } = renderFirePit();
            const innerFlames = container.querySelectorAll('path[fill="#F5D060"]');
            expect(innerFlames.length).toBeGreaterThan(0);
        });

        it('renders the center inner flame path with correct attributes', () => {
            const { container } = renderFirePit();
            const innerFlame = container.querySelector(
                'path[d="M 18 15 Q 14 11 16 6 Q 16.5 4 18 4 Q 19.5 4 20 6 Q 22 11 18 15 Z"]'
            );
            expect(innerFlame).toBeInTheDocument();
            expect(innerFlame).toHaveAttribute('fill', '#F5D060');
            expect(innerFlame).toHaveAttribute('opacity', '0.95');
        });
    });

    describe('core', () => {
        it('renders the core white-hot path with correct attributes', () => {
            const { container } = renderFirePit();
            const corePath = container.querySelector(
                'path[d="M 18 13 Q 15.5 10 16.5 7 Q 17 5.5 18 5.5 Q 19 5.5 19.5 7 Q 20.5 10 18 13 Z"]'
            );
            expect(corePath).toBeInTheDocument();
            expect(corePath).toHaveAttribute('fill', '#FFF8E0');
            expect(corePath).toHaveAttribute('opacity', '0.9');
        });

        it('renders the core white ellipse with correct attributes', () => {
            const { container } = renderFirePit();
            const coreEllipse = container.querySelector('ellipse[cx="18"][cy="9"][rx="1.5"][ry="2"]');
            expect(coreEllipse).toBeInTheDocument();
            expect(coreEllipse).toHaveAttribute('fill', '#FFFFFF');
            expect(coreEllipse).toHaveAttribute('opacity', '0.6');
        });
    });

    describe('sparks', () => {
        it('renders spark circles at expected positions', () => {
            const { container } = renderFirePit();

            expect(container.querySelector('circle[cx="14"][cy="3"]')).toBeInTheDocument();
            expect(container.querySelector('circle[cx="22"][cy="2"]')).toBeInTheDocument();
            expect(container.querySelector('circle[cx="10"][cy="7"]')).toBeInTheDocument();
            expect(container.querySelector('circle[cx="25"][cy="6"]')).toBeInTheDocument();
            expect(container.querySelector('circle[cx="16"][cy="1"]')).toBeInTheDocument();
            expect(container.querySelector('circle[cx="20"][cy="1.5"]')).toBeInTheDocument();
            expect(container.querySelector('circle[cx="7"][cy="10"]')).toBeInTheDocument();
            expect(container.querySelector('circle[cx="29"][cy="9"]')).toBeInTheDocument();
            expect(container.querySelector('circle[cx="12"][cy="5"]')).toBeInTheDocument();
            expect(container.querySelector('circle[cx="24"][cy="4"]')).toBeInTheDocument();
        });

        it('renders spark circles with correct colors and opacities', () => {
            const { container } = renderFirePit();

            const spark1 = container.querySelector('circle[cx="14"][cy="3"]');
            expect(spark1).toHaveAttribute('fill', '#F5D060');
            expect(spark1).toHaveAttribute('opacity', '0.8');

            const spark2 = container.querySelector('circle[cx="22"][cy="2"]');
            expect(spark2).toHaveAttribute('fill', '#E87A20');
            expect(spark2).toHaveAttribute('opacity', '0.7');

            const spark4 = container.querySelector('circle[cx="25"][cy="6"]');
            expect(spark4).toHaveAttribute('fill', '#FFF8E0');
            expect(spark4).toHaveAttribute('opacity', '0.7');
        });
    });

    describe('element counts', () => {
        it('renders circles', () => {
            const { container } = renderFirePit();
            const circles = container.querySelectorAll('circle');
            expect(circles.length).toBeGreaterThanOrEqual(18);
        });

        it('renders ellipses', () => {
            const { container } = renderFirePit();
            const ellipses = container.querySelectorAll('ellipse');
            expect(ellipses.length).toBeGreaterThanOrEqual(2);
        });

        it('renders paths', () => {
            const { container } = renderFirePit();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBeGreaterThanOrEqual(16);
        });

        it('renders no rect elements', () => {
            const { container } = renderFirePit();
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBe(0);
        });
    });
});
