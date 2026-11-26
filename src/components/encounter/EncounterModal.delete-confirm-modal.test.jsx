// @maintained-by-ai 2026-11-24
/* Lane — pool-row DELETE on the shared DeleteConfirmModal a11y tier (QA backlog
 * 2026-11-24: the Load-picker row trash retired its native window.confirm, which
 * blocked the whole automation lane until handled and gave the destructive action
 * no initial-focus-safe default). The row trash now opens the same role="dialog"
 * confirm every sibling destructive lane rides (MapsManager's DeleteMapModal is
 * the mirrored pattern).
 * OWNED HERE: the leaf wiring — trash opens the dialog (never a native prompt),
 * the dialog names the encounter (display case), initial focus lands on Cancel,
 * Escape / backdrop / Cancel all dismiss ZERO-WRITE (Load overlay and row intact,
 * no onDelete, no onClose), confirming dispatches onDelete with the RAW name and
 * closes on success, and the dialog rides as a fragment SIBLING of
 * .ct-modal-overlay so its own backdrop never closes the Load picker underneath.
 * The shared dialog's internal machinery (Tab trap, aria plumbing) is owned by
 * common/DeleteConfirmModal.test.jsx + MapsManager.delete-a11y.test.jsx;
 * close-on-success/error copy stays in EncounterModal.delete-close.test.jsx. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import EncounterModal from './EncounterModal.jsx';

vi.mock('../common/MarkdownPreview.jsx', () => ({
    default: ({ text }) => <div data-testid="markdown-preview">{text}</div>,
}));

const mockOnClose = vi.fn();
const mockOnLoad = vi.fn();
const mockOnDelete = vi.fn(() => Promise.resolve());
const mockOnRename = vi.fn(() => Promise.resolve());

// Controlled host: closing the Load overlay requires onClose, so the
// dialog-only dismissals below are proven zero-write by the overlay SURVIVING.
function Host({ mode = 'load' }) {
    const [isOpen, setIsOpen] = useState(true);
    return (
        <EncounterModal
            isOpen={isOpen}
            onClose={() => {
                mockOnClose();
                setIsOpen(false);
            }}
            mode={mode}
            onSave={vi.fn(() => Promise.resolve())}
            onLoad={mockOnLoad}
            onDelete={mockOnDelete}
            onRename={mockOnRename}
            encounters={[
                { name: 'test-encounter', effectiveXP: 100 },
                { name: 'dragon-lair', effectiveXP: 1500 },
            ]}
            loading={false}
        />
    );
}

const dialogShellOverlay = () => document.querySelector('.modal-shell-overlay');

// A native confirm that FIRES during these lanes is a regression — make it loud.
function forbidNativeConfirm() {
    return vi.spyOn(window, 'confirm').mockImplementation(() => {
        throw new Error('native window.confirm fired on the pool-delete path');
    });
}

async function openDeleteDialog() {
    const utils = render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete "test-encounter"' }));
    return utils;
}

describe('EncounterModal — pool-row delete rides the shared DeleteConfirmModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockOnDelete.mockImplementation(() => Promise.resolve());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('the trash opens the shared dialog naming the encounter — no native confirm anywhere', async () => {
        const confirmSpy = forbidNativeConfirm();
        await openDeleteDialog();

        const dialog = screen.getByRole('dialog', { name: 'Delete Encounter' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialogShellOverlay()).toBeInTheDocument();
        // Display-cased name in the confirm copy (raw name only in the payload).
        expect(dialog).toHaveTextContent('Test Encounter');
        expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('initial focus lands on Cancel (the non-destructive default)', async () => {
        await openDeleteDialog();
        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });

    it('ESCAPE (focused Cancel, the real lane) dismisses the dialog zero-write: Load overlay and row intact, no onDelete, no onClose', async () => {
        const confirmSpy = forbidNativeConfirm();
        const { container } = await openDeleteDialog();

        // Real lane: focus starts on Cancel, so the trusted keydown targets
        // the panel — but the host consumes it at the document CAPTURE phase
        // (the mid-dispatch re-attach race guard) and stops it there. The
        // document-targeted lane is pinned too below.
        fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(mockOnDelete).not.toHaveBeenCalled();
        expect(mockOnClose).not.toHaveBeenCalled();
        expect(container.querySelector('.ct-modal-overlay')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete "test-encounter"' })).toBeInTheDocument();
        expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('Escape dispatched AT DOCUMENT (focus-stranded face, the live Playwright repro) still answers only the dialog', async () => {
        const { container } = await openDeleteDialog();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(mockOnDelete).not.toHaveBeenCalled();
        expect(mockOnClose).not.toHaveBeenCalled();
        expect(container.querySelector('.ct-modal-overlay')).toBeInTheDocument();
    });

    it('a pure BACKDROP click on the dialog dismisses it zero-write — and never reaches the Load overlay underneath', async () => {
        const { container } = await openDeleteDialog();

        // The dialog is a fragment sibling of .ct-modal-overlay: a click that
        // lands on its own backdrop must not bubble into the Load picker's
        // onClose (the shared overlay's .ct-modal guard would not recognize it).
        fireEvent.click(dialogShellOverlay());

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(mockOnDelete).not.toHaveBeenCalled();
        expect(mockOnClose).not.toHaveBeenCalled();
        expect(container.querySelector('.ct-modal-overlay')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete "test-encounter"' })).toBeInTheDocument();
    });

    it('the CANCEL button dismisses zero-write, same as Escape/backdrop', async () => {
        const { container } = await openDeleteDialog();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(mockOnDelete).not.toHaveBeenCalled();
        expect(mockOnClose).not.toHaveBeenCalled();
        expect(container.querySelector('.ct-modal-overlay')).toBeInTheDocument();
    });

    it('confirming dispatches onDelete with the RAW name once and unmounts both dialog and overlay', async () => {
        const confirmSpy = forbidNativeConfirm();
        const { container } = await openDeleteDialog();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Yes, Delete Permanently/i }));
        });

        expect(mockOnDelete).toHaveBeenCalledTimes(1);
        expect(mockOnDelete).toHaveBeenCalledWith('test-encounter');
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(dialogShellOverlay()).not.toBeInTheDocument();
        expect(container.querySelector('.ct-modal-overlay')).not.toBeInTheDocument();
    });

    it('Escape with NO dialog open still closes the whole Load overlay (×-parity preserved)', () => {
        const { container } = render(<Host />);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.ct-modal-overlay')).not.toBeInTheDocument();
    });
});
