/** @improved-by-ai */
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TrapSVG from './TrapSVG.jsx';

const renderTrap = (props = {}) =>
    render(
        <svg>
            <TrapSVG {...props} />
        </svg>
    );

describe('TrapSVG', () => {
    describe('root group element', () => {
        it('should render the root <g> element', () => {
            const { container } = renderTrap();
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('should apply the given id to the root group', () => {
            const { container } = renderTrap({ id: 'trap-svg-1' });
            expect(container.querySelector('g')).toHaveAttribute('id', 'trap-svg-1');
        });

        it('should apply the given className to the root group', () => {
            const { container } = renderTrap({ className: 'trap-custom' });
            expect(container.querySelector('g')).toHaveClass('trap-custom');
        });

        it('should pass through rest props to the root group', () => {
            const { container } = renderTrap({ 'data-test': 'trap' });
            expect(container.querySelector('g')).toHaveAttribute('data-test', 'trap');
        });
    });

    describe('display name and forwardRef', () => {
        it('should render with displayName', () => {
            expect(TrapSVG.displayName).toBe('TrapSVG');
        });

        it('should render as a forwardRef component', () => {
            const ref = vi.fn();
            renderTrap({ ref });
            expect(ref).toHaveBeenCalled();
        });
    });

    describe('border rect', () => {
        it('should render the border rect with correct attributes', () => {
            const { container } = renderTrap();
            expect(container.querySelector('rect')).toBeInTheDocument();
        });

        it('should render the border rect with correct fill, stroke and strokeWidth', () => {
            const { container } = renderTrap();
            const borderRect = container.querySelector('rect');
            expect(borderRect).toHaveAttribute('fill', 'none');
            expect(borderRect).toHaveAttribute('stroke', '#8B1A1A');
            expect(borderRect).toHaveAttribute('stroke-width', '2');
        });
    });

    describe('diagonal lines', () => {
        it('should render the top-left to bottom-right diagonal line', () => {
            const { container } = renderTrap();
            const diagonal = container.querySelector('line[x1="4"][y1="4"][x2="32"][y2="32"]');
            expect(diagonal).toBeInTheDocument();
            expect(diagonal).toHaveAttribute('stroke', '#8B1A1A');
            expect(diagonal).toHaveAttribute('stroke-width', '2.5');
        });

        it('should render the top-right to bottom-left diagonal line', () => {
            const { container } = renderTrap();
            const diagonal = container.querySelector('line[x1="32"][y1="4"][x2="4"][y2="32"]');
            expect(diagonal).toBeInTheDocument();
            expect(diagonal).toHaveAttribute('stroke', '#8B1A1A');
            expect(diagonal).toHaveAttribute('stroke-width', '2.5');
        });
    });

    describe('element counts', () => {
        it('should render at least 1 rect element', () => {
            const { container } = renderTrap();
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBeGreaterThanOrEqual(1);
        });

        it('should render at least 2 line elements', () => {
            const { container } = renderTrap();
            const lines = container.querySelectorAll('line');
            expect(lines.length).toBeGreaterThanOrEqual(2);
        });
    });
});
