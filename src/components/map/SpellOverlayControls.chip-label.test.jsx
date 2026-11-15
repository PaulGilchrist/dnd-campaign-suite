// @maintained-by-ai
// Locks the zone-distinctive chip identity (backlog 2026-11-08 EQ): with 2+
// active zones every chip must name WHICH zone it belongs to via its origin
// cell — "Sphere (12,8)", not the bare shape name — on its visible label,
// tooltip, and remove-button accessible name, mirroring the placed-token
// `Name (x,y)` disambiguation (hooks/usePlacedItems.js). Mixed-shape label
// composition and first-chip/Clear-All removal are covered in
// SpellOverlayControls.test.jsx; here we pin same-shape/different-cell
// disambiguation and that each remove button targets its own chip's zone.
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

const TWO_ZONES = [sphereAt('o1', 12, 8), sphereAt('o2', 3, 4)];

const renderWithOverlays = (overlays, onRemoveOverlay = vi.fn()) =>
    render(<SpellOverlayControls
        selectedShape={OverlayShape.SPHERE}
        setSelectedShape={vi.fn()}
        shapeParams={{}}
        setShapeParams={vi.fn()}
        overlays={overlays}
        onRemoveOverlay={onRemoveOverlay}
        onClearAll={vi.fn()}
        onCancelMode={vi.fn()}
        isActive={false}
    />);

describe('SpellOverlayControls chip labels', () => {
    it('every chip names its zone cell in label, tooltip, and accessible remove name', () => {
        const { container } = renderWithOverlays(TWO_ZONES);
        const chips = Array.from(container.querySelectorAll('.spell-overlay-item'));
        // Two same-shape chips at different cells must be observably distinct
        // everywhere the zone is identified — the whole point of the fix.
        expect(chips.map((c) => c.querySelector('span').textContent))
            .toEqual(['Sphere (12,8)', 'Sphere (3,4)']);
        expect(chips.map((c) => c.getAttribute('title')))
            .toEqual(['Sphere (12,8)', 'Sphere (3,4)']);
        expect(chips.map((c) => c.querySelector('button').getAttribute('aria-label')))
            .toEqual(['Remove overlay at (12,8)', 'Remove overlay at (3,4)']);
    });

    it('each chip remove button deletes exactly its own zone id', () => {
        const onRemoveOverlay = vi.fn();
        const { container } = renderWithOverlays(TWO_ZONES, onRemoveOverlay);
        const buttons = container.querySelectorAll('.spell-overlay-item button');
        // Sibling file covers the first chip; pin the second chip → id binding.
        fireEvent.click(buttons[1]);
        expect(onRemoveOverlay).toHaveBeenCalledTimes(1);
        expect(onRemoveOverlay).toHaveBeenCalledWith('o2');
    });
});
