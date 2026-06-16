import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CrateSVG from './CrateSVG.jsx';

const renderCrate = (props = {}) =>
    render(
        <svg>
            <CrateSVG {...props} />
        </svg>
    );

describe('CrateSVG', () => {
    it('should render the root <g> element', () => {
        const { container } = renderCrate();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderCrate({ id: 'crate-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('crate-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderCrate({ className: 'crate-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('crate-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(CrateSVG.displayName).toBe('CrateSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderCrate({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the floor shadow rect', () => {
        const { container } = renderCrate();
        const shadow = container.querySelector(
            'rect[x="5"][y="5"][width="28"][height="28"][fill="#7A5E30"]'
        );
        expect(shadow).not.toBeNull();
        expect(shadow.getAttribute('opacity')).toBe('0.2');
    });

    it('should render the main crate body rect', () => {
        const { container } = renderCrate();
        const body = container.querySelector(
            'rect[x="4"][y="4"][width="28"][height="28"][fill="#C4A265"]'
        );
        expect(body).not.toBeNull();
        expect(body.getAttribute('stroke')).toBe('#7A5E30');
        expect(body.getAttribute('stroke-width')).toBe('0.8');
    });

    it('should render the plank gap rects', () => {
        const { container } = renderCrate();
        const gaps = container.querySelectorAll(
            'rect[fill="#7A5E30"][height="1"]'
        );
        expect(gaps.length).toBe(4);
    });

    it('should render plank gap at y=9', () => {
        const { container } = renderCrate();
        const gap = container.querySelector('rect[x="4"][y="9"][width="28"][height="1"]');
        expect(gap).not.toBeNull();
        expect(gap.getAttribute('fill')).toBe('#7A5E30');
    });

    it('should render plank gap at y=14', () => {
        const { container } = renderCrate();
        const gap = container.querySelector('rect[x="4"][y="14"][width="28"][height="1"]');
        expect(gap).not.toBeNull();
    });

    it('should render plank gap at y=19', () => {
        const { container } = renderCrate();
        const gap = container.querySelector('rect[x="4"][y="19"][width="28"][height="1"]');
        expect(gap).not.toBeNull();
    });

    it('should render plank gap at y=24', () => {
        const { container } = renderCrate();
        const gap = container.querySelector('rect[x="4"][y="24"][width="28"][height="1"]');
        expect(gap).not.toBeNull();
    });

    it('should render the top plank rects', () => {
        const { container } = renderCrate();
        const planks = container.querySelectorAll(
            'rect[fill="#B8935A"][stroke="#7A5E30"]'
        );
        expect(planks.length).toBe(5);
    });

    it('should render plank at y=5', () => {
        const { container } = renderCrate();
        const plank = container.querySelector('rect[x="4"][y="5"][width="28"][height="4"]');
        expect(plank).not.toBeNull();
        expect(plank.getAttribute('fill')).toBe('#B8935A');
        expect(plank.getAttribute('stroke')).toBe('#7A5E30');
        expect(plank.getAttribute('stroke-width')).toBe('0.3');
    });

    it('should render wood grain lines on planks', () => {
        const { container } = renderCrate();
        const grainLines = container.querySelectorAll(
            'line[stroke="#7A5E30"][stroke-width="0.2"][opacity="0.25"]'
        );
        expect(grainLines.length).toBe(5);
    });

    it('should render wood grain lines at correct y positions', () => {
        const { container } = renderCrate();
        const grainLine = container.querySelector('line[x1="4"][y1="7"][x2="32"][y2="7"]');
        expect(grainLine).not.toBeNull();
    });

    it('should render the cross-bracing X pattern lines', () => {
        const { container } = renderCrate();
        // Diagonal top-left to bottom-right
        const diag1 = container.querySelector(
            'line[x1="5"][y1="5"][x2="31"][y2="31"][stroke-width="1.8"]'
        );
        expect(diag1).not.toBeNull();

        // Diagonal top-right to bottom-left
        const diag2 = container.querySelector(
            'line[x1="31"][y1="5"][x2="5"][y2="31"][stroke-width="1.8"]'
        );
        expect(diag2).not.toBeNull();
    });

    it('should render the cross-bracing highlight lines', () => {
        const { container } = renderCrate();
        const highlights = container.querySelectorAll(
            'line[stroke="#9A7A40"][stroke-width="0.6"]'
        );
        expect(highlights.length).toBe(2);
    });

    it('should render the nail heads on plank ends', () => {
        const { container } = renderCrate();
        const nails = container.querySelectorAll(
            'circle[fill="#555"][r="0.8"]'
        );
        expect(nails.length).toBe(11);
    });

    it('should render plank 1 nail heads', () => {
        const { container } = renderCrate();
        const nail1 = container.querySelector('circle[cx="6"][cy="7"][r="0.8"]');
        expect(nail1).not.toBeNull();
        expect(nail1.getAttribute('fill')).toBe('#555');

        const nail2 = container.querySelector('circle[cx="30"][cy="7"][r="0.8"]');
        expect(nail2).not.toBeNull();
    });

    it('should render plank 2 nail heads', () => {
        const { container } = renderCrate();
        const nail1 = container.querySelector('circle[cx="6"][cy="12"][r="0.8"]');
        expect(nail1).not.toBeNull();

        const nail2 = container.querySelector('circle[cx="30"][cy="12"][r="0.8"]');
        expect(nail2).not.toBeNull();
    });

    it('should render plank 3 nail heads', () => {
        const { container } = renderCrate();
        const nail1 = container.querySelector('circle[cx="6"][cy="17"][r="0.8"]');
        expect(nail1).not.toBeNull();

        const nail2 = container.querySelector('circle[cx="30"][cy="17"][r="0.8"]');
        expect(nail2).not.toBeNull();
    });

    it('should render plank 4 nail heads', () => {
        const { container } = renderCrate();
        const nail1 = container.querySelector('circle[cx="6"][cy="22"][r="0.8"]');
        expect(nail1).not.toBeNull();

        const nail2 = container.querySelector('circle[cx="30"][cy="22"][r="0.8"]');
        expect(nail2).not.toBeNull();
    });

    it('should render plank 5 nail heads', () => {
        const { container } = renderCrate();
        const nail1 = container.querySelector('circle[cx="6"][cy="27"][r="0.8"]');
        expect(nail1).not.toBeNull();

        const nail2 = container.querySelector('circle[cx="30"][cy="27"][r="0.8"]');
        expect(nail2).not.toBeNull();
    });

    it('should render the center cross-brace intersection nail', () => {
        const { container } = renderCrate();
        const centerNail = container.querySelector('circle[cx="18"][cy="18"][r="0.8"]');
        expect(centerNail).not.toBeNull();
        expect(centerNail.getAttribute('fill')).toBe('#555');
    });

    it('should render the bottom and right edge shadow rects', () => {
        const { container } = renderCrate();
        const rightShadow = container.querySelector(
            'rect[x="30"][y="4"][width="2"][height="28"][fill="#7A5E30"]'
        );
        expect(rightShadow).not.toBeNull();
        expect(rightShadow.getAttribute('opacity')).toBe('0.15');

        const bottomShadow = container.querySelector(
            'rect[x="4"][y="30"][width="28"][height="2"][fill="#7A5E30"]'
        );
        expect(bottomShadow).not.toBeNull();
        expect(bottomShadow.getAttribute('opacity')).toBe('0.15');
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderCrate({ 'data-test': 'crate' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('crate');
    });

    it('should render total rect count (floor shadow + body + 4 plank gaps + 5 planks + 2 edge shadows = 13)', () => {
        const { container } = renderCrate();
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(13);
    });

    it('should render total line count (5 grain lines + 4 cross-brace lines = 9)', () => {
        const { container } = renderCrate();
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(9);
    });

    it('should render total circle count (10 plank end nails + 1 center nail = 11)', () => {
        const { container } = renderCrate();
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(11);
    });
});
