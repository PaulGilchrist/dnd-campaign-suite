// @maintained-by-ai
/* Lane — close-on-success for the Load-mode delete leg (QA 2026-10-24 backlog: EB
 * Load-modal stayed open after a successful in-modal Delete — row vanished, modal
 * persisted; the quest-edit-modal twin was fixed in 752a00c43, this surface missed).
 * EncounterModal.handleDelete now closes after onDelete resolves and shows
 * .encounter-modal-error when it rejects — the SAME shape as the quest fix
 * (close + setError(null) on success, setError(message) on failure) and the modal's
 * own save leg (:40-42). Layer verdict: the modal owns the delete confirm + error
 * surface, and the parent chain (EncounterBuilder.handleDeleteEncounter →
 * useEncounterManagement.handleDelete) reloads the list before resolving and rethrows
 * on non-2xx/network error (encountersService.deleteEncounter), so await-resolved
 * here genuinely means server-confirmed success.
 * A controlled Host owns isOpen so onClose-driven UNMOUNT of the overlay is proven,
 * not just spy-called. Owned here: close-on-success, stay-open-on-refuse with zero
 * onDelete dispatch, stay-open-with-error-on-failure, save/rename legs byte-identical
 * (save still closes, rename still never closes). Confirm-text/sorting/single-confirm
 * ownership stays in EncounterModal.test.jsx + delete-confirmation.test.jsx. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
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

// Controlled host: the overlay leaves the DOM only when the modal fires onClose.
function Host({ mode = 'load', overrides = {} }) {
    const [isOpen, setIsOpen] = useState(true);
    return (
        <EncounterModal
            isOpen={isOpen}
            onClose={() => {
                mockOnClose();
                setIsOpen(false);
            }}
            mode={mode}
            onSave={mockOnSave}
            onLoad={mockOnLoad}
            onDelete={mockOnDelete}
            onRename={mockOnRename}
            encounters={[
                { name: 'goblin-ambush', effectiveXP: 100 },
                { name: 'dragon-lair', effectiveXP: 1500 },
            ]}
            loading={false}
            {...overrides}
        />
    );
}

describe('EncounterModal — delete closes the Load modal on success only', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockOnDelete.mockImplementation(() => Promise.resolve());
        mockOnSave.mockImplementation(() => Promise.resolve());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('a confirmed SUCCESSFUL delete unmounts .encounter-modal-overlay with no manual Close click', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const { container } = render(<Host />);
        expect(container.querySelector('.encounter-modal-overlay')).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Delete goblin-ambush' }));
        });

        expect(confirmSpy).toHaveBeenCalledWith('Delete "Goblin Ambush"?');
        expect(mockOnDelete).toHaveBeenCalledTimes(1);
        expect(mockOnDelete).toHaveBeenCalledWith('goblin-ambush');
        expect(container.querySelector('.encounter-modal-overlay')).not.toBeInTheDocument();
    });

    it('REFUSING the named confirm keeps the modal open, the row present, and fires zero DELETE dispatches', () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const { container } = render(<Host />);

        fireEvent.click(screen.getByRole('button', { name: 'Delete goblin-ambush' }));

        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(confirmSpy).toHaveBeenCalledWith('Delete "Goblin Ambush"?');
        expect(mockOnDelete).not.toHaveBeenCalled();
        expect(mockOnClose).not.toHaveBeenCalled();
        expect(container.querySelector('.encounter-modal-overlay')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete goblin-ambush' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Load Encounter' })).toBeInTheDocument();
    });

    it('a FAILED delete (onDelete rejects) keeps the modal open showing .encounter-modal-error and never closes', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockOnDelete.mockRejectedValueOnce(new Error('Server said no'));
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const { container } = render(<Host />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Delete goblin-ambush' }));
        });

        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(mockOnDelete).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.encounter-modal-overlay')).toBeInTheDocument();
        const err = container.querySelector('.encounter-modal-error');
        expect(err).toBeInTheDocument();
        expect(err).toHaveTextContent('Server said no');
        expect(mockOnClose).not.toHaveBeenCalled();
        // Row still offered (server truth unchanged) with the OTHER row intact.
        expect(screen.getByRole('button', { name: 'Delete goblin-ambush' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete dragon-lair' })).toBeInTheDocument();
    });

    it('a network-shaped rejection with no message falls back to the generic delete error copy', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockOnDelete.mockRejectedValueOnce(new Error(''));
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const { container } = render(<Host />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Delete dragon-lair' }));
        });

        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.encounter-modal-error')).toHaveTextContent(
            'Failed to delete encounter'
        );
        expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('save leg unchanged: successful save still clears the input and closes the modal', async () => {
        const { container } = render(<Host mode="save" overrides={{ encounters: [] }} />);
        fireEvent.change(screen.getByLabelText('Encounter Name'), { target: { value: 'New Cave' } });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        });
        expect(mockOnSave).toHaveBeenCalledWith('New Cave');
        expect(mockOnSave).toHaveBeenCalledTimes(1);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.encounter-modal-overlay')).not.toBeInTheDocument();
    });

    it('rename leg unchanged: commit dispatches onRename, restores the list, and never closes the modal', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        render(<Host />);
        fireEvent.click(screen.getByRole('button', { name: 'Rename goblin-ambush' }));
        fireEvent.change(screen.getByLabelText('New Name'), { target: { value: 'Goblin Remix' } });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
        });
        expect(mockOnRename).toHaveBeenCalledWith('goblin-ambush', 'Goblin Remix');
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(mockOnClose).not.toHaveBeenCalled();
        expect(screen.getByRole('heading', { name: 'Load Encounter' })).toBeInTheDocument();
    });
});
