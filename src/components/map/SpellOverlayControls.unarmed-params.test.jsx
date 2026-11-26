// @maintained-by-ai 2026-11-14
// Pins the unarmed param face (backlog 2026-11-09 ER): with zones on the board
// the controls panel mounts in manage-only mode, but with the spell tool NOT
// armed (isActive=false) nothing may invite a placement click — the shape
// picker and param inputs render disabled and both placement-inviting hints
// are absent. Arming the tool re-enables the param controls.
// Complementary coverage lives in the sibling files: active-mode hints, the
// Cancel button, and remove/Clear-All wiring on the active list are pinned in
// SpellOverlayControls.test.jsx; chip identity and per-chip id binding in
// SpellOverlayControls.chip-label.test.jsx.
import { render } from '@testing-library/react';
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

const renderControls = (props = {}) => render(<SpellOverlayControls
    selectedShape={OverlayShape.SPHERE}
    overlays={[sphereAt('o1', 3, 4), sphereAt('o2', 12, 8)]}
    shapeParams={{}}
    setSelectedShape={vi.fn()}
    setShapeParams={vi.fn()}
    onRemoveOverlay={vi.fn()}
    onClearAll={vi.fn()}
    onCancelMode={vi.fn()}
    isActive={false}
    {...props}
/>);

describe('SpellOverlayControls unarmed param face', () => {
    it('with zones present but the tool unarmed, param controls are disabled and no placement copy shows', () => {
        const { getByRole, getAllByRole, queryByText } = renderControls();
        expect(getByRole('combobox')).toBeDisabled();
        const inputs = getAllByRole('spinbutton');
        expect(inputs).toHaveLength(1); // sphere → radiusFt only
        inputs.forEach((input) => expect(input).toBeDisabled());
        expect(queryByText(/Click map to place/)).not.toBeInTheDocument();
        expect(queryByText('Params apply to the next placement only')).not.toBeInTheDocument();
    });

    it('arming the tool re-enables the shape picker and param inputs', () => {
        const { getByRole, getAllByRole } = renderControls({ isActive: true });
        expect(getByRole('combobox')).toBeEnabled();
        getAllByRole('spinbutton').forEach((input) => expect(input).toBeEnabled());
    });
});
