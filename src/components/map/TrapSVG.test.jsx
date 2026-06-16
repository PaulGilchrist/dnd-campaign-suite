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
    it('should render the root <g> element', () => {
        const { container } = renderTrap();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderTrap({ id: 'trap-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('trap-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderTrap({ className: 'trap-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('trap-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(TrapSVG.displayName).toBe('TrapSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderTrap({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the border rect', () => {
        const { container } = renderTrap();
        const borderRect = container.querySelector(
            'rect[x="1"][y="1"][width="34"][height="34"]'
        );
        expect(borderRect).not.toBeNull();
        expect(borderRect.getAttribute('fill')).toBe('none');
        expect(borderRect.getAttribute('stroke')).toBe('#8B1A1A');
        expect(borderRect.getAttribute('stroke-width')).toBe('2');
    });

    it('should render the top-left to bottom-right diagonal line', () => {
        const { container } = renderTrap();
        const diagonal = container.querySelector(
            'line[x1="4"][y1="4"][x2="32"][y2="32"]'
        );
        expect(diagonal).not.toBeNull();
        expect(diagonal.getAttribute('stroke')).toBe('#8B1A1A');
        expect(diagonal.getAttribute('stroke-width')).toBe('2.5');
    });

    it('should render the top-right to bottom-left diagonal line', () => {
        const { container } = renderTrap();
        const diagonal = container.querySelector(
            'line[x1="32"][y1="4"][x2="4"][y2="32"]'
        );
        expect(diagonal).not.toBeNull();
        expect(diagonal.getAttribute('stroke')).toBe('#8B1A1A');
        expect(diagonal.getAttribute('stroke-width')).toBe('2.5');
    });

    it('should render total rect count (1)', () => {
        const { container } = renderTrap();
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(1);
    });

    it('should render total line count (2)', () => {
        const { container } = renderTrap();
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(2);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderTrap({ 'data-test': 'trap' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('trap');
    });
});
