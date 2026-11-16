// @maintained-by-ai
/* Lane — transient rename state resets on every dismiss lane
 * (bug-encounter-modal-rename-target-sticky: the Load-mode pen sets modal-local
 * renameTarget while the parent's mode prop stays 'load', and only a SUCCESSFUL
 * rename cleared it. Because the modal hides without unmounting
 * (`if (!isOpen) return null` keeps the instance — and its state — alive),
 * Escape/×/backdrop-cancelled renames stranded the target: the next toolbar
 * Load reopened straight into the Rename Encounter form with the load list
 * unreachable until a page reload). The fix clears renameTarget/newName/error
 * in the !isOpen branch of the dismissal effect. rerender() preserves component
 * state across isOpen flips, so it drives the exact prod hide-not-unmount lane;
 * the sibling escape-backdrop-close file owns the dismiss semantics themselves,
 * rename-flow owns the success dispatch, error-clears-on-change owns the
 * keystroke lane. This file owns ONLY the close→reopen state reset. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import EncounterModal from './EncounterModal.jsx';

vi.mock('../common/MarkdownPreview.jsx', () => ({
    default: ({ text }) => <div data-testid="markdown-preview">{text}</div>,
}));

const mockOnClose = vi.fn();
const mockOnSave = vi.fn(() => Promise.resolve());
const mockOnLoad = vi.fn();
const mockOnDelete = vi.fn(() => Promise.resolve());
const mockOnRename = vi.fn(() => Promise.resolve());

const createProps = (overrides = {}) => ({
    isOpen: true,
    onClose: mockOnClose,
    mode: 'load',
    onSave: mockOnSave,
    onLoad: mockOnLoad,
    onDelete: mockOnDelete,
    onRename: mockOnRename,
    encounters: [
        { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z' },
        { name: 'dragon-lair', savedAt: '2024-01-02T00:00:00Z' },
    ],
    loading: false,
    ...overrides,
});

// Pen on a load-list row opens the seeded rename form (production lane).
function openRenameViaPen() {
    fireEvent.click(screen.getByRole('button', { name: 'Rename "goblin-ambush"' }));
    expect(screen.getByRole('heading', { name: 'Rename Encounter' })).toBeInTheDocument();
    expect(screen.getByLabelText('New Name')).toHaveValue('goblin-ambush');
}

// Reopened Load modal: list visible, rename form and stale error gone.
function expectLoadList() {
    expect(screen.getByRole('heading', { name: 'Load Encounter' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Rename Encounter' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('New Name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load "goblin-ambush"' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load "dragon-lair"' })).toBeInTheDocument();
}

describe('EncounterModal — cancelled rename resets transient state across close/reopen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    for (const [label, dismiss] of [
        ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
        ['close button', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
        ['backdrop click', () => fireEvent.click(document.querySelector('.encounter-modal-overlay'))],
    ]) {
        it(`pen → ${label} cancel → reopen in load mode renders the list, not the rename form`, () => {
            const { rerender } = render(<EncounterModal {...createProps()} />);
            openRenameViaPen();

            dismiss();
            expect(mockOnClose).toHaveBeenCalledTimes(1);
            // Parent lane: modal hides but the component instance survives (prod).
            rerender(<EncounterModal {...createProps({ isOpen: false })} />);

            rerender(<EncounterModal {...createProps()} />);
            expectLoadList();
            // Dismiss never dispatches a rename (×-parity law unchanged).
            expect(mockOnRename).not.toHaveBeenCalled();
        });
    }

    it('a stale error from a failed rename does not leak into the reopened list', async () => {
        mockOnRename.mockRejectedValueOnce(new Error('An encounter with this name already exists'));
        const { rerender } = render(<EncounterModal {...createProps()} />);
        openRenameViaPen();
        fireEvent.change(screen.getByLabelText('New Name'), { target: { value: 'dragon-lair' } });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
        });
        expect(screen.getByText('An encounter with this name already exists')).toBeInTheDocument();
        expect(mockOnClose).not.toHaveBeenCalled(); // failure keeps the modal open for retry

        fireEvent.keyDown(document, { key: 'Escape' });
        rerender(<EncounterModal {...createProps({ isOpen: false })} />);
        rerender(<EncounterModal {...createProps()} />);

        expectLoadList();
        expect(screen.queryByText('An encounter with this name already exists')).not.toBeInTheDocument();
    });
});
