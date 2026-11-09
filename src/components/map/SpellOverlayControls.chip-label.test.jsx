// Locks the zone-distinctive chip label (backlog 2026-11-08 EQ): with 2+
// active zones every chip must name WHICH zone it belongs to via its origin
// cell — "Sphere (12,8)", not the bare shape name — mirroring the placed-
// token `Name (x,y)` disambiguation (hooks/usePlacedItems.js).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SpellOverlayControls from './SpellOverlayControls.jsx';
import { OverlayShape } from '../../models/SpellOverlay.js';

const sphereAt = (id, x, y) => ({
    id,
    shape: OverlayShape.SPHERE,
    startGridX: x,
    startGridY: y,
    radiusFt: 20,
    color: 'rgba(255,80,60,0.07)',
});

const renderWithOverlays = (overlays) =>
    render(<SpellOverlayControls
        selectedShape={OverlayShape.SPHERE}
        setSelectedShape={vi.fn()}
        shapeParams={{}}
        setShapeParams={vi.fn()}
        overlays={overlays}
        onRemoveOverlay={vi.fn()}
        onClearAll={vi.fn()}
        onCancelMode={vi.fn()}
        isActive={false}
    />);

describe('SpellOverlayControls chip labels', () => {
    it('composes the origin cell into every chip label so 2+ zones are distinguishable', () => {
        const { container } = renderWithOverlays([
            sphereAt('o1', 12, 8),
            sphereAt('o2', 3, 4),
        ]);
        const labels = Array.from(
            container.querySelectorAll('.spell-overlay-item span')
        ).map((s) => s.textContent);
        expect(labels).toEqual(['Sphere (12,8)', 'Sphere (3,4)']);
        // The whole point of the fix: two chips of the SAME shape at
        // different cells render observably different DOM texts.
        expect(labels[0]).not.toBe(labels[1]);
    });

    it('tooltips the chip with the same zone-distinctive label', () => {
        const { container } = renderWithOverlays([sphereAt('o1', 12, 8)]);
        expect(container.querySelector('.spell-overlay-item'))
            .toHaveAttribute('title', 'Sphere (12,8)');
    });

    it('gives each remove button an accessible name carrying the zone cell', () => {
        const onRemoveOverlay = vi.fn();
        const { container } = render(
            <SpellOverlayControls
                selectedShape={OverlayShape.SPHERE}
                setSelectedShape={vi.fn()}
                shapeParams={{}}
                setShapeParams={vi.fn()}
                overlays={[sphereAt('o1', 12, 8), sphereAt('o2', 3, 4)]}
                onRemoveOverlay={onRemoveOverlay}
                onClearAll={vi.fn()}
                onCancelMode={vi.fn()}
                isActive={false}
            />
        );
        const buttons = container.querySelectorAll('.spell-overlay-item button');
        expect(buttons[0]).toHaveAccessibleName('Remove overlay at (12,8)');
        expect(buttons[1]).toHaveAccessibleName('Remove overlay at (3,4)');
        // The second chip's × removes exactly the second zone's id.
        fireEvent.click(buttons[1]);
        expect(onRemoveOverlay).toHaveBeenCalledWith('o2');
    });
});
