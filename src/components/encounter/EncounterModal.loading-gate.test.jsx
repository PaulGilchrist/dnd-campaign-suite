// @maintained-by-ai
/* Lane — disabled-row-actions-while-loading gate in the Load modal
 * (QA 2026-10-24 night backlog: a synthetic pen click landing on a
 * just-reloaded row list could silently close the modal — the click hit a
 * stale node in the reload window and the queued onClose swallowed the
 * effect with zero feedback). EncounterModal now renders the row list DURING
 * a refresh with every row action natively `disabled` (native attribute: the
 * browser absorbs both synthetic and trusted clicks), and re-enables them the
 * moment loading clears. "Loading..."/empty placeholders still own the
 * zero-rows case. Hook side (useEncounterManagement.loadEncounterList /
 * openLoadModal) is pinned in ../../hooks/management/useEncounterManagement.test.js.
 * Owned here: disabled state during loading, click-absence during loading,
 * enabled + working actions after load resolves, placeholder when loading with
 * no rows. Action semantics (payload bytes, confirm copy, rename form,
 * close-on-success) stay in EncounterModal.test.jsx,
 * EncounterModal.delete-close.test.jsx and EncounterModal.rename-flow.test.jsx. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import EncounterModal from './EncounterModal.jsx';

vi.mock('../common/MarkdownPreview.jsx', () => ({
    default: ({ text }) => <div data-testid="markdown-preview">{text}</div>,
}));

const mockOnClose = vi.fn();
const mockOnLoad = vi.fn();
const mockOnDelete = vi.fn(() => Promise.resolve());
const mockOnRename = vi.fn(() => Promise.resolve());

const encounters = [
    { name: 'goblin-ambush', effectiveXP: 100 },
    { name: 'dragon-lair', effectiveXP: 1500 },
];

const createProps = (overrides = {}) => ({
    isOpen: true,
    onClose: mockOnClose,
    mode: 'load',
    onSave: vi.fn(() => Promise.resolve()),
    onLoad: mockOnLoad,
    onDelete: mockOnDelete,
    onRename: mockOnRename,
    encounters,
    loading: false,
    ...overrides,
});

// Every row action button across the list — Load + Rename + Delete per row.
const rowActionButtons = () =>
    encounters.flatMap((enc) => [
        screen.getByRole('button', { name: `Load ${enc.name}` }),
        screen.getByRole('button', { name: `Rename ${enc.name}` }),
        screen.getByRole('button', { name: `Delete ${enc.name}` }),
    ]);

describe('EncounterModal — row actions are disabled while the load list is loading', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders the rows during a refresh with ALL row actions natively disabled', () => {
        render(<EncounterModal {...createProps({ loading: true })} />);
        expect(screen.getByRole('heading', { name: 'Load Encounter' })).toBeInTheDocument();
        const buttons = rowActionButtons();
        expect(buttons).toHaveLength(6);
        buttons.forEach((btn) => {
            expect(btn).toBeDisabled();
            expect(btn).toHaveAttribute('disabled');
        });
    });

    it('clicks inside the loading window dispatch NOTHING and cannot close the modal', () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const { container } = render(<EncounterModal {...createProps({ loading: true })} />);

        fireEvent.click(screen.getByRole('button', { name: 'Load goblin-ambush' }));
        fireEvent.click(screen.getByRole('button', { name: 'Rename goblin-ambush' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete dragon-lair' }));

        expect(mockOnLoad).not.toHaveBeenCalled();
        expect(mockOnDelete).not.toHaveBeenCalled();
        expect(mockOnRename).not.toHaveBeenCalled();
        expect(confirmSpy).not.toHaveBeenCalled();
        // No rename form opened from the absorbed pen click…
        expect(screen.getByRole('heading', { name: 'Load Encounter' })).toBeInTheDocument();
        expect(screen.queryByLabelText('New Name')).not.toBeInTheDocument();
        // …and no silent close — the overlay survives every click.
        expect(mockOnClose).not.toHaveBeenCalled();
        expect(container.querySelector('.encounter-modal-overlay')).toBeInTheDocument();
    });

    it('the loading placeholder still owns the zero-rows case (no rows to disable)', () => {
        render(<EncounterModal {...createProps({ loading: true, encounters: [] })} />);
        expect(screen.getByText('Loading...')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Load / })).not.toBeInTheDocument();
        expect(screen.queryByText('No saved encounters yet.')).not.toBeInTheDocument();
    });

    it('once loading resolves every row action becomes enabled and works', async () => {
        const { rerender } = render(<EncounterModal {...createProps({ loading: true })} />);
        rowActionButtons().forEach((btn) => expect(btn).toBeDisabled());

        rerender(<EncounterModal {...createProps({ loading: false })} />);
        rowActionButtons().forEach((btn) => expect(btn).not.toBeDisabled());

        // Load dispatches with the raw name.
        fireEvent.click(screen.getByRole('button', { name: 'Load goblin-ambush' }));
        expect(mockOnLoad).toHaveBeenCalledTimes(1);
        expect(mockOnLoad).toHaveBeenCalledWith('goblin-ambush');

        // Delete reaches the named confirm (refused — form/list must survive).
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        fireEvent.click(screen.getByRole('button', { name: 'Delete goblin-ambush' }));
        expect(confirmSpy).toHaveBeenCalledWith('Delete "Goblin Ambush"?');
        expect(mockOnDelete).not.toHaveBeenCalled();

        // Pen opens the seeded rename form (last: the form replaces the list).
        fireEvent.click(screen.getByRole('button', { name: 'Rename dragon-lair' }));
        expect(screen.getByLabelText('New Name')).toHaveValue('dragon-lair');
    });

    it('delete commit still self-closes (d4da4ebc1 intact) with reload-window re-render in between', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        let resolveDelete;
        mockOnDelete.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveDelete = resolve;
                })
        );
        const { container, rerender } = render(<EncounterModal {...createProps({})} />);

        // Commit: parent's onDelete (DELETE + list reload) is pending. The
        // hook's reload sets loading=true — surviving rows re-render disabled.
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Delete goblin-ambush' }));
        });
        rerender(<EncounterModal {...createProps({ loading: true })} />);
        expect(screen.getByRole('button', { name: 'Rename dragon-lair' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Delete dragon-lair' })).toBeDisabled();

        // Reload resolves → onClose fires once, overlay gone.
        await act(async () => {
            resolveDelete();
        });
        expect(mockOnDelete).toHaveBeenCalledWith('goblin-ambush');
        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.encounter-modal-overlay')).toBeInTheDocument();
    });
});
