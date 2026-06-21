// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StairsSVG from './StairsSVG.jsx';

const renderStairs = (props = {}) =>
    render(
        <svg>
            <StairsSVG {...props} />
        </svg>
    );

describe('StairsSVG', () => {
    describe('root <g> element', () => {
        it('should render the root <g> element', () => {
            const { container } = renderStairs();
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toBeInTheDocument();
        });

        it('should apply the given id to the root group', () => {
            const { container } = renderStairs({ id: 'stairs-svg-1' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('id', 'stairs-svg-1');
        });

        it('should apply the given className to the root group', () => {
            const { container } = renderStairs({ className: 'stairs-custom' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveClass('stairs-custom');
        });

        it('should pass through rest props to the root group', () => {
            const { container } = renderStairs({ 'data-test': 'stairs' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('data-test', 'stairs');
        });
    });

    describe('component metadata', () => {
        it('should render with displayName', () => {
            expect(StairsSVG.displayName).toBe('StairsSVG');
        });

        it('should render as a forwardRef component', () => {
            const ref = vi.fn();
            renderStairs({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('stairwell frame', () => {
        it('should render the stairwell frame rect', () => {
            const { container } = renderStairs();
            const frameRect = container.querySelector('rect');
            expect(frameRect).toBeInTheDocument();
            expect(frameRect).toHaveAttribute('x', '2');
            expect(frameRect).toHaveAttribute('y', '2');
            expect(frameRect).toHaveAttribute('width', '32');
            expect(frameRect).toHaveAttribute('height', '32');
            expect(frameRect).toHaveAttribute('fill', 'none');
            expect(frameRect).toHaveAttribute('stroke', '#8B5A2B');
            expect(frameRect).toHaveAttribute('stroke-width', '1.5');
        });
    });

    describe('step lines', () => {
        it('should render step lines with correct stroke', () => {
            const { container } = renderStairs();
            const stepLines = container.querySelectorAll(
                'line[stroke="#8B5A2B"][stroke-width="1"]'
            );
            expect(stepLines.length).toBeGreaterThan(0);
        });

        it('should render step lines at y=8, y=14, y=20, and y=26', () => {
            const { container } = renderStairs();
            const stepLine8 = container.querySelector('line[y1="8"]');
            const stepLine14 = container.querySelector('line[y1="14"]');
            const stepLine20 = container.querySelector('line[y1="20"]');
            const stepLine26 = container.querySelector('line[y1="26"]');
            expect(stepLine8).toBeInTheDocument();
            expect(stepLine14).toBeInTheDocument();
            expect(stepLine20).toBeInTheDocument();
            expect(stepLine26).toBeInTheDocument();
        });
    });

    describe('down arrow', () => {
        it('should render the down arrow shaft line', () => {
            const { container } = renderStairs();
            const shaftLine = container.querySelector('line[x1="18"][y1="8"][x2="18"][y2="26"]');
            expect(shaftLine).toBeInTheDocument();
            expect(shaftLine).toHaveAttribute('stroke', '#8B1A1A');
            expect(shaftLine).toHaveAttribute('stroke-width', '1.5');
        });

        it('should render the down arrow head polygon', () => {
            const { container } = renderStairs();
            const arrowHead = container.querySelector('polygon');
            expect(arrowHead).toBeInTheDocument();
            expect(arrowHead).toHaveAttribute('fill', '#8B1A1A');
        });
    });

    describe('element counts', () => {
        it('should render total line count greater than 4', () => {
            const { container } = renderStairs();
            const lines = container.querySelectorAll('line');
            expect(lines.length).toBeGreaterThanOrEqual(5);
        });

        it('should render at least 1 rect', () => {
            const { container } = renderStairs();
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBeGreaterThanOrEqual(1);
        });

        it('should render at least 1 polygon', () => {
            const { container } = renderStairs();
            const polygons = container.querySelectorAll('polygon');
            expect(polygons.length).toBeGreaterThanOrEqual(1);
        });
    });
});