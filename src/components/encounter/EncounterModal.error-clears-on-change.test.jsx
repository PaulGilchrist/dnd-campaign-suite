// @maintained-by-ai
/* Lane — stale-inline-error clearing on the name change lane (2026-11-16 XB
 * QA backlog: after the Enter-key blank backstop printed
 * "Encounter name is required", the red copy STAYED while the user then typed
 * a valid name — Save re-enabled but the refusal lingered). Converged on the
 * maps generate-modal idiom (GenerateDungeonModal.jsx
 * `editName = (event) => { setError(null); setMapName(...) }`): any edit of
 * the field the error names removes the error NODE from the DOM (not just
 * CSS-hidden) the moment the change handler fires, while the existing
 * blank/whitespace Save-disable law and the Enter-key inline refusal stay
 * byte-identical. Disabled-gate family itself is owned by
 * EncounterModal.name-gate.test.jsx; this file owns only the error lifecycle
 * across the change lane, on both the save input (#encounter-name) and the
 * rename input (#encounter-rename, pen path and prop-mode arm). */
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

describe('EncounterModal — inline error clears on the name change lane (XB 2026-11-16)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('save mode (#encounter-name)', () => {
        it('blank-Enter prints the refusal, then typing a valid name removes the error node from the DOM and enables Save', async () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            const input = screen.getByLabelText('Encounter Name');
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(screen.getByText('Encounter name is required')).toBeInTheDocument();

            fireEvent.change(input, { target: { value: 'Goblin Ambush' } });
            expect(screen.queryByText('Encounter name is required')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
            expect(mockOnSave).not.toHaveBeenCalled();
            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('even a whitespace-only edit clears the stale error while Save stays disabled (blank-name law unchanged)', async () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            const input = screen.getByLabelText('Encounter Name');
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(screen.getByText('Encounter name is required')).toBeInTheDocument();

            fireEvent.change(input, { target: { value: '   ' } });
            expect(screen.queryByText('Encounter name is required')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
        });
    });

    describe('rename mode via pen (#encounter-rename, prod path)', () => {
        it('blank-Enter prints "New name is required", then typing a valid name removes the error node and re-enables Rename', async () => {
            const input = openRenameViaPen();
            fireEvent.change(input, { target: { value: '' } });
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(screen.getByText('New name is required')).toBeInTheDocument();

            fireEvent.change(input, { target: { value: 'Goblin Remix' } });
            expect(screen.queryByText('New name is required')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Rename' })).toBeEnabled();
            expect(mockOnRename).not.toHaveBeenCalled();
        });
    });

    describe('rename mode via prop (mode="rename" + renameTarget arm)', () => {
        it('a failed rename error also clears the moment the name field is edited', async () => {
            mockOnRename.mockRejectedValueOnce(new Error('Rename exploded'));
            render(
                <EncounterModal
                    {...createProps({ mode: 'rename', renameTarget: { name: 'old-prop', savedAt: '2024-01-01T00:00:00Z' } })}
                />
            );
            const input = screen.getByLabelText('New Name');
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
            });
            expect(screen.getByText('Rename exploded')).toBeInTheDocument();

            fireEvent.change(input, { target: { value: 'Retried Name' } });
            expect(screen.queryByText('Rename exploded')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Rename' })).toBeEnabled();
        });
    });
});
