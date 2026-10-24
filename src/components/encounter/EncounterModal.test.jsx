// @maintained-by-ai
/* Lane — EncounterModal internals: open-gate, save/load render surfaces, name input →
 * local state, Enter-submit, load-list sorting, delete-confirm seam from the MODAL side,
 * exact onSave/onLoad/onDelete payloads. The REAL formatEncounterName runs under test
 * (identity mock deleted): list names and the delete prompt show formatted names, so
 * pins cite it — formatEncounterName('dragon-lair') === 'Dragon Lair' while payloads
 * stay raw. MarkdownPreview is a lightweight stub (sanitize/markdown rendering is owned
 * by its own lane); this file only pins the `enc.description &&` conditional (:129).
 * KNOWN DEFECTS (#410) — status:
 *   1) FIXED fix#410 2026-10-22: :55 is now the SINGLE owner of the delete confirm.
 *      EncounterBuilder.handleDeleteEncounter used to confirm again with the raw name
 *      (two stacked dialogs per click); it is a straight dispatcher now. The
 *      full-stack one-dialog-per-click pin lives in
 *      EncounterBuilder.delete-confirmation.test.jsx; the builder no-re-confirm pin
 *      lives in EncounterBuilder.uncovered-handlers.test.jsx.
 *   2) FIXED fix#38 2026-10-22: :95 the rename FORM rendered only when prop
 *      mode==='rename', but the sole caller (EncounterBuilder.jsx:647, mode from
 *      useEncounterManagement — ever only 'save' | 'load') never set it, so :145's
 *      pen set modal-local renameTarget which rendered nothing: handleRename dead in
 *      the prod UI (pre-fix unreachable captured verbatim pass #410). Repair is the
 *      render-side link the b0cab1579 pen+local-state+handler trio was designed with:
 *      form (and seeded input) now also render on local renameTarget; the prop
 *      mode==='rename' arm is preserved byte-equivalent for renameTargetProp consumers.
 *      Prod-path pins below; full-stack campaign-exact bytes in
 *      EncounterModal.rename-flow.test.jsx; rename stays no-confirm (fix#36 sibling
 *      parity, builder handleRenameEncounter is a straight dispatcher).
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
const mockOnRename = vi.fn(() => Promise.resolve());

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

    // Fix#410: this modal-side prompt at :55 is the ONLY delete dialog — the leaf
    // owns confirmation (house pattern); the builder's duplicate raw-name guard is gone.
    it('confirms deletes with the formatted name and calls onDelete with the raw name only when confirmed', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const encounters = [encounter('goblin-ambush'), encounter('dragon-lair')];
        render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Delete goblin-ambush' }));
        });
        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(confirmSpy).toHaveBeenCalledWith('Delete "Goblin Ambush"?');
        expect(mockOnDelete).toHaveBeenCalledWith('goblin-ambush');

        confirmSpy.mockReturnValue(false);
        fireEvent.click(screen.getByRole('button', { name: 'Delete dragon-lair' }));
        expect(confirmSpy).toHaveBeenLastCalledWith('Delete "Dragon Lair"?');
        expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    // ── fix#38 (#410): the pen at :145 is the production rename entry point.
    // These render with EXACTLY the props the sole caller passes (mode 'load' from
    // useEncounterManagement — never 'rename'): the pre-fix gate rendered nothing
    // here (captured verbatim pre-fix: form absent, onRename never called).
    describe('rename prod path — pen sets local renameTarget (fix#38)', () => {
        const renameEncounters = () => [
            encounter('goblin-ambush', { effectiveXP: 100 }),
            encounter('dragon-lair', { effectiveXP: 1500 }),
        ];

        it('pen click in load mode opens the rename form pre-seeded with the raw name, titled Rename Encounter, list yielding', () => {
            render(<EncounterModal {...createProps({ mode: 'load', encounters: renameEncounters(), onRename: mockOnRename })} />);
            fireEvent.click(screen.getByRole('button', { name: 'Rename goblin-ambush' }));
            expect(screen.getByRole('heading', { name: 'Rename Encounter' })).toBeInTheDocument();
            expect(screen.queryByRole('heading', { name: 'Load Encounter' })).not.toBeInTheDocument();
            const input = screen.getByLabelText('New Name');
            expect(input).toHaveValue('goblin-ambush');
            expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
            // Form replaces the list; handleRename's setRenameTarget(null) restores it.
            expect(screen.queryByRole('button', { name: 'Load dragon-lair' })).not.toBeInTheDocument();
            expect(mockOnRename).not.toHaveBeenCalled();
        });

        it('submit dispatches onRename(old, new.trim()) exactly once, closes the modal, confirms nothing', async () => {
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
            render(<EncounterModal {...createProps({ mode: 'load', encounters: renameEncounters(), onRename: mockOnRename })} />);
            fireEvent.click(screen.getByRole('button', { name: 'Rename dragon-lair' }));
            fireEvent.change(screen.getByLabelText('New Name'), { target: { value: '  Goblin Remix  ' } });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
            });
            expect(mockOnRename).toHaveBeenCalledTimes(1);
            expect(mockOnRename).toHaveBeenCalledWith('dragon-lair', 'Goblin Remix');
            // Rename lane is no-confirm: straight dispatch (fix#36 delete-ownership sibling parity).
            expect(confirmSpy).not.toHaveBeenCalled();
            // 2026-10-24 QA backlog: rename now mirrors the delete lane (d4da4ebc1) —
            // once the parent's awaited rename resolves, the modal fires onClose once.
            expect(mockOnClose).toHaveBeenCalledTimes(1);
            expect(mockOnDelete).not.toHaveBeenCalled();
        });

        it('Enter submits the rename exactly once and trims', async () => {
            render(<EncounterModal {...createProps({ mode: 'load', encounters: renameEncounters(), onRename: mockOnRename })} />);
            fireEvent.click(screen.getByRole('button', { name: 'Rename goblin-ambush' }));
            const input = screen.getByLabelText('New Name');
            fireEvent.change(input, { target: { value: '  Goblin Remix  ' } });
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(mockOnRename).toHaveBeenCalledTimes(1);
            expect(mockOnRename).toHaveBeenCalledWith('goblin-ambush', 'Goblin Remix');
            expect(screen.queryByLabelText('New Name')).not.toBeInTheDocument();
        });

        it.each(['', '   '])('blank new name "%s" shows the inline error, never dispatches, form stays open', async (value) => {
            render(<EncounterModal {...createProps({ mode: 'load', encounters: renameEncounters(), onRename: mockOnRename })} />);
            fireEvent.click(screen.getByRole('button', { name: 'Rename goblin-ambush' }));
            fireEvent.change(screen.getByLabelText('New Name'), { target: { value } });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
            });
            expect(screen.getByText('New name is required')).toBeInTheDocument();
            expect(mockOnRename).not.toHaveBeenCalled();
            expect(screen.getByLabelText('New Name')).toBeInTheDocument();
        });

        it('a second pen click after commit retargets the form to the freshly seeded name', async () => {
            render(<EncounterModal {...createProps({ mode: 'load', encounters: renameEncounters(), onRename: mockOnRename })} />);
            fireEvent.click(screen.getByRole('button', { name: 'Rename goblin-ambush' }));
            fireEvent.change(screen.getByLabelText('New Name'), { target: { value: 'First Rename' } });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
            });
            expect(mockOnRename).toHaveBeenCalledWith('goblin-ambush', 'First Rename');
            // List restored; take the OTHER row's pen this time.
            fireEvent.click(screen.getByRole('button', { name: 'Rename dragon-lair' }));
            expect(screen.getByLabelText('New Name')).toHaveValue('dragon-lair');
        });
    });

    // Prop-mode arm preserved byte-equivalent by fix#38 (no prod caller uses it —
    // consumer census: EncounterBuilder passes 'save'|'load' only). Prop key is
    // renameTarget, destructured to the renameTargetProp alias at :6.
    it('prop mode="rename" + renameTarget prop still renders the seeded form and dispatches with the prop name (:51 precedence intact)', async () => {
        render(
            <EncounterModal
                {...createProps({
                    mode: 'rename',
                    renameTarget: encounter('old-prop'),
                    onRename: mockOnRename,
                })}
            />
        );
        expect(screen.getByRole('heading', { name: 'Rename Encounter' })).toBeInTheDocument();
        expect(screen.getByLabelText('New Name')).toHaveValue('old-prop');
        fireEvent.change(screen.getByLabelText('New Name'), { target: { value: 'New Prop' } });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
        });
        expect(mockOnRename).toHaveBeenCalledTimes(1);
        expect(mockOnRename).toHaveBeenCalledWith('old-prop', 'New Prop');
    });
});
