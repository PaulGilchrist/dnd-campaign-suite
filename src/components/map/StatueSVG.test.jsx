import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StatueSVG from './StatueSVG.jsx';

const renderStatue = (props = {}) =>
    render(
        <svg>
            <StatueSVG {...props} />
        </svg>
    );

describe('StatueSVG', () => {
    it('should render the root <g> element', () => {
        const { container } = renderStatue();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderStatue({ id: 'statue-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('statue-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderStatue({ className: 'statue-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('statue-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(StatueSVG.displayName).toBe('StatueSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderStatue({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the floor shadow rect', () => {
        const { container } = renderStatue();
        const shadow = container.querySelector(
            'rect[fill="#555"][opacity="0.15"]'
        );
        expect(shadow).not.toBeNull();
        expect(shadow.getAttribute('x')).toBe('5');
        expect(shadow.getAttribute('y')).toBe('5');
        expect(shadow.getAttribute('width')).toBe('28');
        expect(shadow.getAttribute('height')).toBe('28');
    });

    it('should render the outer plinth base rect', () => {
        const { container } = renderStatue();
        const base = container.querySelector(
            'rect[fill="#888"][stroke="#666"]'
        );
        expect(base).not.toBeNull();
        expect(base.getAttribute('x')).toBe('4');
        expect(base.getAttribute('y')).toBe('4');
        expect(base.getAttribute('width')).toBe('28');
        expect(base.getAttribute('height')).toBe('28');
        expect(base.getAttribute('stroke-width')).toBe('0.8');
    });

    it('should render the base highlight rects', () => {
        const { container } = renderStatue();
        const topHighlight = container.querySelector(
            'rect[fill="#AAA"][opacity="0.3"]'
        );
        expect(topHighlight).not.toBeNull();
        expect(topHighlight.getAttribute('x')).toBe('4');
        expect(topHighlight.getAttribute('y')).toBe('4');
        expect(topHighlight.getAttribute('width')).toBe('28');
        expect(topHighlight.getAttribute('height')).toBe('1.5');

        const leftHighlight = container.querySelectorAll(
            'rect[fill="#AAA"][opacity="0.3"]'
        );
        expect(leftHighlight.length).toBe(2);
    });

    it('should render the base shadow rects', () => {
        const { container } = renderStatue();
        const shadows = container.querySelectorAll(
            'rect[fill="#555"][opacity="0.3"]'
        );
        expect(shadows.length).toBe(2);
        expect(shadows[0].getAttribute('x')).toBe('4');
        expect(shadows[0].getAttribute('y')).toBe('30');
        expect(shadows[1].getAttribute('x')).toBe('30');
        expect(shadows[1].getAttribute('y')).toBe('4');
    });

    it('should render the middle tier rect', () => {
        const { container } = renderStatue();
        const middle = container.querySelector(
            'rect[fill="#999"][stroke="#777"]'
        );
        expect(middle).not.toBeNull();
        expect(middle.getAttribute('x')).toBe('9');
        expect(middle.getAttribute('y')).toBe('9');
        expect(middle.getAttribute('width')).toBe('18');
        expect(middle.getAttribute('height')).toBe('18');
        expect(middle.getAttribute('stroke-width')).toBe('0.6');
    });

    it('should render the middle tier highlight rects', () => {
        const { container } = renderStatue();
        const highlights = container.querySelectorAll(
            'rect[fill="#BBB"][opacity="0.3"]'
        );
        expect(highlights.length).toBe(2);
        expect(highlights[0].getAttribute('width')).toBe('18');
        expect(highlights[0].getAttribute('height')).toBe('1');
        expect(highlights[1].getAttribute('width')).toBe('1');
        expect(highlights[1].getAttribute('height')).toBe('18');
    });

    it('should render the middle tier shadow rects', () => {
        const { container } = renderStatue();
        const shadows = container.querySelectorAll(
            'rect[fill="#555"][opacity="0.25"]'
        );
        expect(shadows.length).toBe(2);
    });

    it('should render the top tier / pedestal rect', () => {
        const { container } = renderStatue();
        const top = container.querySelector(
            'rect[fill="#AAA"][stroke="#888"]'
        );
        expect(top).not.toBeNull();
        expect(top.getAttribute('x')).toBe('13');
        expect(top.getAttribute('y')).toBe('13');
        expect(top.getAttribute('width')).toBe('10');
        expect(top.getAttribute('height')).toBe('10');
        expect(top.getAttribute('stroke-width')).toBe('0.5');
    });

    it('should render the top tier highlight rects', () => {
        const { container } = renderStatue();
        const highlights = container.querySelectorAll(
            'rect[fill="#CCC"][opacity="0.3"]'
        );
        expect(highlights.length).toBe(2);
    });

    it('should render the top tier shadow rects', () => {
        const { container } = renderStatue();
        const shadows = container.querySelectorAll(
            'rect[fill="#777"][opacity="0.25"]'
        );
        expect(shadows.length).toBe(2);
    });

    it('should render the statue figure path (4-point star/cross)', () => {
        const { container } = renderStatue();
        const figure = container.querySelector(
            'path[d="M 17 14 L 19 14 L 19 16 L 22 16 L 22 18 L 19 18 L 19 20 L 17 20 L 17 18 L 14 18 L 14 16 L 17 16 Z"]'
        );
        expect(figure).not.toBeNull();
        expect(figure.getAttribute('fill')).toBe('#999');
        expect(figure.getAttribute('stroke')).toBe('#777');
        expect(figure.getAttribute('stroke-width')).toBe('0.4');
    });

    it('should render the statue head circle', () => {
        const { container } = renderStatue();
        const head = container.querySelector('circle[cx="18"][cy="14"][r="1.5"]');
        expect(head).not.toBeNull();
        expect(head.getAttribute('fill')).toBe('#AAA');
        expect(head.getAttribute('stroke')).toBe('#888');
        expect(head.getAttribute('stroke-width')).toBe('0.3');
    });

    it('should render total rect count (16 rects)', () => {
        const { container } = renderStatue();
        const rects = container.querySelectorAll('rect');
        // 1 floor shadow + 1 outer plinth + 2 base highlights + 2 base shadows +
        // 1 middle tier + 2 middle highlights + 2 middle shadows +
        // 1 top tier + 2 top highlights + 2 top shadows = 16
        expect(rects.length).toBe(16);
    });

    it('should render total path count (1 path)', () => {
        const { container } = renderStatue();
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(1);
    });

    it('should render total circle count (1 circle)', () => {
        const { container } = renderStatue();
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(1);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderStatue({ 'data-test': 'statue' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('statue');
    });
});
