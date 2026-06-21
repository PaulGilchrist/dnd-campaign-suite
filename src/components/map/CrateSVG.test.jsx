// @improved-by-ai
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
    describe('root group', () => {
        it('should render the root <g> element', () => {
            const { container } = renderCrate();
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('should apply the given id to the root group', () => {
            const { container } = renderCrate({ id: 'crate-svg-1' });
            expect(container.querySelector('g')).toHaveAttribute('id', 'crate-svg-1');
        });

        it('should apply the given className to the root group', () => {
            const { container } = renderCrate({ className: 'crate-custom' });
            expect(container.querySelector('g')).toHaveClass('crate-custom');
        });

        it('should pass through rest props to the root group', () => {
            const { container } = renderCrate({ 'data-test': 'crate' });
            expect(container.querySelector('g')).toHaveAttribute('data-test', 'crate');
        });

        it('should render as a forwardRef component', () => {
            const ref = vi.fn();
            renderCrate({ ref });
            expect(ref).toHaveBeenCalled();
        });

        it('should render with displayName', () => {
            expect(CrateSVG.displayName).toBe('CrateSVG');
        });
    });

    describe('floor shadow', () => {
        it('should render the floor shadow rect with correct attributes', () => {
            const { container } = renderCrate();
            const shadow = container.querySelector(
                'rect[x="5"][y="5"][width="28"][height="28"][fill="#7A5E30"]'
            );
            expect(shadow).toBeInTheDocument();
            expect(shadow).toHaveAttribute('opacity', '0.2');
        });
    });

    describe('main crate body', () => {
        it('should render the main crate body rect with correct attributes', () => {
            const { container } = renderCrate();
            const body = container.querySelector(
                'rect[x="4"][y="4"][width="28"][height="28"][fill="#C4A265"]'
            );
            expect(body).toBeInTheDocument();
            expect(body).toHaveAttribute('stroke', '#7A5E30');
            expect(body).toHaveAttribute('stroke-width', '0.8');
        });
    });

    describe('plank gaps', () => {
        it('should render plank gap rects', () => {
            const { container } = renderCrate();
            const gaps = container.querySelectorAll('rect[fill="#7A5E30"][height="1"]');
            expect(gaps.length).toBeGreaterThan(0);
        });

        it('should render plank gaps at y=9, 14, 19, and 24', () => {
            const { container } = renderCrate();
            expect(container.querySelector('rect[x="4"][y="9"][width="28"][height="1"]')).toBeInTheDocument();
            expect(container.querySelector('rect[x="4"][y="14"][width="28"][height="1"]')).toBeInTheDocument();
            expect(container.querySelector('rect[x="4"][y="19"][width="28"][height="1"]')).toBeInTheDocument();
            expect(container.querySelector('rect[x="4"][y="24"][width="28"][height="1"]')).toBeInTheDocument();
        });
    });

    describe('top planks', () => {
        it('should render top plank rects', () => {
            const { container } = renderCrate();
            const planks = container.querySelectorAll('rect[fill="#B8935A"][stroke="#7A5E30"]');
            expect(planks.length).toBeGreaterThan(0);
        });

        it('should render plank at y=5 with correct attributes', () => {
            const { container } = renderCrate();
            const plank = container.querySelector('rect[x="4"][y="5"][width="28"][height="4"]');
            expect(plank).toBeInTheDocument();
            expect(plank).toHaveAttribute('fill', '#B8935A');
            expect(plank).toHaveAttribute('stroke', '#7A5E30');
            expect(plank).toHaveAttribute('stroke-width', '0.3');
        });
    });

    describe('wood grain lines', () => {
        it('should render wood grain lines', () => {
            const { container } = renderCrate();
            const grainLines = container.querySelectorAll(
                'line[stroke="#7A5E30"][stroke-width="0.2"][opacity="0.25"]'
            );
            expect(grainLines.length).toBeGreaterThan(0);
        });

        it('should render wood grain line at correct y position', () => {
            const { container } = renderCrate();
            const grainLine = container.querySelector('line[x1="4"][y1="7"][x2="32"][y2="7"]');
            expect(grainLine).toBeInTheDocument();
        });
    });

    describe('cross-bracing', () => {
        it('should render the cross-bracing X pattern lines', () => {
            const { container } = renderCrate();
            const diag1 = container.querySelector(
                'line[x1="5"][y1="5"][x2="31"][y2="31"][stroke-width="1.8"]'
            );
            expect(diag1).toBeInTheDocument();

            const diag2 = container.querySelector(
                'line[x1="31"][y1="5"][x2="5"][y2="31"][stroke-width="1.8"]'
            );
            expect(diag2).toBeInTheDocument();
        });

        it('should render the cross-bracing highlight lines', () => {
            const { container } = renderCrate();
            const highlights = container.querySelectorAll(
                'line[stroke="#9A7A40"][stroke-width="0.6"]'
            );
            expect(highlights.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('nail heads', () => {
        it('should render nail heads on plank ends', () => {
            const { container } = renderCrate();
            const nails = container.querySelectorAll('circle[fill="#555"][r="0.8"]');
            expect(nails.length).toBeGreaterThan(0);
        });

        it('should render plank 1 nail heads', () => {
            const { container } = renderCrate();
            const nail1 = container.querySelector('circle[cx="6"][cy="7"][r="0.8"]');
            expect(nail1).toBeInTheDocument();
            expect(nail1).toHaveAttribute('fill', '#555');

            const nail2 = container.querySelector('circle[cx="30"][cy="7"][r="0.8"]');
            expect(nail2).toBeInTheDocument();
        });

        it('should render plank 2 nail heads', () => {
            const { container } = renderCrate();
            const nail1 = container.querySelector('circle[cx="6"][cy="12"][r="0.8"]');
            expect(nail1).toBeInTheDocument();

            const nail2 = container.querySelector('circle[cx="30"][cy="12"][r="0.8"]');
            expect(nail2).toBeInTheDocument();
        });

        it('should render plank 3 nail heads', () => {
            const { container } = renderCrate();
            const nail1 = container.querySelector('circle[cx="6"][cy="17"][r="0.8"]');
            expect(nail1).toBeInTheDocument();

            const nail2 = container.querySelector('circle[cx="30"][cy="17"][r="0.8"]');
            expect(nail2).toBeInTheDocument();
        });

        it('should render plank 4 nail heads', () => {
            const { container } = renderCrate();
            const nail1 = container.querySelector('circle[cx="6"][cy="22"][r="0.8"]');
            expect(nail1).toBeInTheDocument();

            const nail2 = container.querySelector('circle[cx="30"][cy="22"][r="0.8"]');
            expect(nail2).toBeInTheDocument();
        });

        it('should render plank 5 nail heads', () => {
            const { container } = renderCrate();
            const nail1 = container.querySelector('circle[cx="6"][cy="27"][r="0.8"]');
            expect(nail1).toBeInTheDocument();

            const nail2 = container.querySelector('circle[cx="30"][cy="27"][r="0.8"]');
            expect(nail2).toBeInTheDocument();
        });

        it('should render the center cross-brace intersection nail', () => {
            const { container } = renderCrate();
            const centerNail = container.querySelector('circle[cx="18"][cy="18"][r="0.8"]');
            expect(centerNail).toBeInTheDocument();
            expect(centerNail).toHaveAttribute('fill', '#555');
        });
    });

    describe('edge shadows', () => {
        it('should render the bottom and right edge shadow rects', () => {
            const { container } = renderCrate();
            const rightShadow = container.querySelector(
                'rect[x="30"][y="4"][width="2"][height="28"][fill="#7A5E30"]'
            );
            expect(rightShadow).toBeInTheDocument();
            expect(rightShadow).toHaveAttribute('opacity', '0.15');

            const bottomShadow = container.querySelector(
                'rect[x="4"][y="30"][width="28"][height="2"][fill="#7A5E30"]'
            );
            expect(bottomShadow).toBeInTheDocument();
            expect(bottomShadow).toHaveAttribute('opacity', '0.15');
        });
    });

    describe('element counts', () => {
        it('should render rect elements', () => {
            const { container } = renderCrate();
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBeGreaterThanOrEqual(13);
        });

        it('should render line elements', () => {
            const { container } = renderCrate();
            const lines = container.querySelectorAll('line');
            expect(lines.length).toBeGreaterThanOrEqual(9);
        });

        it('should render circle elements', () => {
            const { container } = renderCrate();
            const circles = container.querySelectorAll('circle');
            expect(circles.length).toBeGreaterThanOrEqual(11);
        });
    });
});
