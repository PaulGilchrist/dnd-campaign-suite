import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DoorSVG from './DoorSVG.jsx';

const renderDoor = (props = {}) =>
    render(
        <svg>
            <DoorSVG {...props} />
        </svg>
    );

describe('DoorSVG', () => {
    it('should render the root <g> element', () => {
        const { container } = renderDoor();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderDoor({ id: 'door-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('door-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderDoor({ className: 'door-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('door-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(DoorSVG.displayName).toBe('DoorSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderDoor({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the main board body rect', () => {
        const { container } = renderDoor();
        const bodyRect = container.querySelector(
            'rect[x="15"][y="0"][width="6"][height="36"]'
        );
        expect(bodyRect).not.toBeNull();
        expect(bodyRect.getAttribute('fill')).toBe('#8B5A2B');
    });

    it('should render the left wood grain line', () => {
        const { container } = renderDoor();
        const grainLine = container.querySelector(
            'line[x1="16.5"][y1="0"][x2="16.5"][y2="36"]'
        );
        expect(grainLine).not.toBeNull();
        expect(grainLine.getAttribute('stroke')).toBe('#6B3E1F');
        expect(grainLine.getAttribute('stroke-width')).toBe('0.3');
        expect(grainLine.getAttribute('opacity')).toBe('0.5');
    });

    it('should render the right wood grain line', () => {
        const { container } = renderDoor();
        const grainLine = container.querySelector(
            'line[x1="19.5"][y1="0"][x2="19.5"][y2="36"]'
        );
        expect(grainLine).not.toBeNull();
        expect(grainLine.getAttribute('stroke')).toBe('#6B3E1F');
        expect(grainLine.getAttribute('stroke-width')).toBe('0.3');
        expect(grainLine.getAttribute('opacity')).toBe('0.5');
    });

    it('should render the highlight edge rect', () => {
        const { container } = renderDoor();
        const highlightRect = container.querySelector(
            'rect[x="15"][y="0"][width="0.5"][height="36"]'
        );
        expect(highlightRect).not.toBeNull();
        expect(highlightRect.getAttribute('fill')).toBe('#A0652D');
        expect(highlightRect.getAttribute('opacity')).toBe('0.6');
    });

    it('should render total rect count (2 rects)', () => {
        const { container } = renderDoor();
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(2);
    });

    it('should render total line count (2 lines)', () => {
        const { container } = renderDoor();
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(2);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderDoor({ 'data-test': 'door' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('door');
    });
});
