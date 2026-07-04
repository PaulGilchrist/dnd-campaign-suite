// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FogOverlay from './FogOverlay.jsx';

describe('FogOverlay', () => {
    describe('early return guards', () => {
        it('should render null when isLocalhost is false', () => {
            const { container } = render(
                <FogOverlay fog={new Set(['0,0'])} isLocalhost={false} />
            );
            expect(container.innerHTML).toBe('');
        });

        it('should render null when fog is null or undefined', () => {
            const { container: nullContainer } = render(
                <FogOverlay fog={null} isLocalhost={true} />
            );
            expect(nullContainer.innerHTML).toBe('');

            const { container: undefinedContainer } = render(
                <FogOverlay isLocalhost={true} />
            );
            expect(undefinedContainer.innerHTML).toBe('');
        });
    });

    describe('rect rendering', () => {
        it('should render no rects for empty fog set', () => {
            const { container } = render(
                <FogOverlay fog={new Set()} isLocalhost={true} />
            );
            expect(container.querySelectorAll('rect').length).toBe(0);
        });

        it('should render one rect per fog entry', () => {
            const fog = new Set(['0,0', '1,0', '2,1']);
            const { container } = render(
                <FogOverlay fog={fog} isLocalhost={true} />
            );
            expect(container.querySelectorAll('rect').length).toBe(3);
        });

        it('should not render any rects when isLocalhost is false', () => {
            const fog = new Set(['0,0', '1,0']);
            const { container } = render(
                <FogOverlay fog={fog} isLocalhost={false} />
            );
            expect(container.querySelectorAll('rect').length).toBe(0);
        });
    });

    describe('rect positioning', () => {
        it('should position rects at correct grid coordinates', () => {
            const fog = new Set(['0,0', '1,0', '2,1']);
            const { container } = render(
                <FogOverlay fog={fog} isLocalhost={true} />
            );
            const rects = container.querySelectorAll('rect');
            const rectMap = new Map();
            rects.forEach((rect) => {
                rectMap.set(`${rect.getAttribute('x')},${rect.getAttribute('y')}`, true);
            });
            expect(rectMap.get('0,0')).toBe(true);
            expect(rectMap.get('40,0')).toBe(true);
            expect(rectMap.get('80,40')).toBe(true);
        });

        it('should set rect width and height to CELL_SIZE (40)', () => {
            const { container } = render(
                <FogOverlay fog={new Set(['0,0'])} isLocalhost={true} />
            );
            const rect = container.querySelector('rect');
            expect(rect.getAttribute('width')).toBe('40');
            expect(rect.getAttribute('height')).toBe('40');
        });
    });

    describe('rect styling', () => {
        it('should apply the no-print and fog-cell classes', () => {
            const { container } = render(
                <FogOverlay fog={new Set(['0,0'])} isLocalhost={true} />
            );
            const rect = container.querySelector('rect');
            expect(rect).toHaveClass('no-print');
            expect(rect).toHaveClass('fog-cell');
        });
    });
});
