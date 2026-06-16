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
        expect(rootGroup).not.toBeNull();
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

    it('should render the floor shadow rect', () => {
        const { container } = renderAltar();
        // The shadow rect has opacity 0.25
        const shadowRects = container.querySelectorAll('rect[opacity="0.25"]');
        expect(shadowRects.length).toBeGreaterThan(0);
    });

    it('should render the stone base rect', () => {
        const { container } = renderAltar();
        const baseRect = container.querySelector('rect[fill="#8A7F70"]');
        expect(baseRect).not.toBeNull();
    });

    it('should render the top surface rect', () => {
        const { container } = renderAltar();
        const topSurface = container.querySelector('rect[fill="#9B9080"]');
        expect(topSurface).not.toBeNull();
    });

    it('should render the decorative border rect', () => {
        const { container } = renderAltar();
        const borderRect = container.querySelector('rect[fill="none"][stroke="#7A6F60"]');
        expect(borderRect).not.toBeNull();
    });

    it('should render the red cloth runner', () => {
        const { container } = renderAltar();
        const clothRect = container.querySelector('rect[fill="#8B0000"]');
        expect(clothRect).not.toBeNull();
    });

    it('should render the gold trim rects', () => {
        const { container } = renderAltar();
        const goldTrims = container.querySelectorAll('rect[fill="#D4AF37"]');
        expect(goldTrims.length).toBe(2);
    });

    it('should render the offering depression', () => {
        const { container } = renderAltar();
        const depression = container.querySelector('rect[fill="#7A6F60"][stroke="#6B6050"]');
        expect(depression).not.toBeNull();
    });

    it('should render the blood stain path', () => {
        const { container } = renderAltar();
        const bloodPath = container.querySelector('path[fill="#4A0000"]');
        expect(bloodPath).not.toBeNull();
    });

    it('should render blood spatter circles', () => {
        const { container } = renderAltar();
        // Blood spatters have opacity values 0.2, 0.15, 0.2
        const spatterCircles = container.querySelectorAll('circle[fill="#4A0000"]');
        expect(spatterCircles.length).toBeGreaterThan(0);
    });

    it('should render 4 candle groups', () => {
        const { container } = renderAltar();
        const candleGroups = container.querySelectorAll('g');
        // Multiple groups for candles, rune, and goblet
        expect(candleGroups.length).toBeGreaterThanOrEqual(4);
    });

    it('should render candle flames', () => {
        const { container } = renderAltar();
        const flames = container.querySelectorAll('circle[fill="#E87A20"]');
        expect(flames.length).toBe(8); // 4 glow + 4 flame
    });

    it('should render candle flame centers', () => {
        const { container } = renderAltar();
        const flameCenters = container.querySelectorAll('circle[fill="#F5D060"]');
        expect(flameCenters.length).toBe(6); // 4 candle + 1 rune center + 1 goblet glint
    });

    it('should render the central rune glow circles', () => {
        const { container } = renderAltar();
        const runeGlow = container.querySelectorAll('circle[fill="#D4A017"]');
        expect(runeGlow.length).toBeGreaterThan(0);
    });

    it('should render the rune outer ring', () => {
        const { container } = renderAltar();
        const outerRing = container.querySelector(
            'circle[fill="none"][stroke="#D4A017"]'
        );
        expect(outerRing).not.toBeNull();
    });

    it('should render the rune inner ring', () => {
        const { container } = renderAltar();
        const innerRing = container.querySelector(
            'circle[fill="none"][stroke="#D4A017"]'
        );
        expect(innerRing).not.toBeNull();
    });

    it('should render the starburst path', () => {
        const { container } = renderAltar();
        const starburst = container.querySelector(
            'path[fill="#D4A017"][opacity="0.85"]'
        );
        expect(starburst).not.toBeNull();
    });

    it('should render the diagonal rays path', () => {
        const { container } = renderAltar();
        const rays = container.querySelector(
            'path[fill="#D4A017"][opacity="0.4"]'
        );
        expect(rays).not.toBeNull();
    });

    it('should render the offering goblet', () => {
        const { container } = renderAltar();
        const gobletRim = container.querySelector(
            'circle[fill="#D4A017"][stroke="#B8960F"]'
        );
        expect(gobletRim).not.toBeNull();
    });

    it('should render the goblet interior', () => {
        const { container } = renderAltar();
        const interior = container.querySelector('circle[fill="#5C4510"]');
        expect(interior).not.toBeNull();
    });

    it('should render the goblet liquid glint', () => {
        const { container } = renderAltar();
        const glint = container.querySelector(
            'circle[fill="#F5D060"][opacity="0.5"]'
        );
        expect(glint).not.toBeNull();
    });

    it('should render the goblet shadow ellipse', () => {
        const { container } = renderAltar();
        const shadow = container.querySelector('ellipse[fill="#4A4035"]');
        expect(shadow).not.toBeNull();
    });

    it('should render edge shadow rects', () => {
        const { container } = renderAltar();
        const edgeShadows = container.querySelectorAll('rect[fill="#4A4035"]');
        expect(edgeShadows.length).toBeGreaterThan(0);
    });

    it('should render the top edge highlight', () => {
        const { container } = renderAltar();
        const highlight = container.querySelector(
            'rect[fill="#B0A090"][opacity="0.3"]'
        );
        expect(highlight).not.toBeNull();
    });

    it('should render candle body rects', () => {
        const { container } = renderAltar();
        const candleBodies = container.querySelectorAll('rect[fill="#F5F0E0"]');
        expect(candleBodies.length).toBe(4);
    });

    it('should render total rect count', () => {
        const { container } = renderAltar();
        const rects = container.querySelectorAll('rect');
        // Floor shadow(1), stone base(1), top surface(1), border(1),
        // edge shadows(2), top highlight(1), red cloth(1), gold trims(2),
        // offering depression(1), candle bodies(4) = 15
        expect(rects.length).toBe(15);
    });

    it('should render total circle count', () => {
        const container = renderAltar();
        const circles = container.container.querySelectorAll('circle');
        // Blood spatters(3), candle glows(4), candle flames(4),
        // rune glows(2), rune rings(2), rune center(1),
        // goblet rim(1), goblet interior(1), goblet glint(1),
        // goblet liquid glint(1) = 23
        expect(circles.length).toBe(23);
    });

    it('should render total path count', () => {
        const { container } = renderAltar();
        const paths = container.querySelectorAll('path');
        // Blood stain(1), starburst(1), diagonal rays(1) = 3
        expect(paths.length).toBe(3);
    });

    it('should render total ellipse count', () => {
        const { container } = renderAltar();
        const ellipses = container.querySelectorAll('ellipse');
        // Goblet shadow(1) = 1
        expect(ellipses.length).toBe(1);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderAltar({ 'data-test': 'altar' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('altar');
    });
});
