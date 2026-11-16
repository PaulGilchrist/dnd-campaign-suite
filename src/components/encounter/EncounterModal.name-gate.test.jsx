// @maintained-by-ai
/* Lane — name-gate validation family (2026-11-16 QA backlog: NPC/Quest modals
 * DISABLE Save on an empty/whitespace-only name while EncounterModal left it
 * enabled and refused inline after press; converged on the disabled majority:
 * NPCs.jsx `disabled={saving || !formData.name.trim()}`, Quests.jsx
 * `saveDisabled: saving || !formData.name.trim() || ...`).
 * OWNED HERE: both commit buttons (save-mode `#encounter-name`, rename-mode
 * `#encounter-rename` via the production pen path AND the prop-mode arm) are
 * disabled while the name is blank and enable the instant a non-blank name is
 * typed; the Enter-key lane keeps the inline refusal reachable (the disabled
 * button only absorbs the click lane — Enter never persists a blank); and a
 * non-blank commit through the enabled button is byte-identical to the old
 * flow (trimmed payload, modal close). Zero-monsters toolbar gate
 * (`.encounter-modal-error` "Encounter has no monsters to save") is a
 * different gate owned by EncounterBuilder.empty-save-gate.test.jsx. Modal
 * internals beyond the gate (list sorting, delete confirm, Escape/backdrop)
 * stay in EncounterModal.test.jsx / escape-backdrop-close.test.jsx. */
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
    encounters: [
        { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z' },
        { name: 'dragon-lair', savedAt: '2024-01-02T00:00:00Z' },
    ],
    loading: false,
    ...overrides,
});

// Production rename entry point: pen on a load-list row seeds the form.
function openRenameViaPen() {
    render(<EncounterModal {...createProps({ mode: 'load' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename "goblin-ambush"' }));
    return screen.getByLabelText('New Name');
}

describe('EncounterModal — name-gate disabled family (2026-11-16 convergence)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('create mode (#encounter-name)', () => {
        it('Save is disabled on mount, on empty and whitespace-only names, and enables the instant a non-blank name is typed', () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            const input = screen.getByLabelText('Encounter Name');
            const save = screen.getByRole('button', { name: 'Save' });
            expect(save).toBeDisabled();

            fireEvent.change(input, { target: { value: '   ' } });
            expect(save).toBeDisabled();

            fireEvent.change(input, { target: { value: 'Goblin Ambush' } });
            expect(save).toBeEnabled();

            // Back to blank — the gate tracks the live value, whitespace included.
            fireEvent.change(input, { target: { value: ' \t ' } });
            expect(save).toBeDisabled();
        });

        it('Enter on a whitespace-only name is the inline-refusal lane: error shown, no dispatch, modal held (guard reachability pin)', async () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: '  ' } });
            expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(screen.getByText('Encounter name is required')).toBeInTheDocument();
            expect(mockOnSave).not.toHaveBeenCalled();
            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('a non-blank commit through the now-enabled button is unchanged: trimmed payload, close once', async () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: '  Goblin Ambush  ' } });
            const save = screen.getByRole('button', { name: 'Save' });
            expect(save).toBeEnabled();
            await act(async () => {
                fireEvent.click(save);
            });
            expect(mockOnSave).toHaveBeenCalledTimes(1);
            expect(mockOnSave).toHaveBeenCalledWith('Goblin Ambush');
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('rename mode via pen (#encounter-rename, prod path)', () => {
        it('pre-seeded name keeps Rename enabled; clearing to empty or whitespace disables it; retyping re-enables', () => {
            const input = openRenameViaPen();
            const rename = screen.getByRole('button', { name: 'Rename' });
            expect(input).toHaveValue('goblin-ambush');
            expect(rename).toBeEnabled();

            fireEvent.change(input, { target: { value: '' } });
            expect(rename).toBeDisabled();

            fireEvent.change(input, { target: { value: '   ' } });
            expect(rename).toBeDisabled();

            fireEvent.change(input, { target: { value: 'Goblin Remix' } });
            expect(rename).toBeEnabled();
        });

        it('Enter on a blank rename field shows the inline refusal, never dispatches, form stays open (guard reachability pin)', async () => {
            const input = openRenameViaPen();
            fireEvent.change(input, { target: { value: '  ' } });
            expect(screen.getByRole('button', { name: 'Rename' })).toBeDisabled();
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(screen.getByText('New name is required')).toBeInTheDocument();
            expect(mockOnRename).not.toHaveBeenCalled();
            expect(screen.getByLabelText('New Name')).toBeInTheDocument();
        });

        it('a non-blank commit through the enabled button is unchanged: onRename(old, trimmed) once, close once', async () => {
            const input = openRenameViaPen();
            fireEvent.change(input, { target: { value: '  Goblin Remix  ' } });
            const rename = screen.getByRole('button', { name: 'Rename' });
            expect(rename).toBeEnabled();
            await act(async () => {
                fireEvent.click(rename);
            });
            expect(mockOnRename).toHaveBeenCalledTimes(1);
            expect(mockOnRename).toHaveBeenCalledWith('goblin-ambush', 'Goblin Remix');
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('rename mode via prop (mode="rename" + renameTarget arm)', () => {
        it('the prop-mode rename button follows the same disable family', () => {
            render(
                <EncounterModal
                    {...createProps({ mode: 'rename', renameTarget: { name: 'old-prop', savedAt: '2024-01-01T00:00:00Z' } })}
                />
            );
            const input = screen.getByLabelText('New Name');
            const rename = screen.getByRole('button', { name: 'Rename' });
            expect(input).toHaveValue('old-prop');
            expect(rename).toBeEnabled();

            fireEvent.change(input, { target: { value: '   ' } });
            expect(rename).toBeDisabled();

            fireEvent.change(input, { target: { value: 'New Prop' } });
            expect(rename).toBeEnabled();
        });
    });
});
