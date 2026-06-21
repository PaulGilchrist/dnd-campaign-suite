// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SecretDoorSVG from './SecretDoorSVG.jsx';

const renderSecretDoor = (props = {}) =>
    render(
        <svg>
            <SecretDoorSVG {...props} />
        </svg>
    );

describe('SecretDoorSVG', () => {
    describe('component properties', () => {
        it('renders as a forwardRef component', () => {
            const ref = vi.fn();
            renderSecretDoor({ ref });
            expect(ref).toHaveBeenCalled();
        });

        it('should render with displayName', () => {
            expect(SecretDoorSVG.displayName).toBe('SecretDoorSVG');
        });
    });

    describe('root <g> element', () => {
        it('renders the root group element', () => {
            const { container } = renderSecretDoor();
            expect(container.querySelector('g')).toBeInTheDocument();
        });

        it('applies the given id to the root group', () => {
            const { container } = renderSecretDoor({ id: 'secret-door-1' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('id', 'secret-door-1');
        });

        it('applies the given className to the root group', () => {
            const { container } = renderSecretDoor({ className: 'secret-door-custom' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveClass('secret-door-custom');
        });

        it('passes through rest props to the root group', () => {
            const { container } = renderSecretDoor({ 'data-test': 'secret-door' });
            const rootGroup = container.querySelector('g');
            expect(rootGroup).toHaveAttribute('data-test', 'secret-door');
        });
    });

    describe('board rect', () => {
        it('renders the main board rect with correct attributes', () => {
            const { container } = renderSecretDoor();
            const boardRect = container.querySelector('rect[x="0"][y="0"][width="36"][height="36"]');
            expect(boardRect).toBeInTheDocument();
            expect(boardRect).toHaveAttribute('fill', '#8B1A1A');
        });

        it('renders the highlight edge rect with correct attributes', () => {
            const { container } = renderSecretDoor();
            const highlightRect = container.querySelector('rect[x="0"][y="0"][width="0.5"][height="36"]');
            expect(highlightRect).toBeInTheDocument();
            expect(highlightRect).toHaveAttribute('fill', '#A02020');
            expect(highlightRect).toHaveAttribute('opacity', '0.6');
        });

        it('renders 2 rects total', () => {
            const { container } = renderSecretDoor();
            expect(container.querySelectorAll('rect').length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('wood grain lines', () => {
        it('renders at least 5 wood grain lines', () => {
            const { container } = renderSecretDoor();
            expect(container.querySelectorAll('line').length).toBeGreaterThan(0);
        });

        it('renders wood grain lines with correct attributes', () => {
            const { container } = renderSecretDoor();
            const lines = container.querySelectorAll('line');
            lines.forEach((line) => {
                expect(line).toHaveAttribute('stroke', '#5C1010');
                expect(line).toHaveAttribute('stroke-width', '0.3');
                expect(line).toHaveAttribute('opacity', '0.5');
            });
        });

        it('renders wood grain lines at correct x positions', () => {
            const { container } = renderSecretDoor();
            const lines = container.querySelectorAll('line');
            const xPositions = Array.from(lines).map((l) => l.getAttribute('x1'));
            expect(xPositions.length).toBeGreaterThanOrEqual(5);
            expect(xPositions).toContain('6');
            expect(xPositions).toContain('12');
            expect(xPositions).toContain('18');
            expect(xPositions).toContain('24');
            expect(xPositions).toContain('30');
        });
    });

    describe('text element', () => {
        it('renders the "S" text element with correct attributes', () => {
            const { container } = renderSecretDoor();
            const textEl = container.querySelector('text');
            expect(textEl).toBeInTheDocument();
            expect(textEl).toHaveTextContent('S');
            expect(textEl).toHaveAttribute('x', '18');
            expect(textEl).toHaveAttribute('y', '18');
            expect(textEl).toHaveAttribute('text-anchor', 'middle');
            expect(textEl).toHaveAttribute('dominant-baseline', 'central');
            expect(textEl).toHaveAttribute('font-size', '14');
            expect(textEl).toHaveAttribute('font-weight', 'bold');
            expect(textEl).toHaveAttribute('fill', '#D4A0A0');
            expect(textEl).toHaveAttribute('font-family', 'Georgia, serif');
        });
    });
});
