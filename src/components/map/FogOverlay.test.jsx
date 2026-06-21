// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FogOverlay from './FogOverlay.jsx';

describe('FogOverlay', () => {
    describe('rendering guards', () => {
        it('should render null when isLocalhost is false', () => {
            const { container } = render(
                <FogOverlay fog={new Set(['0,0'])} isLocalhost={false} />
            );
            expect(container.innerHTML).toBe('');
        });

        it('should render null when fog is null', () => {
            const { container } = render(
                <FogOverlay fog={null} isLocalhost={true} />
            );
            expect(container.innerHTML).toBe('');
        });

        it('should render null when fog is undefined', () => {
            const { container } = render(
                <FogOverlay fog={undefined} isLocalhost={true} />
            );
            expect(container.innerHTML).toBe('');
        });

        it('should render nothing for empty fog set', () => {
            const { container } = render(
                <FogOverlay fog={new Set()} isLocalhost={true} />
            );
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBe(0);
        });
    });

    describe('rect elements', () => {
        it('should render rect elements when isLocalhost is true and fog is provided', () => {
            const { container } = render(
                <FogOverlay fog={new Set(['0,0'])} isLocalhost={true} />
            );
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBeGreaterThan(0);
        });

        it('should render one rect per fog entry', () => {
            const fog = new Set(['0,0', '1,0', '2,1']);
            const { container } = render(
                <FogOverlay fog={fog} isLocalhost={true} />
            );
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBe(3);
        });

        it('should have no displayName', () => {
            expect(FogOverlay.displayName).toBeUndefined();
        });
    });

    describe('rect positioning', () => {
        it('should position rect at grid coordinates 0,0', () => {
            const { container } = render(
                <FogOverlay fog={new Set(['0,0'])} isLocalhost={true} />
            );
            const rect = container.querySelector('rect');
            expect(rect).toHaveAttribute('x', '0');
            expect(rect).toHaveAttribute('y', '0');
        });

        it('should position rect at grid coordinates 1,0', () => {
            const { container } = render(
                <FogOverlay fog={new Set(['1,0'])} isLocalhost={true} />
            );
            const rect = container.querySelector('rect');
            expect(rect).toHaveAttribute('x', '40');
            expect(rect).toHaveAttribute('y', '0');
        });

        it('should position rect at grid coordinates 2,1', () => {
            const { container } = render(
                <FogOverlay fog={new Set(['2,1'])} isLocalhost={true} />
            );
            const rect = container.querySelector('rect');
            expect(rect).toHaveAttribute('x', '80');
            expect(rect).toHaveAttribute('y', '40');
        });

        it('should set rect width and height to CELL_SIZE', () => {
            const { container } = render(
                <FogOverlay fog={new Set(['0,0'])} isLocalhost={true} />
            );
            const rect = container.querySelector('rect');
            expect(rect).toHaveAttribute('width', '40');
            expect(rect).toHaveAttribute('height', '40');
        });

        it('should render rects in correct order for given fog set', () => {
            const fog = new Set(['0,0', '1,2']);
            const { container } = render(
                <FogOverlay fog={fog} isLocalhost={true} />
            );
            const rects = container.querySelectorAll('rect');
            expect(rects[0].getAttribute('x')).toBe('0');
            expect(rects[0].getAttribute('y')).toBe('0');
            expect(rects[1].getAttribute('x')).toBe('40');
            expect(rects[1].getAttribute('y')).toBe('80');
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
