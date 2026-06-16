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
    it('should render the root <g> element', () => {
        const { container } = renderSecretDoor();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderSecretDoor({ id: 'secret-door-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('secret-door-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderSecretDoor({ className: 'secret-door-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('secret-door-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(SecretDoorSVG.displayName).toBe('SecretDoorSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderSecretDoor({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the main board rect', () => {
        const { container } = renderSecretDoor();
        const boardRect = container.querySelector(
            'rect[x="0"][y="0"][width="36"][height="36"]'
        );
        expect(boardRect).not.toBeNull();
        expect(boardRect.getAttribute('fill')).toBe('#8B1A1A');
    });

    it('should render the highlight edge rect', () => {
        const { container } = renderSecretDoor();
        const highlightRect = container.querySelector(
            'rect[x="0"][y="0"][width="0.5"][height="36"]'
        );
        expect(highlightRect).not.toBeNull();
        expect(highlightRect.getAttribute('fill')).toBe('#A02020');
        expect(highlightRect.getAttribute('opacity')).toBe('0.6');
    });

    it('should render the "S" text element', () => {
        const { container } = renderSecretDoor();
        const textEl = container.querySelector('text');
        expect(textEl).not.toBeNull();
        expect(textEl.getAttribute('x')).toBe('18');
        expect(textEl.getAttribute('y')).toBe('18');
        expect(textEl.getAttribute('text-anchor')).toBe('middle');
        expect(textEl.getAttribute('dominant-baseline')).toBe('central');
        expect(textEl.getAttribute('font-size')).toBe('14');
        expect(textEl.getAttribute('font-weight')).toBe('bold');
        expect(textEl.getAttribute('fill')).toBe('#D4A0A0');
        expect(textEl.getAttribute('font-family')).toBe('Georgia, serif');
        expect(textEl.textContent).toBe('S');
    });

    it('should render 5 wood grain lines', () => {
        const { container } = renderSecretDoor();
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(5);
    });

    it('should render wood grain lines with correct attributes', () => {
        const { container } = renderSecretDoor();
        const lines = container.querySelectorAll('line');
        lines.forEach((line) => {
            expect(line.getAttribute('stroke')).toBe('#5C1010');
            expect(line.getAttribute('stroke-width')).toBe('0.3');
            expect(line.getAttribute('opacity')).toBe('0.5');
        });
    });

    it('should render wood grain lines at correct x positions', () => {
        const { container } = renderSecretDoor();
        const lines = container.querySelectorAll('line');
        const xPositions = Array.from(lines).map((l) => l.getAttribute('x1'));
        expect(xPositions).toEqual(['6', '12', '18', '24', '30']);
    });

    it('should render total rect count (2 rects)', () => {
        const { container } = renderSecretDoor();
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(2);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderSecretDoor({ 'data-test': 'secret-door' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('secret-door');
    });
});
