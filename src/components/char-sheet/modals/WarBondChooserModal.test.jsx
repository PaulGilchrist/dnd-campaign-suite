// @maintained-by-ai
// Modal UI lane for CLA-379 War Bond chooser: rendering/instructions, selection
// semantics (replace vs cap, existing-seed), confirm payload + result popup → Done,
// and cancel via Skip. Handler internals (pairing, persistence, log entries) are
// owned by warBondHandler.test.jsx; chooser registration by useCharActionsAutomation tests.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WarBondChooserModal from './WarBondChooserModal.jsx';

function renderModal(overrides = {}) {
    const onConfirm = overrides.onConfirm || vi.fn();
    const onClose = overrides.onClose || vi.fn();
    render(
        <WarBondChooserModal
            title="War Bond — Summon Bonded Weapon"
            icon="fa-link"
            options={['Scimitar', 'Longsword']}
            maxChoices={1}
            confirmLabel="Summon"
            {...overrides}
            onConfirm={onConfirm}
            onClose={onClose}
        />
    );
    return { onConfirm, onClose };
}

describe('WarBondChooserModal (CLA-379)', () => {
    it('renders chooser with title, instruction, options, inert confirm, and Skip closes without confirming', () => {
        const { onConfirm, onClose } = renderModal();

        expect(screen.getByText('War Bond — Summon Bonded Weapon')).toBeTruthy();
        expect(screen.queryByText(/Choose up to/)).toBeNull();
        expect(screen.getByText(/Choose one weapon/)).toBeTruthy();
        const boxes = screen.getAllByRole('checkbox');
        expect(boxes).toHaveLength(2);
        expect(screen.getByRole('checkbox', { name: 'Scimitar' }).checked).toBe(false);
        expect(screen.getByRole('checkbox', { name: 'Longsword' }).checked).toBe(false);
        expect(screen.getByText('Selected: 0/1')).toBeTruthy();
        expect(screen.getByRole('button', { name: /Summon/ }).disabled).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('single-choice mode replaces the selection so exactly one weapon stays checked', () => {
        renderModal();

        fireEvent.click(screen.getByRole('checkbox', { name: 'Longsword' }));
        expect(screen.getByText('Selected: 1/1')).toBeTruthy();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Scimitar' }));

        const checked = screen.getAllByRole('checkbox').filter(cb => cb.checked);
        expect(checked).toHaveLength(1);
        expect(screen.getByRole('checkbox', { name: 'Scimitar' }).checked).toBe(true);
        expect(screen.getByRole('checkbox', { name: 'Longsword' }).checked).toBe(false);
        expect(screen.getByText('Selected: 1/1')).toBeTruthy();
    });

    it('bond mode seeds existing selections and caps selection at maxChoices', () => {
        renderModal({
            title: 'War Bond — Bond Weapons',
            options: ['Scimitar', 'Longsword', 'Mace'],
            maxChoices: 2,
            existing: ['Longsword'],
            confirmLabel: 'Bond',
        });

        expect(screen.getByText(/Choose up to/).textContent).toBe('Choose up to 2 weapons:');
        expect(screen.getByText('Selected: 1/2')).toBeTruthy();
        expect(screen.getByRole('checkbox', { name: 'Longsword' }).checked).toBe(true);

        fireEvent.click(screen.getByRole('checkbox', { name: 'Scimitar' }));
        expect(screen.getByText('Selected: 2/2')).toBeTruthy();

        // Third weapon is capped: disabled and stays unchecked.
        const mace = screen.getByRole('checkbox', { name: 'Mace' });
        expect(mace.disabled).toBe(true);
        fireEvent.click(mace);
        expect(mace.checked).toBe(false);

        // Unchecking frees the cap for re-selection.
        fireEvent.click(screen.getByRole('checkbox', { name: 'Longsword' }));
        expect(screen.getByText('Selected: 1/2')).toBeTruthy();
        expect(screen.getByRole('checkbox', { name: 'Scimitar' }).disabled).toBe(false);
    });

    it('confirm dispatches the exact ordered selection once, shows the result popup, and Done closes', async () => {
        const { onConfirm, onClose } = renderModal({
            options: ['Scimitar', 'Longsword'],
            maxChoices: 2,
            confirmLabel: 'Summon',
            onConfirm: vi.fn(async () => ({
                type: 'popup',
                payload: { type: 'automation_info', name: 'War Bond', description: 'Summoned Scimitar, Longsword.' },
            })),
        });

        fireEvent.click(screen.getByRole('checkbox', { name: 'Scimitar' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Longsword' }));
        expect(screen.getByRole('button', { name: /Summon/ }).disabled).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: /Summon/ }));
        await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
        expect(onConfirm).toHaveBeenCalledWith(['Scimitar', 'Longsword']);
        expect(screen.getByText('Summoned Scimitar, Longsword.')).toBeTruthy();
        // Result view replaces the chooser — nothing left to confirm.
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
