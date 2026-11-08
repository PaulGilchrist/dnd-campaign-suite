// @maintained-by-ai
// Lane: ClearCombatConfirmModal — the copy/chrome layer for the Initiative
// "Clear" overlay (backlog 2026-11-08 EK, replaces the retired native
// window.confirm in createCreatureHandlers.handleClear). OWNED here: the
// honest question copy (backlog 2026-11-08 EP: it admits bare "+NPC"
// placeholder slots survive the reset — clearCombat re-seeds them, playbook
// §9 — instead of promising the whole board empties; scope + irreversibility
// per the house NAMED canon), the heading/confirm-label derivation, the
// null-when-idle mount contract, the callback pass-through, and the modal
// family's dismissal convention PINNED (backdrop click and Escape do NOT
// cancel — an explicit button answers).
// Factory bridge + confirmed body → createCreatureHandlers.test.jsx;
// container wiring + both DOM faces → initiative.test.jsx;
// underlying a11y tier internals → common/DeleteConfirmModal.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClearCombatConfirmModal from './ClearCombatConfirmModal.jsx';

const renderModal = (pending, onCancel = vi.fn(), onConfirm = vi.fn()) => {
    render(
        <ClearCombatConfirmModal pending={pending} onCancel={onCancel} onConfirm={onConfirm} />
    );
    return { onCancel, onConfirm };
};

describe('ClearCombatConfirmModal', () => {
    it('renders nothing while no Clear prompt is armed', () => {
        const { container } = render(
            <ClearCombatConfirmModal pending={false} onCancel={vi.fn()} onConfirm={vi.fn()} />
        );
        expect(container.innerHTML).toBe('');
    });

    it('modern a11y tier: role=dialog + aria-modal + heading labelled via aria-labelledby', () => {
        renderModal(true);
        const dialog = screen.getByRole('dialog', { name: 'Clear Initiative Board' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        const heading = screen.getByRole('heading', { name: 'Clear Initiative Board' });
        expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
        expect(heading.id).toBe('clear-combat-confirm-title');
    });

    it('renders honest copy: initiative reset + monsters removed, bare +NPC placeholders kept and re-seeded, plus explicit buttons', () => {
        renderModal(true);
        const paragraph = document.querySelector('.modal-shell p');
        expect(paragraph.textContent).toBe(
            'Clear combat status for all creatures? This resets initiative and removes monsters from the board — bare +NPC placeholder slots are kept and re-seeded. This action is irreversible.'
        );
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        // Confirm label differs from the "Clear" trigger button so role queries stay unique.
        expect(screen.getByRole('button', { name: 'Yes, Clear Board' })).toBeInTheDocument();
    });

    it('routes Cancel/Confirm clicks to the parent handlers', () => {
        const { onCancel, onConfirm } = renderModal(true);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Yes, Clear Board' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('family dismissal convention: backdrop click and Escape do NOT cancel — it waits indefinitely', () => {
        const { onCancel, onConfirm } = renderModal(true);
        fireEvent.click(document.querySelector('.modal-shell-overlay'));
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(onCancel).not.toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
