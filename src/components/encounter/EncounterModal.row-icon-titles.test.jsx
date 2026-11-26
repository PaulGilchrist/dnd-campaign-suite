// @maintained-by-ai
/* Lane — Load-pool row hover affordance (2026-11-16 WK backlog): the icon-only
 * Rename (pen) and Delete (trash) buttons on encounter-list rows carry an
 * aria-label but historically NO title, so hover gave zero tooltip affordance
 * (unlike the modal family's titled icons). Pin: every row Rename/Delete icon
 * button's title mirrors its aria-label VERBATIM (`Rename "X"` / `Delete "X"`,
 * raw name — the sheet-family quoting canon in EncounterModal.test.jsx), and
 * the census is complete: no icon-only row button ships without a title while
 * the text-bearing Load button stays title-free (minimal-change pin — visible
 * text is already its own affordance). Click flows are re-pinned here only to
 * prove the title attribute changed nothing: pen still opens the seeded
 * #encounter-rename form, trash still opens the shared DeleteConfirmModal
 * (native window.confirm retired 2026-11-24). */
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

const encounter = (name) => ({ name, savedAt: '2024-01-01T00:00:00Z' });

const renderLoadPool = (encounters) =>
    render(
        <EncounterModal
            isOpen
            onClose={mockOnClose}
            mode="load"
            onSave={vi.fn()}
            onLoad={mockOnLoad}
            onDelete={mockOnDelete}
            onRename={mockOnRename}
            encounters={encounters}
            loading={false}
        />
    );

describe('EncounterModal load-pool row icon titles', () => {
    const encounters = [encounter('test-encounter'), encounter('dragon-lair')];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('every row Rename/Delete icon button carries a title mirroring its aria-label verbatim', () => {
        renderLoadPool(encounters);
        const iconButtons = encounters.flatMap((enc) => [
            screen.getByRole('button', { name: `Rename "${enc.name}"` }),
            screen.getByRole('button', { name: `Delete "${enc.name}"` }),
        ]);
        expect(iconButtons).toHaveLength(4);
        iconButtons.forEach((btn) => {
            expect(btn).toHaveAttribute('title', btn.getAttribute('aria-label'));
        });
        // Verbatim bytes (raw name in QUOTES), not just self-consistency.
        expect(screen.getByRole('button', { name: 'Rename "test-encounter"' })).toHaveAttribute(
            'title',
            'Rename "test-encounter"'
        );
        expect(screen.getByRole('button', { name: 'Delete "test-encounter"' })).toHaveAttribute(
            'title',
            'Delete "test-encounter"'
        );
    });

    it('census is complete: no icon-only row button lacks a title; the text-bearing Load button stays title-free', () => {
        renderLoadPool(encounters);
        const rows = document.querySelectorAll('.encounter-list-item');
        expect(rows).toHaveLength(2);
        rows.forEach((row) => {
            const buttons = Array.from(row.querySelectorAll('button'));
            // Load, Rename, Print, Delete — the full row action set
            // (Item 4 added the labeled Print verb).
            expect(buttons).toHaveLength(4);
            buttons.forEach((btn) => {
                const iconOnly = btn.textContent.trim() === '';
                if (iconOnly) {
                    // Rename/Delete: <i> only — title must mirror aria-label.
                    expect(btn).toHaveAttribute('title', btn.getAttribute('aria-label'));
                } else if (/^Load "/.test(btn.getAttribute('aria-label'))) {
                    // Load keeps visible text and gains no title (minimal change).
                    expect(btn).not.toHaveAttribute('title');
                } else {
                    // Print (Item 4): labeled verb; title mirrors aria-label like
                    // the icon tier (both name the raw quoted row).
                    expect(btn.getAttribute('aria-label')).toMatch(/^Print sheet for "/);
                    expect(btn).toHaveAttribute('title', btn.getAttribute('aria-label'));
                }
            });
        });
    });

    it('title changes nothing in the flows: pen still seeds #encounter-rename, trash still opens the in-app confirm dialog', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm');
        renderLoadPool(encounters);

        fireEvent.click(screen.getByRole('button', { name: 'Rename "test-encounter"' }));
        const input = screen.getByLabelText('New Name');
        expect(input).toHaveValue('test-encounter');
        expect(screen.getByRole('heading', { name: 'Rename Encounter' })).toBeInTheDocument();
        expect(mockOnRename).not.toHaveBeenCalled();

        // Back to the list for the delete leg (pen replaced it; blank-cancel would
        // error, so commit the rename to restore the rows).
        fireEvent.change(input, { target: { value: 'test-encounter' } });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
        });
        expect(mockOnRename).toHaveBeenCalledWith('test-encounter', 'test-encounter');

        fireEvent.click(screen.getByRole('button', { name: 'Delete "test-encounter"' }));
        expect(screen.getByRole('dialog', { name: 'Delete Encounter' })).toHaveTextContent('Test Encounter');
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(mockOnDelete).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
});
