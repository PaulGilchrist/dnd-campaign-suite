// @maintained-by-ai
/* Lane — overlay dismissal for the Save/Load EncounterModal (2026-11-02 BF
 * backlog: the full-screen z-1000 .encounter-modal-overlay swallowed EVERY
 * click incl. sidebar nav and ignored Escape until × was clicked). The modal
 * now follows the house Escape + backdrop pattern (DiceTray.jsx:42-48 keydown
 * listener, :73-80 closest()-guarded overlay click): both are pure onClose —
 * ×-parity, no onLoad/onDelete/onRename dispatch, no mutation. The rename
 * sub-form is an inline panel swap (not a dialog): × already closed the whole
 * modal from it, so Escape/backdrop do too. The only nested confirmation is
 * the native window.confirm on the delete leg, which blocks keydown/click
 * while shown — nothing to guard in JS. Controlled Host owns isOpen so the
 * overlay's UNMOUNT (the z-1000 interceptor leaving the DOM) is proven, not
 * just spy-called. Load/save/delete/rename action lanes stay in
 * EncounterModal.test.jsx + delete-close/rename-flow siblings. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
            onSave={mockOnSave}
            onLoad={mockOnLoad}
            onDelete={mockOnDelete}
            onRename={mockOnRename}
            encounters={[
                { name: 'goblin-ambush', effectiveXP: 100 },
                { name: 'dragon-lair', effectiveXP: 1500 },
            ]}
            loading={false}
        />
    );
}

const overlay = () => document.querySelector('.encounter-modal-overlay');

describe('EncounterModal — Escape and backdrop close the overlay (×-parity)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Escape closes the open Load modal: onClose once, overlay unmounts, zero action dispatch', () => {
        const { container } = render(<Host />);
        expect(container.querySelector('.encounter-modal-overlay')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.encounter-modal-overlay')).not.toBeInTheDocument();
        expect(mockOnLoad).not.toHaveBeenCalled();
        expect(mockOnDelete).not.toHaveBeenCalled();
        expect(mockOnRename).not.toHaveBeenCalled();
        expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('a backdrop click (overlay outside the panel) closes the same way: onClose once, overlay unmounts, zero action dispatch', () => {
        const { container } = render(<Host />);

        fireEvent.click(overlay());

        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.encounter-modal-overlay')).not.toBeInTheDocument();
        expect(mockOnLoad).not.toHaveBeenCalled();
        expect(mockOnDelete).not.toHaveBeenCalled();
        expect(mockOnRename).not.toHaveBeenCalled();
    });

    it('clicks bubbling from inside the panel are inert (list rows, header, close-button row)', () => {
        render(<Host />);

        fireEvent.click(screen.getByText('Goblin Ambush'));
        fireEvent.click(screen.getByRole('heading', { name: 'Load Encounter' }));

        expect(mockOnClose).not.toHaveBeenCalled();
        expect(overlay()).toBeInTheDocument();
    });

    it('non-Escape keys are inert', () => {
        render(<Host />);

        fireEvent.keyDown(document, { key: 'a' });
        fireEvent.keyDown(document, { key: 'Enter' });

        expect(mockOnClose).not.toHaveBeenCalled();
        expect(overlay()).toBeInTheDocument();
    });

    it('Escape still closes from the inline rename sub-form (×-parity: the whole modal closes, no rename dispatch)', () => {
        const { container } = render(<Host />);
        fireEvent.click(screen.getByRole('button', { name: 'Rename "goblin-ambush"' }));
        expect(screen.getByLabelText('New Name')).toBeInTheDocument();
        mockOnClose.mockClear();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.encounter-modal-overlay')).not.toBeInTheDocument();
        expect(mockOnRename).not.toHaveBeenCalled();
    });

    it('the keydown listener detaches on close — a late Escape never re-fires onClose', () => {
        render(<Host />);
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(overlay()).not.toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
});
