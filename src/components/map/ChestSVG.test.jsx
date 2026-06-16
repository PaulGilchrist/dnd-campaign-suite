import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChestSVG from './ChestSVG.jsx';

const renderChest = (props = {}) =>
    render(
        <svg>
            <ChestSVG {...props} />
        </svg>
    );

describe('ChestSVG', () => {
    it('should render the root <g> element', () => {
        const { container } = renderChest();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderChest({ id: 'chest-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('chest-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderChest({ className: 'chest-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('chest-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(ChestSVG.displayName).toBe('ChestSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderChest({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the floor shadow rect', () => {
        const { container } = renderChest();
        const shadow = container.querySelector(
            'rect[x="7"][y="10"][width="24"][height="18"][opacity="0.25"]'
        );
        expect(shadow).not.toBeNull();
        expect(shadow.getAttribute('fill')).toBe('#6B3E1F');
    });

    it('should render the lid edge/lip rect', () => {
        const { container } = renderChest();
        const lidEdge = container.querySelector(
            'rect[x="5"][y="8"][width="26"][height="20"]'
        );
        expect(lidEdge).not.toBeNull();
        expect(lidEdge.getAttribute('fill')).toBe('#6B3E1F');
    });

    it('should render the main chest body rect', () => {
        const { container } = renderChest();
        const body = container.querySelector(
            'rect[x="6"][y="9"][width="24"][height="18"]'
        );
        expect(body).not.toBeNull();
        expect(body.getAttribute('fill')).toBe('#A0703C');
        expect(body.getAttribute('stroke')).toBe('#8B5E3C');
        expect(body.getAttribute('stroke-width')).toBe('0.6');
    });

    it('should render the wood grain lines', () => {
        const { container } = renderChest();
        const grainLines = container.querySelectorAll(
            'line[stroke="#7A4E20"][stroke-width="0.3"][opacity="0.25"]'
        );
        expect(grainLines.length).toBe(4);
    });

    it('should render the top metal band rects', () => {
        const { container } = renderChest();
        const topBandDark = container.querySelector(
            'rect[x="6"][y="11"][width="24"][height="1.5"]'
        );
        expect(topBandDark).not.toBeNull();
        expect(topBandDark.getAttribute('fill')).toBe('#555');

        const topBandLight = container.querySelector(
            'rect[x="6"][y="11"][width="24"][height="0.4"]'
        );
        expect(topBandLight).not.toBeNull();
        expect(topBandLight.getAttribute('fill')).toBe('#777');
    });

    it('should render the bottom metal band rects', () => {
        const { container } = renderChest();
        const bottomBandDark = container.querySelector(
            'rect[x="6"][y="24"][width="24"][height="1.5"]'
        );
        expect(bottomBandDark).not.toBeNull();
        expect(bottomBandDark.getAttribute('fill')).toBe('#555');

        const bottomBandLight = container.querySelector(
            'rect[x="6"][y="24"][width="24"][height="0.4"]'
        );
        expect(bottomBandLight).not.toBeNull();
        expect(bottomBandLight.getAttribute('fill')).toBe('#777');
    });

    it('should render the top nail heads', () => {
        const { container } = renderChest();
        const nailHeads = container.querySelectorAll(
            'circle[fill="#888"][r="0.7"]'
        );
        expect(nailHeads.length).toBeGreaterThan(0);
    });

    it('should render the lock/keyhole circle', () => {
        const { container } = renderChest();
        const lock = container.querySelector(
            'circle[cx="18"][cy="21"][r="2.5"]'
        );
        expect(lock).not.toBeNull();
        expect(lock.getAttribute('fill')).toBe('#D4A017');
        expect(lock.getAttribute('stroke')).toBe('#B8860B');
        expect(lock.getAttribute('stroke-width')).toBe('0.4');
    });

    it('should render the keyhole rect', () => {
        const { container } = renderChest();
        const keyhole = container.querySelector(
            'rect[x="17.5"][y="21.5"][width="1"][height="2.5"]'
        );
        expect(keyhole).not.toBeNull();
        expect(keyhole.getAttribute('fill')).toBe('#333');
    });

    it('should render the hinges', () => {
        const { container } = renderChest();
        const hinges = container.querySelectorAll(
            'rect[fill="#666"][stroke="#555"]'
        );
        expect(hinges.length).toBe(2);
    });

    it('should render the edge shadows', () => {
        const { container } = renderChest();
        const rightShadow = container.querySelector(
            'rect[x="28"][y="9"][width="2"][height="18"]'
        );
        expect(rightShadow).not.toBeNull();
        expect(rightShadow.getAttribute('fill')).toBe('#6B3E1F');
        expect(rightShadow.getAttribute('opacity')).toBe('0.15');

        const bottomShadow = container.querySelector(
            'rect[x="6"][y="25"][width="24"][height="2"]'
        );
        expect(bottomShadow).not.toBeNull();
        expect(bottomShadow.getAttribute('fill')).toBe('#6B3E1F');
        expect(bottomShadow.getAttribute('opacity')).toBe('0.15');
    });

    it('should render total rect count (12 rects)', () => {
        const { container } = renderChest();
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(12);
    });

    it('should render total line count (4 wood grain lines)', () => {
        const { container } = renderChest();
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(4);
    });

    it('should render total circle count (9 circles)', () => {
        const { container } = renderChest();
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(9);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderChest({ 'data-test': 'chest' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('chest');
    });
});
