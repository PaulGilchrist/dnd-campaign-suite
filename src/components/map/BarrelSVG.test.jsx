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
    it('should render the root <g> element', () => {
        const { container } = renderBarrel();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderBarrel({ id: 'barrel-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('barrel-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderBarrel({ className: 'barrel-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('barrel-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(BarrelSVG.displayName).toBe('BarrelSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderBarrel({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the barrel body path', () => {
        const { container } = renderBarrel();
        const bodyPath = container.querySelector(
            'path[d="M 10 4 Q 6 18 10 32 L 26 32 Q 30 18 26 4 Z"]'
        );
        expect(bodyPath).not.toBeNull();
        expect(bodyPath.getAttribute('fill')).toBe('#A0652D');
        expect(bodyPath.getAttribute('stroke')).toBe('#6B3E1F');
        expect(bodyPath.getAttribute('stroke-width')).toBe('0.8');
    });

    it('should render the left side shading path', () => {
        const { container } = renderBarrel();
        const shadingPath = container.querySelector(
            'path[d="M 10 4 Q 6 18 10 32 L 16 32 Q 12 18 16 4 Z"]'
        );
        expect(shadingPath).not.toBeNull();
        expect(shadingPath.getAttribute('fill')).toBe('#8B5524');
        expect(shadingPath.getAttribute('opacity')).toBe('0.5');
    });

    it('should render the top rim ellipse', () => {
        const { container } = renderBarrel();
        const topRim = container.querySelector(
            'ellipse[cx="18"][cy="4"][rx="8"][ry="2.5"]'
        );
        expect(topRim).not.toBeNull();
        expect(topRim.getAttribute('fill')).toBe('#8B5524');
        expect(topRim.getAttribute('stroke')).toBe('#6B3E1F');
        expect(topRim.getAttribute('stroke-width')).toBe('0.6');
    });

    it('should render the bottom rim ellipse', () => {
        const { container } = renderBarrel();
        const bottomRim = container.querySelector(
            'ellipse[cx="18"][cy="32"][rx="8"][ry="2.5"]'
        );
        expect(bottomRim).not.toBeNull();
        expect(bottomRim.getAttribute('fill')).toBe('#8B5524');
        expect(bottomRim.getAttribute('stroke')).toBe('#6B3E1F');
    });

    it('should render the top opening ellipse', () => {
        const { container } = renderBarrel();
        const opening = container.querySelector(
            'ellipse[cx="18"][cy="4"][rx="6"][ry="1.8"]'
        );
        expect(opening).not.toBeNull();
        expect(opening.getAttribute('fill')).toBe('#5C3317');
        expect(opening.getAttribute('stroke')).toBe('#4A2810');
    });

    it('should render the top metal band rects', () => {
        const { container } = renderBarrel();
        const topBandDark = container.querySelector(
            'rect[x="9.5"][y="10"][width="17"][height="2"]'
        );
        expect(topBandDark).not.toBeNull();
        expect(topBandDark.getAttribute('fill')).toBe('#555');
        expect(topBandDark.getAttribute('rx')).toBe('0.5');

        const topBandLight = container.querySelector(
            'rect[x="9.5"][y="10"][width="17"][height="0.5"]'
        );
        expect(topBandLight).not.toBeNull();
        expect(topBandLight.getAttribute('fill')).toBe('#777');
    });

    it('should render the middle metal band rects', () => {
        const { container } = renderBarrel();
        const midBandDark = container.querySelector(
            'rect[x="9"][y="18"][width="18"][height="2"]'
        );
        expect(midBandDark).not.toBeNull();
        expect(midBandDark.getAttribute('fill')).toBe('#555');
        expect(midBandDark.getAttribute('rx')).toBe('0.5');

        const midBandLight = container.querySelector(
            'rect[x="9"][y="18"][width="18"][height="0.5"]'
        );
        expect(midBandLight).not.toBeNull();
        expect(midBandLight.getAttribute('fill')).toBe('#777');
    });

    it('should render the bottom metal band rects', () => {
        const { container } = renderBarrel();
        const bottomBandDark = container.querySelector(
            'rect[x="9.5"][y="26"][width="17"][height="2"]'
        );
        expect(bottomBandDark).not.toBeNull();
        expect(bottomBandDark.getAttribute('fill')).toBe('#555');
        expect(bottomBandDark.getAttribute('rx')).toBe('0.5');

        const bottomBandLight = container.querySelector(
            'rect[x="9.5"][y="26"][width="17"][height="0.5"]'
        );
        expect(bottomBandLight).not.toBeNull();
        expect(bottomBandLight.getAttribute('fill')).toBe('#777');
    });

    it('should render the right side highlight path', () => {
        const { container } = renderBarrel();
        const highlightPath = container.querySelector(
            'path[d="M 26 4 Q 30 18 26 32 L 22 32 Q 26 18 22 4 Z"]'
        );
        expect(highlightPath).not.toBeNull();
        expect(highlightPath.getAttribute('fill')).toBe('#B87A3A');
        expect(highlightPath.getAttribute('opacity')).toBe('0.4');
    });

    it('should render the wood grain lines', () => {
        const { container } = renderBarrel();
        const grainPaths = container.querySelectorAll(
            'path[stroke="#7A4E20"][stroke-width="0.4"][opacity="0.6"]'
        );
        expect(grainPaths.length).toBe(3);
    });

    it('should render the left wood grain line', () => {
        const { container } = renderBarrel();
        const grainPath = container.querySelector(
            'path[d="M 14 8 Q 13 18 14 28"]'
        );
        expect(grainPath).not.toBeNull();
        expect(grainPath.getAttribute('fill')).toBe('none');
    });

    it('should render the center wood grain line', () => {
        const { container } = renderBarrel();
        const grainPath = container.querySelector(
            'path[d="M 18 7 Q 17 18 18 29"]'
        );
        expect(grainPath).not.toBeNull();
        expect(grainPath.getAttribute('fill')).toBe('none');
    });

    it('should render the right wood grain line', () => {
        const { container } = renderBarrel();
        const grainPath = container.querySelector(
            'path[d="M 22 8 Q 23 18 22 28"]'
        );
        expect(grainPath).not.toBeNull();
        expect(grainPath.getAttribute('fill')).toBe('none');
    });

    it('should render total rect count (6 metal band rects)', () => {
        const { container } = renderBarrel();
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(6);
    });

    it('should render total ellipse count (3 ellipses)', () => {
        const { container } = renderBarrel();
        const ellipses = container.querySelectorAll('ellipse');
        expect(ellipses.length).toBe(3);
    });

    it('should render total path count (6 paths)', () => {
        const { container } = renderBarrel();
        const paths = container.querySelectorAll('path');
        // barrel body, left shading, right highlight, 3 wood grain lines = 6
        expect(paths.length).toBe(6);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderBarrel({ 'data-test': 'barrel' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('barrel');
    });
});
