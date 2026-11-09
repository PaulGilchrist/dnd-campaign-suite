// Pins the unarmed param face (backlog 2026-11-09 ER): zones on the board
// mount the controls panel in manage-only mode, but with the spell tool NOT
// armed (isActive=false) nothing may invite a placement click — the shape
// picker and param inputs render disabled/dimmed and both placement-inviting
// hints are absent — while the chip list, per-chip remove and Clear All stay
// fully usable. Arming restores the live param bar immediately.
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

const renderControls = (props = {}) => {
    const handlers = {
        setSelectedShape: vi.fn(),
        setShapeParams: vi.fn(),
        onRemoveOverlay: vi.fn(),
        onClearAll: vi.fn(),
        onCancelMode: vi.fn(),
    };
    const view = render(<SpellOverlayControls
        selectedShape={OverlayShape.SPHERE}
        overlays={[sphereAt('o1', 3, 4), sphereAt('o2', 12, 8)]}
        shapeParams={{}}
        isActive={false}
        {...handlers}
        {...props}
    />);
    return { ...view, handlers };
};

describe('SpellOverlayControls unarmed param face', () => {
    it('disables the shape picker and every param input while zones exist unarmed', () => {
        const { getByRole, getAllByRole } = renderControls();
        expect(getByRole('combobox')).toBeDisabled();
        const inputs = getAllByRole('spinbutton');
        expect(inputs).toHaveLength(1); // sphere → radiusFt
        inputs.forEach((input) => expect(input).toBeDisabled());
    });

    it('shows no placement-inviting copy while unarmed', () => {
        const { queryByText } = renderControls();
        expect(queryByText(/Click map to place/)).not.toBeInTheDocument();
        expect(queryByText('Params apply to the next placement only')).not.toBeInTheDocument();
        // Cancel is active-mode chrome — still absent unarmed.
        expect(queryByText(/cancel/i)).not.toBeInTheDocument();
    });

    it('keeps the management face usable unarmed: chips, per-chip remove, Clear All', () => {
        const { container, getByRole, handlers } = renderControls();
        expect(container.querySelectorAll('.spell-overlay-item')).toHaveLength(2);
        fireEvent.click(container.querySelector('.spell-overlay-item button'));
        expect(handlers.onRemoveOverlay).toHaveBeenCalledWith('o1');
        fireEvent.click(getByRole('button', { name: 'Clear All' }));
        expect(handlers.onClearAll).toHaveBeenCalledTimes(1);
    });

    it('arming restores the full interactive param bar: live controls and both hints', () => {
        const { getByRole, getAllByRole, queryByText } = renderControls({ isActive: true });
        expect(getByRole('combobox')).toBeEnabled();
        getAllByRole('spinbutton').forEach((input) => expect(input).toBeEnabled());
        expect(queryByText('Click map to place')).toBeInTheDocument();
        expect(queryByText('Params apply to the next placement only')).toBeInTheDocument();
        expect(getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
});
