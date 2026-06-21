// @improved-by-ai
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
    describe('root element', () => {
        it('renders the root <g> element', () => {
            const { container } = renderStatue();
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toBeInTheDocument();
        });

        it('applies the given id to the root group', () => {
            const { container } = renderStatue({ id: 'statue-svg-1' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('id', 'statue-svg-1');
        });

        it('applies the given className to the root group', () => {
            const { container } = renderStatue({ className: 'statue-custom' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveClass('statue-custom');
        });

        it('passes through rest props to the root group', () => {
            const { container } = renderStatue({ 'data-test': 'statue' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('data-test', 'statue');
        });

        it('renders as a forwardRef component', () => {
            const ref = vi.fn();
            renderStatue({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('display name', () => {
        it('has correct displayName', () => {
            expect(StatueSVG.displayName).toBe('StatueSVG');
        });
    });

    describe('floor shadow', () => {
        it('renders the floor shadow rect', () => {
            const { container } = renderStatue();
            const shadow = container.querySelector(
                'rect[fill="#555"][opacity="0.15"]'
            );
            expect(shadow).toBeInTheDocument();
            expect(shadow).toHaveAttribute('x', '5');
            expect(shadow).toHaveAttribute('y', '5');
            expect(shadow).toHaveAttribute('width', '28');
            expect(shadow).toHaveAttribute('height', '28');
        });
    });

    describe('outer plinth base', () => {
        it('renders the outer plinth base rect', () => {
            const { container } = renderStatue();
            const base = container.querySelector(
                'rect[fill="#888"][stroke="#666"]'
            );
            expect(base).toBeInTheDocument();
            expect(base).toHaveAttribute('x', '4');
            expect(base).toHaveAttribute('y', '4');
            expect(base).toHaveAttribute('width', '28');
            expect(base).toHaveAttribute('height', '28');
            expect(base).toHaveAttribute('stroke-width', '0.8');
        });
    });

    describe('base highlights', () => {
        it('renders base highlight rects', () => {
            const { container } = renderStatue();
            const highlights = container.querySelectorAll(
                'rect[fill="#AAA"][opacity="0.3"]'
            );
            expect(highlights.length).toBeGreaterThan(0);
        });
    });

    describe('base shadows', () => {
        it('renders base shadow rects', () => {
            const { container } = renderStatue();
            const shadows = container.querySelectorAll(
                'rect[fill="#555"][opacity="0.3"]'
            );
            expect(shadows.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('middle tier', () => {
        it('renders the middle tier rect', () => {
            const { container } = renderStatue();
            const middle = container.querySelector(
                'rect[fill="#999"][stroke="#777"]'
            );
            expect(middle).toBeInTheDocument();
            expect(middle).toHaveAttribute('x', '9');
            expect(middle).toHaveAttribute('y', '9');
            expect(middle).toHaveAttribute('width', '18');
            expect(middle).toHaveAttribute('height', '18');
            expect(middle).toHaveAttribute('stroke-width', '0.6');
        });

        it('renders middle tier highlight rects', () => {
            const { container } = renderStatue();
            const highlights = container.querySelectorAll(
                'rect[fill="#BBB"][opacity="0.3"]'
            );
            expect(highlights.length).toBeGreaterThanOrEqual(2);
        });

        it('renders middle tier shadow rects', () => {
            const { container } = renderStatue();
            const shadows = container.querySelectorAll(
                'rect[fill="#555"][opacity="0.25"]'
            );
            expect(shadows.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('top tier', () => {
        it('renders the top tier / pedestal rect', () => {
            const { container } = renderStatue();
            const top = container.querySelector(
                'rect[fill="#AAA"][stroke="#888"]'
            );
            expect(top).toBeInTheDocument();
            expect(top).toHaveAttribute('x', '13');
            expect(top).toHaveAttribute('y', '13');
            expect(top).toHaveAttribute('width', '10');
            expect(top).toHaveAttribute('height', '10');
            expect(top).toHaveAttribute('stroke-width', '0.5');
        });

        it('renders top tier highlight rects', () => {
            const { container } = renderStatue();
            const highlights = container.querySelectorAll(
                'rect[fill="#CCC"][opacity="0.3"]'
            );
            expect(highlights.length).toBeGreaterThanOrEqual(2);
        });

        it('renders top tier shadow rects', () => {
            const { container } = renderStatue();
            const shadows = container.querySelectorAll(
                'rect[fill="#777"][opacity="0.25"]'
            );
            expect(shadows.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('statue figure', () => {
        it('renders the statue figure path (4-point star/cross)', () => {
            const { container } = renderStatue();
            const figure = container.querySelector(
                'path[d="M 17 14 L 19 14 L 19 16 L 22 16 L 22 18 L 19 18 L 19 20 L 17 20 L 17 18 L 14 18 L 14 16 L 17 16 Z"]'
            );
            expect(figure).toBeInTheDocument();
            expect(figure).toHaveAttribute('fill', '#999');
            expect(figure).toHaveAttribute('stroke', '#777');
            expect(figure).toHaveAttribute('stroke-width', '0.4');
        });

        it('renders the statue head circle', () => {
            const { container } = renderStatue();
            const head = container.querySelector('circle[cx="18"][cy="14"][r="1.5"]');
            expect(head).toBeInTheDocument();
            expect(head).toHaveAttribute('fill', '#AAA');
            expect(head).toHaveAttribute('stroke', '#888');
            expect(head).toHaveAttribute('stroke-width', '0.3');
        });
    });

    describe('element counts', () => {
        it('renders rect elements', () => {
            const { container } = renderStatue();
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBeGreaterThan(0);
        });

        it('renders path elements', () => {
            const { container } = renderStatue();
            const paths = container.querySelectorAll('path');
            expect(paths.length).toBeGreaterThanOrEqual(1);
        });

        it('renders circle elements', () => {
            const { container } = renderStatue();
            const circles = container.querySelectorAll('circle');
            expect(circles.length).toBeGreaterThanOrEqual(1);
        });
    });
});