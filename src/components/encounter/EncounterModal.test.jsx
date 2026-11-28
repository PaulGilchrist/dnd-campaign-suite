// @maintained-by-ai 2026-11-28
/* Lane — EncounterModal internals: the isOpen render gate, save-mode chrome smoke
 * (title + labelled input + placeholder), Enter-key commit in save mode, load-list
 * SORTING by effectiveXP (null/missing first) with verbatim quoted row aria labels,
 * real formatEncounterName display names ('dragon-lair' → 'Dragon Lair' while
 * payloads stay raw), the conditional thousands-separated XP label, the
 * `enc.description &&` preview arm, and the rename STATE lane: Enter dispatches the
 * commit exactly once with the trimmed payload, a successful commit restores the
 * list, and a second pen click re-seeds the OTHER row. The REAL formatEncounterName
 * runs under test (identity mock deleted). MarkdownPreview is a lightweight stub
 * (sanitize/markdown rendering is owned by its own lane); only the preview
 * conditional is pinned here.
 * Owned elsewhere — never re-pinned in this file:
 *   blank-name disable family (save + rename, click AND Enter lanes) —
 *     EncounterModal.name-gate.test.jsx; inline-error-clears-on-edit —
 *     EncounterModal.error-clears-on-change.test.jsx; loading/empty placeholder
 *     faces — EncounterModal.loading-gate.test.jsx + kit-chrome.test.jsx; Load
 *     click raw-payload dispatch — loading-gate, Load close-on-action —
 *     EncounterBuilder.load-close.test.jsx; delete gate (shared DeleteConfirmModal,
 *     formatted name in copy, raw payload, Cancel/Escape/backdrop zero-write, no
 *     native confirm) — EncounterModal.delete-confirm-modal.test.jsx, delete/rename
 *     close-on-success and failure copy — EncounterModal.delete-close.test.jsx;
 *     rename full-stack exact service bytes — EncounterModal.rename-flow.test.jsx;
 *     pen seed + click-commit payload — name-gate + delete-close; cancel-reopen
 *     reset — EncounterModal.rename-cancel-reset.test.jsx; Escape/backdrop ×-parity
 *     and the header Close button — EncounterModal.escape-backdrop-close.test.jsx;
 *     row icon title↔aria census — EncounterModal.row-icon-titles.test.jsx; print
 *     lane — EncounterModal.print-sheet.test.jsx. Builder side: Save-commit #399,
 *     load-hydrate #403, and the builder no-re-confirm pin lives in
 *     EncounterBuilder.delete-confirmation.test.jsx (the former
 *     EncounterBuilder.uncovered-handlers.test.jsx was deleted as vacuous in #2054 —
 *     stale pointer fixed here 2026-11-28).
 * The prop mode==='rename' + renameTarget arm has ZERO production callers (the sole
 * caller, EncounterBuilder via useEncounterManagement, ever passes 'save'|'load');
 * its seed/disable/error coverage stays in name-gate and error-clears-on-change and
 * is reported to the orchestrator as a no-legacy-policy cleanup candidate. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import EncounterModal from './EncounterModal.jsx';

vi.mock('../common/MarkdownPreview.jsx', () => ({
    default: ({ text }) => <div data-testid="markdown-preview">{text}</div>,
}));

const mockOnClose = vi.fn();
const mockOnSave = vi.fn(() => Promise.resolve());
const mockOnLoad = vi.fn();
const mockOnDelete = vi.fn();
const mockOnRename = vi.fn(() => Promise.resolve());

const createProps = (overrides = {}) => ({
    isOpen: true,
    onClose: mockOnClose,
    mode: 'save',
    onSave: mockOnSave,
    onLoad: mockOnLoad,
    onDelete: mockOnDelete,
    onRename: mockOnRename,
    encounters: [],
    loading: false,
    ...overrides,
});

const encounter = (name, overrides = {}) => ({
    name,
    savedAt: '2024-01-01T00:00:00Z',
    ...overrides,
});

describe('EncounterModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders nothing when isOpen is false', () => {
        render(<EncounterModal {...createProps({ isOpen: false })} />);
        expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('save mode renders the Save Encounter title, the labelled name input with its placeholder, and the Save button', () => {
        render(<EncounterModal {...createProps({ mode: 'save' })} />);
        expect(screen.getByRole('heading', { name: 'Save Encounter' })).toBeInTheDocument();
        expect(screen.getByLabelText('Encounter Name')).toHaveAttribute('placeholder', 'e.g., Goblin Ambush');
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('Enter in the name input commits the trimmed save exactly once; other keys never dispatch', async () => {
        render(<EncounterModal {...createProps({ mode: 'save' })} />);
        const input = screen.getByLabelText('Encounter Name');
        fireEvent.change(input, { target: { value: '  Enter Save  ' } });
        await act(async () => {
            fireEvent.keyDown(input, { key: 'Enter' });
        });
        expect(mockOnSave).toHaveBeenCalledTimes(1);
        expect(mockOnSave).toHaveBeenCalledWith('Enter Save');
        mockOnSave.mockClear();
        fireEvent.keyDown(input, { key: 'a' });
        expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('sorts the load list by effective XP ascending (null/missing sort first) and formats names', () => {
        const encounters = [
            encounter('dragon-lair', { effectiveXP: 1500 }),
            encounter('goblin-ambush', { effectiveXP: 100 }),
            encounter('road-encounter'),
            encounter('old-map', { effectiveXP: null }),
            encounter('forest-shrine', { effectiveXP: 100 }),
        ];
        render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
        // Verbatim quoting pin (sheet-family canon, 35777ab7f): row aria labels
        // name the encounter in QUOTES — the Load lane's accessible name here also
        // proves every row rendered; Rename/Delete/Print label census and the
        // title mirror live in row-icon-titles / delete-confirm-modal siblings.
        const loadOrder = screen
            .getAllByRole('button', { name: /^Load "/ })
            .map((btn) => btn.getAttribute('aria-label'));
        expect(loadOrder).toEqual([
            'Load "road-encounter"',
            'Load "old-map"',
            'Load "goblin-ambush"',
            'Load "forest-shrine"',
            'Load "dragon-lair"',
        ]);
        // Real formatEncounterName: hyphenated raw name → title-cased display name.
        expect(screen.getByText('Dragon Lair')).toBeInTheDocument();
    });

    it('shows the thousands-separated XP label only when effectiveXP is present', () => {
        const encounters = [
            encounter('dragon-lair', { effectiveXP: 1500 }),
            encounter('old-map', { effectiveXP: null }),
            encounter('road-encounter'),
        ];
        render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
        expect(screen.getByText('1,500 effective XP')).toBeInTheDocument();
        expect(screen.queryAllByText(/effective XP/)).toHaveLength(1);
    });

    it('renders a description preview only for encounters that have one', () => {
        const encounters = [
            encounter('with-desc', { description: 'Goblins near the road' }),
            encounter('no-desc'),
        ];
        render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
        expect(screen.getAllByTestId('markdown-preview')).toHaveLength(1);
        expect(screen.getByTestId('markdown-preview')).toHaveTextContent('Goblins near the road');
    });

    // The rename lane's state machine: Enter commits once (double-fire guard),
    // success clears renameTarget so the LIST returns, and the next pen re-seeds
    // from the freshly clicked row. Seed-open, click-commit payload/close, no-confirm
    // parity and blank-name refusal are pinned in name-gate / delete-close /
    // rename-flow siblings — only the list-restore + re-target chain is unique here.
    it('Enter submits the rename exactly once trimmed, restores the list, and a second pen click retargets the form to the freshly seeded name', async () => {
        const encounters = [
            encounter('goblin-ambush', { effectiveXP: 100 }),
            encounter('dragon-lair', { effectiveXP: 1500 }),
        ];
        render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Rename "goblin-ambush"' }));
        const input = screen.getByLabelText('New Name');
        expect(input).toHaveValue('goblin-ambush');
        fireEvent.change(input, { target: { value: '  Goblin Remix  ' } });
        await act(async () => {
            fireEvent.keyDown(input, { key: 'Enter' });
        });
        expect(mockOnRename).toHaveBeenCalledTimes(1);
        expect(mockOnRename).toHaveBeenCalledWith('goblin-ambush', 'Goblin Remix');
        // Success cleared renameTarget: the form yields and the list is back.
        expect(screen.queryByLabelText('New Name')).not.toBeInTheDocument();
        // Take the OTHER row's pen — it must seed from the fresh target, not a
        // stale first-rename value.
        fireEvent.click(screen.getByRole('button', { name: 'Rename "dragon-lair"' }));
        expect(screen.getByLabelText('New Name')).toHaveValue('dragon-lair');
    });
});
