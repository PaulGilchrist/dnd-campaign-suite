// @maintained-by-ai
// Lane: DeleteFromMapModal — the descriptor→copy seam for the indoor map
// editor's named confirm (backlog 2026-11-01 AZ2). OWNED here: the verbatim
// copy both removal lanes show (`Delete "<label>" from the map?` for placed
// item/token rows, `Remove "<name>" from the map?` for the player lane), the
// heading/action-verb derivation, the null-when-idle mount contract, and the
// callback pass-through. A11y tier of the underlying dialog → common/
// DeleteConfirmModal.test.jsx; end-to-end delete wiring → PlacedItems.delete.
// test.jsx and Map-handlers.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DeleteFromMapModal from './DeleteFromMapModal.jsx';

describe('DeleteFromMapModal', () => {
    it('renders nothing while no delete is armed', () => {
        const { container } = render(
            <DeleteFromMapModal pending={null} onCancel={vi.fn()} onConfirm={vi.fn()} />
        );
        expect(container.innerHTML).toBe('');
    });

    it('placed-item descriptor → "Delete from Map" dialog naming the label verbatim', () => {
        render(
            <DeleteFromMapModal
                pending={{ label: 'QA Marta', confirm: vi.fn() }}
                onCancel={vi.fn()}
                onConfirm={vi.fn()}
            />
        );
        const dialog = screen.getByRole('dialog', { name: 'Delete from Map' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveTextContent('Delete "QA Marta" from the map?');
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Yes, Delete' })).toBeInTheDocument();
    });

    it('unnamed prop descriptor keeps the cell-anchored label in the copy', () => {
        render(
            <DeleteFromMapModal
                pending={{ label: 'barrel (6,6)', confirm: vi.fn() }}
                onCancel={vi.fn()}
                onConfirm={vi.fn()}
            />
        );
        expect(screen.getByRole('dialog')).toHaveTextContent('Delete "barrel (6,6)" from the map?');
    });

    it('player descriptor rides the SAME dialog with the Remove verb', () => {
        render(
            <DeleteFromMapModal
                pending={{ action: 'Remove', label: 'Thorin', confirm: vi.fn() }}
                onCancel={vi.fn()}
                onConfirm={vi.fn()}
            />
        );
        const dialog = screen.getByRole('dialog', { name: 'Remove from Map' });
        expect(dialog).toHaveTextContent('Remove "Thorin" from the map?');
        expect(screen.getByRole('button', { name: 'Yes, Remove' })).toBeInTheDocument();
    });

    it('routes Cancel/Confirm clicks to the parent handlers', () => {
        const onCancel = vi.fn();
        const onConfirm = vi.fn();
        render(
            <DeleteFromMapModal
                pending={{ label: 'QA Marta', confirm: vi.fn() }}
                onCancel={onCancel}
                onConfirm={onConfirm}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Yes, Delete' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
