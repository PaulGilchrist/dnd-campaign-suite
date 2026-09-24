// @improved-by-ai
// @cleaned-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FogOverlay from './FogOverlay.jsx';

const getRects = (queryContainer) => queryContainer.querySelectorAll('rect');

describe('FogOverlay', () => {
    describe('early return guards', () => {
        it('renders null when fog is falsy even if isLocalhost is true', () => {
            const { container } = render(
                <FogOverlay isLocalhost />
            );
            expect(container.innerHTML).toBe('');
        });
    });

    describe('role-specific fog classes', () => {
        it('uses the translucent fog-cell class for the GM (localhost)', () => {
            const { container } = render(
                <FogOverlay fog={new Set(['0,0'])} isLocalhost />
            );
            const rect = container.querySelector('rect');
            expect(rect).toHaveClass('no-print');
            expect(rect).toHaveClass('fog-cell');
            expect(rect).not.toHaveClass('fog-cell-player');
        });

        it('uses the opaque fog-cell-player class for players', () => {
            const { container } = render(
                <FogOverlay fog={new Set(['0,0'])} isLocalhost={false} />
            );
            const rect = container.querySelector('rect');
            expect(rect).toHaveClass('no-print');
            expect(rect).toHaveClass('fog-cell-player');
            expect(rect).not.toHaveClass('fog-cell');
        });
    });

    describe('rect rendering', () => {
        it('renders no rects for empty fog set', () => {
            const { container } = render(
                <FogOverlay fog={new Set()} isLocalhost />
            );
            expect(getRects(container).length).toBe(0);
        });

        it('renders one rect per fog entry for both roles', () => {
            for (const isLocalhost of [true, false]) {
                const { container, unmount } = render(
                    <FogOverlay fog={new Set(['0,0', '1,0', '2,1'])} isLocalhost={isLocalhost} />
                );
                expect(getRects(container).length).toBe(3);
                unmount();
            }
        });

        it('positions rects at correct pixel coordinates based on CELL_SIZE', () => {
            const fog = new Set(['0,0', '1,0', '2,1']);
            const { container } = render(
                <FogOverlay fog={fog} isLocalhost={false} />
            );
            const rects = getRects(container);

            const positions = Array.from(rects).map((rect) => ({
                x: Number(rect.getAttribute('x')),
                y: Number(rect.getAttribute('y')),
            }));

            expect(positions).toContainEqual({ x: 0, y: 0 });
            expect(positions).toContainEqual({ x: 40, y: 0 });
            expect(positions).toContainEqual({ x: 80, y: 40 });
        });
    });
});
