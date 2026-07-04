// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TowerSVG from './TowerSVG.jsx';

describe('TowerSVG', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('props and rendering', () => {
        it('should render the SVG group element', () => {
            const { container } = render(<TowerSVG />);
            const group = container.querySelector('g');
            expect(group).toBeInTheDocument();
        });

        it('should pass id, className, and additional props through to the group', () => {
            const { container } = render(<TowerSVG id="my-tower" className="tower-class" data-value="42" onClick={vi.fn()} />);
            const group = container.querySelector('g');
            expect(group.getAttribute('id')).toBe('my-tower');
            expect(group.getAttribute('class')).toBe('tower-class');
            expect(group.getAttribute('data-value')).toBe('42');
        });

        it('should support ref forwarding', () => {
            const ref = vi.fn();
            render(<TowerSVG ref={ref} />);
            expect(ref).toHaveBeenCalled();
        });

        it('should have displayName TowerSVG', () => {
            expect(TowerSVG.displayName).toBe('TowerSVG');
        });
    });

    describe('structure', () => {
        it('should render all expected SVG element types', () => {
            const { container } = render(<TowerSVG />);
            const group = container.querySelector('g');
            expect(group.querySelector('ellipse')).toBeInTheDocument();
            expect(group.querySelector('rect')).toBeInTheDocument();
            expect(group.querySelector('line')).toBeInTheDocument();
            expect(group.querySelector('path')).toBeInTheDocument();
        });

        it('should render a tower with correct element counts', () => {
            const { container } = render(<TowerSVG />);
            expect(container.querySelectorAll('ellipse').length).toBe(1);
            expect(container.querySelectorAll('rect').length).toBe(13);
            expect(container.querySelectorAll('line').length).toBe(12);
            expect(container.querySelectorAll('path').length).toBe(2);
        });
    });
});
