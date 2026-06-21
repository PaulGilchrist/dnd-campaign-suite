// @improved-by-ai
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
    describe('root element', () => {
        it('should render the root <g> element', () => {
            const { container } = renderChest();
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('should apply the given id to the root group', () => {
            const { container } = renderChest({ id: 'chest-svg-1' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('id', 'chest-svg-1');
        });

        it('should apply the given className to the root group', () => {
            const { container } = renderChest({ className: 'chest-custom' });
            expect(container.querySelector('g')).toHaveClass('chest-custom');
        });

        it('should pass through rest props to the root group', () => {
            const { container } = renderChest({ 'data-test': 'chest' });
            expect(container.querySelector('g')).toHaveAttribute('data-test', 'chest');
        });
    });

    describe('component config', () => {
        it('should render with displayName', () => {
            expect(ChestSVG.displayName).toBe('ChestSVG');
        });

        it('should render as a forwardRef component', () => {
            const ref = vi.fn();
            renderChest({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('chest anatomy', () => {
        it('should render the floor shadow rect', () => {
            const { container } = renderChest();
            const shadow = container.querySelector('rect[x="7"][y="10"][width="24"][height="18"]');
            expect(shadow).toBeInTheDocument();
            expect(shadow).toHaveAttribute('fill', '#6B3E1F');
            expect(shadow).toHaveAttribute('opacity', '0.25');
        });

        it('should render the lid edge/lip rect', () => {
            const { container } = renderChest();
            const lidEdge = container.querySelector('rect[x="5"][y="8"][width="26"][height="20"]');
            expect(lidEdge).toBeInTheDocument();
            expect(lidEdge).toHaveAttribute('fill', '#6B3E1F');
        });

        it('should render the main chest body rect with correct styling', () => {
            const { container } = renderChest();
            const body = container.querySelector('rect[x="6"][y="9"][width="24"][height="18"]');
            expect(body).toBeInTheDocument();
            expect(body).toHaveAttribute('fill', '#A0703C');
            expect(body).toHaveAttribute('stroke', '#8B5E3C');
            expect(body).toHaveAttribute('stroke-width', '0.6');
        });

        it('should render wood grain lines', () => {
            const { container } = renderChest();
            const grainLines = container.querySelectorAll(
                'line[stroke="#7A4E20"][stroke-width="0.3"][opacity="0.25"]'
            );
            expect(grainLines.length).toBeGreaterThan(0);
        });

        it('should render the top metal band rects', () => {
            const { container } = renderChest();
            const topBandDark = container.querySelector(
                'rect[x="6"][y="11"][width="24"][height="1.5"]'
            );
            expect(topBandDark).toBeInTheDocument();
            expect(topBandDark).toHaveAttribute('fill', '#555');

            const topBandLight = container.querySelector(
                'rect[x="6"][y="11"][width="24"][height="0.4"]'
            );
            expect(topBandLight).toBeInTheDocument();
            expect(topBandLight).toHaveAttribute('fill', '#777');
        });

        it('should render the bottom metal band rects', () => {
            const { container } = renderChest();
            const bottomBandDark = container.querySelector(
                'rect[x="6"][y="24"][width="24"][height="1.5"]'
            );
            expect(bottomBandDark).toBeInTheDocument();
            expect(bottomBandDark).toHaveAttribute('fill', '#555');

            const bottomBandLight = container.querySelector(
                'rect[x="6"][y="24"][width="24"][height="0.4"]'
            );
            expect(bottomBandLight).toBeInTheDocument();
            expect(bottomBandLight).toHaveAttribute('fill', '#777');
        });

        it('should render nail heads', () => {
            const { container } = renderChest();
            const nailHeads = container.querySelectorAll('circle[fill="#888"][r="0.7"]');
            expect(nailHeads.length).toBeGreaterThanOrEqual(8);
        });

        it('should render the lock/keyhole circle', () => {
            const { container } = renderChest();
            const lock = container.querySelector(
                'circle[cx="18"][cy="21"][r="2.5"]'
            );
            expect(lock).toBeInTheDocument();
            expect(lock).toHaveAttribute('fill', '#D4A017');
            expect(lock).toHaveAttribute('stroke', '#B8860B');
            expect(lock).toHaveAttribute('stroke-width', '0.4');
        });

        it('should render the keyhole rect', () => {
            const { container } = renderChest();
            const keyhole = container.querySelector(
                'rect[x="17.5"][y="21.5"][width="1"][height="2.5"]'
            );
            expect(keyhole).toBeInTheDocument();
            expect(keyhole).toHaveAttribute('fill', '#333');
        });

        it('should render hinges', () => {
            const { container } = renderChest();
            const hinges = container.querySelectorAll(
                'rect[fill="#666"][stroke="#555"]'
            );
            expect(hinges.length).toBeGreaterThanOrEqual(2);
        });

        it('should render edge shadows', () => {
            const { container } = renderChest();
            const rightShadow = container.querySelector(
                'rect[x="28"][y="9"][width="2"][height="18"]'
            );
            expect(rightShadow).toBeInTheDocument();
            expect(rightShadow).toHaveAttribute('fill', '#6B3E1F');
            expect(rightShadow).toHaveAttribute('opacity', '0.15');

            const bottomShadow = container.querySelector(
                'rect[x="6"][y="25"][width="24"][height="2"]'
            );
            expect(bottomShadow).toBeInTheDocument();
            expect(bottomShadow).toHaveAttribute('fill', '#6B3E1F');
            expect(bottomShadow).toHaveAttribute('opacity', '0.15');
        });
    });

    describe('element counts', () => {
        it('should render rects', () => {
            const { container } = renderChest();
            expect(container.querySelectorAll('rect').length).toBeGreaterThanOrEqual(12);
        });

        it('should render wood grain line elements', () => {
            const { container } = renderChest();
            expect(container.querySelectorAll('line').length).toBeGreaterThanOrEqual(4);
        });

        it('should render circle elements', () => {
            const { container } = renderChest();
            expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(9);
        });
    });
});