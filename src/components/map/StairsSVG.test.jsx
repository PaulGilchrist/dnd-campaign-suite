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
    it('should render the root <g> element', () => {
        const { container } = renderStairs();
        const rootGroup = container.querySelector('g');
        expect(rootGroup).not.toBeNull();
    });

    it('should apply the given id to the root group', () => {
        const { container } = renderStairs({ id: 'stairs-svg-1' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('id')).toBe('stairs-svg-1');
    });

    it('should apply the given className to the root group', () => {
        const { container } = renderStairs({ className: 'stairs-custom' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.classList.contains('stairs-custom')).toBe(true);
    });

    it('should render with displayName', () => {
        expect(StairsSVG.displayName).toBe('StairsSVG');
    });

    it('should render as a forwardRef component', () => {
        const ref = vi.fn();
        renderStairs({ ref });
        expect(ref).toHaveBeenCalled();
    });

    it('should render the stairwell frame rect', () => {
        const { container } = renderStairs();
        const frameRect = container.querySelector(
            'rect[x="2"][y="2"][width="32"][height="32"]'
        );
        expect(frameRect).not.toBeNull();
        expect(frameRect.getAttribute('fill')).toBe('none');
        expect(frameRect.getAttribute('stroke')).toBe('#8B5A2B');
        expect(frameRect.getAttribute('stroke-width')).toBe('1.5');
    });

    it('should render 4 step lines', () => {
        const { container } = renderStairs();
        const stepLines = container.querySelectorAll(
            'line[stroke="#8B5A2B"][stroke-width="1"]'
        );
        expect(stepLines.length).toBe(4);
    });

    it('should render the first step line at y=8', () => {
        const { container } = renderStairs();
        const stepLine = container.querySelector(
            'line[x1="4"][y1="8"][x2="32"][y2="8"]'
        );
        expect(stepLine).not.toBeNull();
    });

    it('should render the second step line at y=14', () => {
        const { container } = renderStairs();
        const stepLine = container.querySelector(
            'line[x1="4"][y1="14"][x2="32"][y2="14"]'
        );
        expect(stepLine).not.toBeNull();
    });

    it('should render the third step line at y=20', () => {
        const { container } = renderStairs();
        const stepLine = container.querySelector(
            'line[x1="4"][y1="20"][x2="32"][y2="20"]'
        );
        expect(stepLine).not.toBeNull();
    });

    it('should render the fourth step line at y=26', () => {
        const { container } = renderStairs();
        const stepLine = container.querySelector(
            'line[x1="4"][y1="26"][x2="32"][y2="26"]'
        );
        expect(stepLine).not.toBeNull();
    });

    it('should render the down arrow shaft line', () => {
        const { container } = renderStairs();
        const shaftLine = container.querySelector(
            'line[x1="18"][y1="8"][x2="18"][y2="26"]'
        );
        expect(shaftLine).not.toBeNull();
        expect(shaftLine.getAttribute('stroke')).toBe('#8B1A1A');
        expect(shaftLine.getAttribute('stroke-width')).toBe('1.5');
    });

    it('should render the down arrow head polygon', () => {
        const { container } = renderStairs();
        const arrowHead = container.querySelector(
            'polygon[points="14,24 22,24 18,30"]'
        );
        expect(arrowHead).not.toBeNull();
        expect(arrowHead.getAttribute('fill')).toBe('#8B1A1A');
    });

    it('should render total line count (5 lines)', () => {
        const { container } = renderStairs();
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(5);
    });

    it('should render total rect count (1 rect)', () => {
        const { container } = renderStairs();
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(1);
    });

    it('should render total polygon count (1 polygon)', () => {
        const { container } = renderStairs();
        const polygons = container.querySelectorAll('polygon');
        expect(polygons.length).toBe(1);
    });

    it('should pass through rest props to the root group', () => {
        const { container } = renderStairs({ 'data-test': 'stairs' });
        const rootGroup = container.querySelector('g');
        expect(rootGroup.getAttribute('data-test')).toBe('stairs');
    });
});
