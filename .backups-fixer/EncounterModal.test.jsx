// @maintained-by-ai
/* Lane — EncounterModal internals: open-gate, save/load render surfaces, name input →
 * local state, Enter-submit, load-list sorting, delete-confirm seam from the MODAL side,
 * exact onSave/onLoad/onDelete payloads. The REAL formatEncounterName runs under test
 * (identity mock deleted): list names and the delete prompt show formatted names, so
 * pins cite it — formatEncounterName('dragon-lair') === 'Dragon Lair' while payloads
 * stay raw. MarkdownPreview is a lightweight stub (sanitize/markdown rendering is owned
 * by its own lane); this file only pins the `enc.description &&` conditional (:129).
 * KNOWN DEFECTS (#410, report-not-fix, pinned honestly here):
 *   1) :55 the modal confirms deletes itself; EncounterBuilder confirms first too, so
 *      users see two dialogs. Tests below pin the modal-side prompt ONLY — the
 *      builder-side confirm is owned by EncounterBuilder.uncovered-handlers.test.jsx.
 *   2) :95 the rename FORM renders only when prop mode==='rename', but the sole caller
 *      (EncounterBuilder.jsx:635, mode from useEncounterManagement) ever sets
 *      'save' | 'load' — :145's pen sets modal-local renameTarget which renders nothing.
 *      handleRename is dead in the prod UI, so no rename-mode tests live here.
 * The overlay (:61) has no onClick, so backdrop/content clicks structurally cannot
 * close — no vacuous "does not close" pins for them.
 * Owned elsewhere: builder Save-commit #399, load-hydrate #403, action seam #410. */
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

const createProps = (overrides = {}) => ({
    isOpen: true,
    onClose: mockOnClose,
    mode: 'save',
    onSave: mockOnSave,
    onLoad: mockOnLoad,
    onDelete: mockOnDelete,
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

    it('save mode renders the title, name input and Save button; Close fires onClose exactly once', () => {
        render(<EncounterModal {...createProps({ mode: 'save' })} />);
        expect(screen.getByRole('heading', { name: 'Save Encounter' })).toBeInTheDocument();
        expect(screen.getByLabelText('Encounter Name')).toHaveAttribute('placeholder', 'e.g., Goblin Ambush');
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('trims the name, saves it, resets the input, and closes the modal', async () => {
        render(<EncounterModal {...createProps({ mode: 'save' })} />);
        const input = screen.getByLabelText('Encounter Name');
        fireEvent.change(input, { target: { value: '  Goblin Ambush  ' } });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        });
        expect(mockOnSave).toHaveBeenCalledWith('Goblin Ambush');
        expect(input).toHaveValue('');
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('submits on Enter in the input but not on other keys', async () => {
        render(<EncounterModal {...createProps({ mode: 'save' })} />);
        const input = screen.getByLabelText('Encounter Name');
        fireEvent.change(input, { target: { value: 'Enter Save' } });
        await act(async () => {
            fireEvent.keyDown(input, { key: 'Enter' });
        });
        expect(mockOnSave).toHaveBeenCalledWith('Enter Save');
        expect(mockOnSave).toHaveBeenCalledTimes(1);
        mockOnSave.mockClear();
        fireEvent.keyDown(input, { key: 'a' });
        expect(mockOnSave).not.toHaveBeenCalled();
    });

    it.each(['', '   '])('shows an inline error for blank name "%s" and never saves or closes', (value) => {
        render(<EncounterModal {...createProps({ mode: 'save' })} />);
        fireEvent.change(screen.getByLabelText('Encounter Name'), { target: { value } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(screen.getByText('Encounter name is required')).toBeInTheDocument();
        expect(mockOnSave).not.toHaveBeenCalled();
        expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('load mode shows the loading state, then the empty state once fetched', () => {
        const { rerender } = render(<EncounterModal {...createProps({ mode: 'load', loading: true })} />);
        expect(screen.getByRole('heading', { name: 'Load Encounter' })).toBeInTheDocument();
        expect(screen.getByText('Loading...')).toBeInTheDocument();

        rerender(<EncounterModal {...createProps({ mode: 'load', loading: false, encounters: [] })} />);
        expect(screen.getByText('No saved encounters yet.')).toBeInTheDocument();
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
        const loadOrder = screen
            .getAllByRole('button', { name: /^Load / })
            .map((btn) => btn.getAttribute('aria-label'));
        expect(loadOrder).toEqual([
            'Load road-encounter',
            'Load old-map',
            'Load goblin-ambush',
            'Load forest-shrine',
            'Load dragon-lair',
        ]);
        // Real formatEncounterName: hyphenated raw name → title-cased display name.
        expect(screen.getByText('Dragon Lair')).toBeInTheDocument();
    });

    it('shows the thousands-separated XP label only when effectiveXP is present', () => {
        const encounters = [encounter('dragon-lair', { effectiveXP: 1500 }), encounter('old-map', { effectiveXP: null }), encounter('road-encounter')];
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

    it('calls onLoad with the raw encounter name when Load is clicked', () => {
        const encounters = [encounter('goblin-ambush'), encounter('dragon-lair')];
        render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Load dragon-lair' }));
        expect(mockOnLoad).toHaveBeenCalledTimes(1);
        expect(mockOnLoad).toHaveBeenCalledWith('dragon-lair');
    });

    // Modal-side pin of the double-confirm defect #410: the builder confirms BEFORE
    // calling onDelete, so users see this prompt as a SECOND dialog in prod.
    it('confirms deletes with the formatted name and calls onDelete with the raw name only when confirmed', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const encounters = [encounter('goblin-ambush'), encounter('dragon-lair')];
        render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Delete goblin-ambush' }));
        });
        expect(confirmSpy).toHaveBeenCalledWith('Delete "Goblin Ambush"?');
        expect(mockOnDelete).toHaveBeenCalledWith('goblin-ambush');

        confirmSpy.mockReturnValue(false);
        fireEvent.click(screen.getByRole('button', { name: 'Delete dragon-lair' }));
        expect(confirmSpy).toHaveBeenLastCalledWith('Delete "Dragon Lair"?');
        expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });
});
