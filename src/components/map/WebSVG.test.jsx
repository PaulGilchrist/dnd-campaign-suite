import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WebSVG from './WebSVG.jsx';

const renderWeb = (props = {}) =>
    render(
        <svg>
            <WebSVG {...props} />
        </svg>
    );

describe('WebSVG', () => {
    it('should render the root <g> element', () => {
        const { container } = renderWeb();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderWeb({ id: 'web-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('web-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderWeb({ className: 'web-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('web-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(WebSVG.displayName).toBe('WebSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderWeb({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render 8 radial lines from center', () => {
        const { container } = renderWeb();
        const radialLines = container.querySelectorAll(
            'line[stroke="#CCC"][stroke-width="0.4"][opacity="0.6"]'
        );
        expect(radialLines.length).toBe(8);
    });

    it('should render the center-to-corner radial line (top-left)', () => {
        const { container } = renderWeb();
        const line = container.querySelector(
            'line[x1="18"][y1="18"][x2="2"][y2="2"]'
        );
        expect(line).not.toBeNull();
        expect(line.getAttribute('stroke')).toBe('#CCC');
        expect(line.getAttribute('stroke-width')).toBe('0.4');
        expect(line.getAttribute('opacity')).toBe('0.6');
    });

    it('should render the center-to-top radial line', () => {
        const { container } = renderWeb();
        const line = container.querySelector(
            'line[x1="18"][y1="18"][x2="18"][y2="2"]'
        );
        expect(line).not.toBeNull();
    });

    it('should render the center-to-top-right radial line', () => {
        const { container } = renderWeb();
        const line = container.querySelector(
            'line[x1="18"][y1="18"][x2="34"][y2="2"]'
        );
        expect(line).not.toBeNull();
    });

    it('should render the center-to-right radial line', () => {
        const { container } = renderWeb();
        const line = container.querySelector(
            'line[x1="18"][y1="18"][x2="34"][y2="18"]'
        );
        expect(line).not.toBeNull();
    });

    it('should render the center-to-bottom-right radial line', () => {
        const { container } = renderWeb();
        const line = container.querySelector(
            'line[x1="18"][y1="18"][x2="34"][y2="34"]'
        );
        expect(line).not.toBeNull();
    });

    it('should render the center-to-bottom radial line', () => {
        const { container } = renderWeb();
        const line = container.querySelector(
            'line[x1="18"][y1="18"][x2="18"][y2="34"]'
        );
        expect(line).not.toBeNull();
    });

    it('should render the center-to-bottom-left radial line', () => {
        const { container } = renderWeb();
        const line = container.querySelector(
            'line[x1="18"][y1="18"][x2="2"][y2="34"]'
        );
        expect(line).not.toBeNull();
    });

    it('should render the center-to-left radial line', () => {
        const { container } = renderWeb();
        const line = container.querySelector(
            'line[x1="18"][y1="18"][x2="2"][y2="18"]'
        );
        expect(line).not.toBeNull();
    });

    it('should render the outermost web ring polygon', () => {
        const { container } = renderWeb();
        const polygon = container.querySelector(
            'polygon[points="8,8 18,5 28,8 31,18 28,28 18,31 8,28 5,18"]'
        );
        expect(polygon).not.toBeNull();
        expect(polygon.getAttribute('fill')).toBe('none');
        expect(polygon.getAttribute('stroke')).toBe('#CCC');
        expect(polygon.getAttribute('stroke-width')).toBe('0.4');
        expect(polygon.getAttribute('opacity')).toBe('0.6');
    });

    it('should render the second web ring polygon', () => {
        const { container } = renderWeb();
        const polygon = container.querySelector(
            'polygon[points="11,11 18,9 25,11 27,18 25,25 18,27 11,25 9,18"]'
        );
        expect(polygon).not.toBeNull();
        expect(polygon.getAttribute('fill')).toBe('none');
        expect(polygon.getAttribute('stroke')).toBe('#CCC');
    });

    it('should render the third web ring polygon', () => {
        const { container } = renderWeb();
        const polygon = container.querySelector(
            'polygon[points="13,13 18,12 23,13 24,18 23,23 18,24 13,23 12,18"]'
        );
        expect(polygon).not.toBeNull();
        expect(polygon.getAttribute('fill')).toBe('none');
        expect(polygon.getAttribute('stroke')).toBe('#CCC');
    });

    it('should render the innermost web ring polygon', () => {
        const { container } = renderWeb();
        const polygon = container.querySelector(
            'polygon[points="15,15 18,14 21,15 22,18 21,21 18,22 15,21 14,18"]'
        );
        expect(polygon).not.toBeNull();
        expect(polygon.getAttribute('fill')).toBe('none');
        expect(polygon.getAttribute('stroke')).toBe('#CCC');
    });

    it('should render 4 web ring polygons', () => {
        const { container } = renderWeb();
        const polygons = container.querySelectorAll('polygon');
        expect(polygons.length).toBe(4);
    });

    it('should render the spider body ellipse', () => {
        const { container } = renderWeb();
        const body = container.querySelector(
            'ellipse[cx="18"][cy="18"][rx="2"][ry="2.5"]'
        );
        expect(body).not.toBeNull();
        expect(body.getAttribute('fill')).toBe('#222');
    });

    it('should render the spider head circle', () => {
        const { container } = renderWeb();
        const head = container.querySelector(
            'circle[cx="18"][cy="16"][r="1"]'
        );
        expect(head).not.toBeNull();
        expect(head.getAttribute('fill')).toBe('#222');
    });

    it('should render 3 spider legs on the left side', () => {
        const { container } = renderWeb();
        const leftLegs = container.querySelectorAll(
            'line[stroke="#222"][stroke-width="0.5"][stroke-linecap="round"]'
        );
        // All 6 spider legs match this selector (3 left + 3 right)
        expect(leftLegs.length).toBe(6);
    });

    it('should render the top-left spider leg', () => {
        const { container } = renderWeb();
        const leg = container.querySelector(
            'line[x1="16"][y1="16"][x2="13"][y2="14"]'
        );
        expect(leg).not.toBeNull();
        expect(leg.getAttribute('stroke')).toBe('#222');
        expect(leg.getAttribute('stroke-width')).toBe('0.5');
        expect(leg.getAttribute('stroke-linecap')).toBe('round');
    });

    it('should render the middle-left spider leg', () => {
        const { container } = renderWeb();
        const leg = container.querySelector(
            'line[x1="16"][y1="17"][x2="13"][y2="17"]'
        );
        expect(leg).not.toBeNull();
    });

    it('should render the bottom-left spider leg', () => {
        const { container } = renderWeb();
        const leg = container.querySelector(
            'line[x1="16"][y1="18"][x2="13"][y2="20"]'
        );
        expect(leg).not.toBeNull();
    });

    it('should render the top-right spider leg', () => {
        const { container } = renderWeb();
        const leg = container.querySelector(
            'line[x1="20"][y1="16"][x2="23"][y2="14"]'
        );
        expect(leg).not.toBeNull();
    });

    it('should render the middle-right spider leg', () => {
        const { container } = renderWeb();
        const leg = container.querySelector(
            'line[x1="20"][y1="17"][x2="23"][y2="17"]'
        );
        expect(leg).not.toBeNull();
    });

    it('should render the bottom-right spider leg', () => {
        const { container } = renderWeb();
        const leg = container.querySelector(
            'line[x1="20"][y1="18"][x2="23"][y2="20"]'
        );
        expect(leg).not.toBeNull();
    });

    it('should render the left spider eye highlight', () => {
        const { container } = renderWeb();
        const eye = container.querySelector(
            'circle[cx="17.5"][cy="15.5"][r="0.3"]'
        );
        expect(eye).not.toBeNull();
        expect(eye.getAttribute('fill')).toBe('#FFF');
    });

    it('should render the right spider eye highlight', () => {
        const { container } = renderWeb();
        const eye = container.querySelector(
            'circle[cx="18.5"][cy="15.5"][r="0.3"]'
        );
        expect(eye).not.toBeNull();
        expect(eye.getAttribute('fill')).toBe('#FFF');
    });

    it('should render 2 spider eye highlight circles', () => {
        const { container } = renderWeb();
        const eyeHighlights = container.querySelectorAll(
            'circle[fill="#FFF"]'
        );
        expect(eyeHighlights.length).toBe(2);
    });

    it('should render total line count (14: 8 radial + 6 spider legs)', () => {
        const { container } = renderWeb();
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(14);
    });

    it('should render total circle count (3: head + 2 eye highlights)', () => {
        const { container } = renderWeb();
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(3);
    });

    it('should render total ellipse count (1: spider body)', () => {
        const { container } = renderWeb();
        const ellipses = container.querySelectorAll('ellipse');
        expect(ellipses.length).toBe(1);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderWeb({ 'data-test': 'web' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('web');
    });
});
