// @maintained-by-ai
// Lane: DeleteConfirmModal — the shared in-app named-delete dialog extracted
// VERBATIM from MapsManager's Delete-map modal (backlog 2026-11-01 AZ2 improve
// "two delete-confirm idioms"). OWNED here: the a11y tier every named-delete
// lane inherits — role="dialog" + aria-modal + labelled heading, initial focus
// inside (Cancel), the two-way Tab trap, and the Cancel/confirm callbacks.
// MapsManager-side behavior through this dialog stays pinned by
// MapsManager.delete-a11y.test.jsx; map-lane copy + write semantics are pinned
// by DeleteFromMapModal.test.jsx and PlacedItems.delete.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DeleteConfirmModal from './DeleteConfirmModal.jsx';

const renderModal = (overrides = {}) => render(
    <DeleteConfirmModal
        titleId="titled-dialog"
        title="Delete Thing"
        confirmLabel="Yes, Delete"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        {...overrides}
    >
        Delete &quot;<strong>Widget</strong>&quot; for good?
    </DeleteConfirmModal>
);

describe('DeleteConfirmModal', () => {
    it('exposes a labelled modal dialog with the named copy and both actions', () => {
        renderModal();
        const dialog = screen.getByRole('dialog', { name: 'Delete Thing' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog.getAttribute('aria-labelledby')).toBe('titled-dialog');
        expect(document.getElementById('titled-dialog')).toHaveTextContent('Delete Thing');
        expect(dialog).toHaveTextContent('Delete "Widget" for good?');
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Yes, Delete' })).toBeInTheDocument();
    });

    it('moves focus into the dialog on open and traps Tab at both ends', () => {
        const { container } = renderModal();
        const dialog = screen.getByRole('dialog');
        const cancel = screen.getByRole('button', { name: 'Cancel' });
        const confirm = screen.getByRole('button', { name: 'Yes, Delete' });

        expect(cancel).toHaveFocus();
        expect(dialog.contains(document.activeElement)).toBe(true);

        confirm.focus();
        fireEvent.keyDown(confirm, { key: 'Tab' });
        expect(cancel).toHaveFocus();

        fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
        expect(confirm).toHaveFocus();

        expect(container.querySelector('.modal-shell-overlay')).toBeInTheDocument();
    });

    // Sanctioned extension (backlog 2026-11-04 CO, campaign-delete lane):
    // an optional typed-name gate rendered INSIDE the dialog, above the
    // action row, plus inline role="alert" copy that keeps the dialog open.
    // Consumers that omit both props keep the tier above byte-identical.
    it('arms an optional typed-name input that receives initial focus', () => {
        const onChange = vi.fn();
        renderModal({
            typedConfirm: { label: 'Type the exact name:', value: 'draft', onChange }
        });
        const input = screen.getByLabelText('Type the exact name:');
        expect(input).toHaveValue('draft');
        expect(input).toHaveFocus(); // first focusable element in the dialog
        fireEvent.change(input, { target: { value: 'typed' } });
        expect(onChange).toHaveBeenCalledWith('typed');
    });

    it('shows inline error copy without touching the action row or firing dialogs', () => {
        const onConfirm = vi.fn();
        const confirmSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        renderModal({
            typedConfirm: { label: 'Type the exact name:', value: 'wrong', onChange: vi.fn() },
            error: 'Campaign name did not match. Deletion cancelled.',
            onConfirm
        });
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Campaign name did not match. Deletion cancelled.'
        );
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Yes, Delete' })).toBeEnabled();
        expect(confirmSpy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('routes Cancel and Confirm to their callbacks without invoking window.confirm', () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const onCancel = vi.fn();
        const onConfirm = vi.fn();
        renderModal({ onCancel, onConfirm });

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Yes, Delete' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(confirmSpy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    // Optional confirmDisabled (owner decision 2026-11-11, campaign-delete
    // lane flip): hosts gate the destructive button themselves; the dialog
    // renders it natively disabled and the focus trap routes around it.
    // Consumers that omit the prop keep the enabled face pinned above.
    it('renders the confirm disabled when confirmDisabled is set, and the Tab trap skips it', () => {
        const onConfirm = vi.fn();
        renderModal({ confirmDisabled: true, onConfirm });
        const cancel = screen.getByRole('button', { name: 'Cancel' });
        const confirm = screen.getByRole('button', { name: 'Yes, Delete' });

        expect(confirm).toBeDisabled();
        expect(cancel).toHaveFocus(); // initial focus skips the disabled button

        fireEvent.keyDown(cancel, { key: 'Tab' });
        expect(cancel).toHaveFocus(); // only one focusable element — trap wraps

        fireEvent.click(confirm); // React suppresses onClick while disabled
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
