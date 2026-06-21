// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AltarSVG from './AltarSVG.jsx';

const renderAltar = (props = {}) =>
    render(
        <svg>
            <AltarSVG {...props} />
        </svg>
    );

describe('AltarSVG', () => {
    it('should render the root <g> element', () => {
        const { container } = renderAltar();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).toBeInTheDocument();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderAltar({ id: 'altar-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('altar-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderAltar({ className: 'altar-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('altar-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(AltarSVG.displayName).toBe('AltarSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderAltar({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderAltar({ 'data-test': 'altar' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('altar');
    });

    describe('stone base elements', () => {
        it.each`
            element                        | selector                                            | description
            ${'floor shadow rect'}         | ${'rect[opacity="0.25"]'}                           | ${''}
            ${'stone base rect'}           | ${'rect[fill="#8A7F70"]'}                           | ${''}
            ${'top surface rect'}          | ${'rect[fill="#9B9080"]'}                           | ${''}
            ${'decorative border rect'}    | ${'rect[fill="none"][stroke="#7A6F60"]'}            | ${''}
            ${'edge shadow rects'}         | ${'rect[fill="#4A4035"]'}                           | ${''}
            ${'top edge highlight'}        | ${'rect[fill="#B0A090"][opacity="0.3"]'}            | ${''}
            ${'offering depression'}       | ${'rect[fill="#7A6F60"][stroke="#6B6050"]'}         | ${''}
        `('should render the $element', ({ selector }) => {
            const { container } = renderAltar();
            const match = container.querySelector(selector);
            expect(match).toBeInTheDocument();
        });
    });

    describe('cloth and trim elements', () => {
        it('should render the red cloth runner', () => {
            const { container } = renderAltar();
            const clothRect = container.querySelector('rect[fill="#8B0000"]');
            expect(clothRect).toBeInTheDocument();
        });

        it('should render the gold trim rects', () => {
            const { container } = renderAltar();
            const goldTrims = container.querySelectorAll('rect[fill="#D4AF37"]');
            expect(goldTrims.length).toBeGreaterThan(0);
        });
    });

    describe('blood elements', () => {
        it('should render the blood stain path', () => {
            const { container } = renderAltar();
            const bloodPath = container.querySelector('path[fill="#4A0000"]');
            expect(bloodPath).toBeInTheDocument();
        });

        it('should render blood spatter circles', () => {
            const { container } = renderAltar();
            const spatterCircles = container.querySelectorAll('circle[fill="#4A0000"]');
            expect(spatterCircles.length).toBeGreaterThan(0);
        });
    });

    describe('candle elements', () => {
        it('should render candle glow circles', () => {
            const { container } = renderAltar();
            const glows = container.querySelectorAll('circle[fill="#E87A20"][opacity="0.12"]');
            expect(glows.length).toBeGreaterThan(0);
        });

        it('should render candle flame circles', () => {
            const { container } = renderAltar();
            const flames = container.querySelectorAll('circle[fill="#E87A20"]');
            expect(flames.length).toBeGreaterThan(0);
        });

        it('should render candle flame center circles', () => {
            const { container } = renderAltar();
            const centers = container.querySelectorAll('circle[fill="#F5D060"]');
            expect(centers.length).toBeGreaterThan(0);
        });

        it('should render candle body rects', () => {
            const { container } = renderAltar();
            const candleBodies = container.querySelectorAll('rect[fill="#F5F0E0"]');
            expect(candleBodies.length).toBeGreaterThan(0);
        });
    });

    describe('rune elements', () => {
        it('should render the rune glow circles', () => {
            const { container } = renderAltar();
            const runeGlow = container.querySelectorAll('circle[fill="#D4A017"]');
            expect(runeGlow.length).toBeGreaterThan(0);
        });

        it('should render the rune rings', () => {
            const { container } = renderAltar();
            const rings = container.querySelectorAll('circle[fill="none"][stroke="#D4A017"]');
            expect(rings.length).toBeGreaterThan(0);
        });

        it('should render the starburst path', () => {
            const { container } = renderAltar();
            const starburst = container.querySelector(
                'path[fill="#D4A017"][opacity="0.85"]'
            );
            expect(starburst).toBeInTheDocument();
        });

        it('should render the diagonal rays path', () => {
            const { container } = renderAltar();
            const rays = container.querySelector(
                'path[fill="#D4A017"][opacity="0.4"]'
            );
            expect(rays).toBeInTheDocument();
        });
    });

    describe('goblet elements', () => {
        it('should render the offering goblet rim', () => {
            const { container } = renderAltar();
            const gobletRim = container.querySelector(
                'circle[fill="#D4A017"][stroke="#B8960F"]'
            );
            expect(gobletRim).toBeInTheDocument();
        });

        it('should render the goblet interior', () => {
            const { container } = renderAltar();
            const interior = container.querySelector('circle[fill="#5C4510"]');
            expect(interior).toBeInTheDocument();
        });

        it('should render the goblet liquid glint', () => {
            const { container } = renderAltar();
            const glint = container.querySelector(
                'circle[fill="#F5D060"][opacity="0.5"]'
            );
            expect(glint).toBeInTheDocument();
        });

        it('should render the goblet shadow ellipse', () => {
            const { container } = renderAltar();
            const shadow = container.querySelector('ellipse[fill="#4A4035"]');
            expect(shadow).toBeInTheDocument();
        });
    });

    describe('element counts', () => {
        it('should render multiple SVG group elements', () => {
            const { container } = renderAltar();
            const groups = container.querySelectorAll('g');
            expect(groups.length).toBeGreaterThanOrEqual(4);
        });

        it('should render rects', () => {
            const { container } = renderAltar();
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBeGreaterThan(0);
        });

        it('should render circles', () => {
            const { container } = renderAltar();
            const circles = container.querySelectorAll('circle');
            expect(circles.length).toBeGreaterThan(0);
        });

        it('should render paths', () => {
            const { container } = renderAltar();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBeGreaterThan(0);
        });

        it('should render ellipses', () => {
            const { container } = renderAltar();
            const ellipses = container.querySelectorAll('ellipse');
            expect(ellipses.length).toBeGreaterThan(0);
        });
    });
});
