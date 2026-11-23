// @maintained-by-ai: 2026-11-22
/**
 * Deferred plan C — LightingOverlay render tiers + THE OFF-STATE IDENTITY
 * LAW: `lighting === null` renders ZERO DOM (the pre-feature map, byte-for-
 * byte). On-state: one rect per non-bright cell, ring tier for the dim band,
 * dark tier beyond, and GM vs player class families (see Map.css).
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LightingOverlay from './LightingOverlay.jsx';

const svg = (ui) => render(<svg>{ui}</svg>);

describe('LightingOverlay (plan C)', () => {
    it('off (null) renders NOTHING — no rects, no wrapper', () => {
        const { container } = svg(<LightingOverlay lighting={null} gridSize={5} isLocalhost />);
        expect(container.querySelectorAll('rect')).toHaveLength(0);
    });

    it('GM tab: bright cells unrendered, dim ring = light-cell-ring, unlit = light-cell-dark', () => {
        const lighting = { bright: new Set(['0,0']), dim: new Set(['1,1']) };
        const { container } = svg(<LightingOverlay lighting={lighting} gridSize={3} isLocalhost />);
        // 9 cells − 1 bright = 8 rects.
        expect(container.querySelectorAll('rect')).toHaveLength(8);
        expect(container.querySelector('rect[data-cell="0,0"]')).toBeNull();
        expect(container.querySelector('rect[data-cell="1,1"]')).toHaveAttribute('class', 'no-print light-cell-ring');
        expect(container.querySelector('rect[data-cell="2,2"]')).toHaveAttribute('class', 'no-print light-cell-dark');
        expect(container.querySelector('rect[data-cell="1,1"]')).toHaveAttribute('data-light-tier', 'ring');
    });

    it('player tab: the heavier player tier family (fog stays the opaque hider; light ≠ fog color)', () => {
        const lighting = { bright: new Set(), dim: new Set(['0,1']) };
        const { container } = svg(<LightingOverlay lighting={lighting} gridSize={2} isLocalhost={false} />);
        expect(container.querySelector('rect[data-cell="0,1"]')).toHaveAttribute('class', 'no-print light-cell-player-ring');
        expect(container.querySelector('rect[data-cell="1,0"]')).toHaveAttribute('class', 'no-print light-cell-player-dark');
    });

    it('cells are CELL_SIZE-positioned like the fog rects', () => {
        const lighting = { bright: new Set(), dim: new Set(['2,3']) };
        const { container } = svg(<LightingOverlay lighting={lighting} gridSize={4} isLocalhost />);
        const ring = container.querySelector('rect[data-cell="2,3"]');
        expect(ring).toHaveAttribute('x', '80'); // 2 × 40
        expect(ring).toHaveAttribute('y', '120'); // 3 × 40
        expect(ring).toHaveAttribute('width', '40');
    });
});
