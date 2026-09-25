// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import EncounterModal from './EncounterModal.jsx';

vi.mock('../../services/encounters/encountersService.js', () => ({
    formatEncounterName: vi.fn((name) => name),
}));

vi.mock('../common/MarkdownPreview.jsx', () => ({
    default: ({ text }) => <div data-testid="markdown-preview">{text}</div>,
}));

const mockOnClose = vi.fn();
const mockOnSave = vi.fn();
const mockOnLoad = vi.fn();
const mockOnDelete = vi.fn();
const mockOnRename = vi.fn();

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

    describe('rendering', () => {
        it('renders nothing when isOpen is false', () => {
            render(<EncounterModal {...createProps({ isOpen: false })} />);
            expect(screen.queryByRole('heading')).not.toBeInTheDocument();
        });

        it.each(['save', 'load', 'rename'])('renders the "%s" mode title', (mode) => {
            render(<EncounterModal {...createProps({ mode })} />);
            const title = `${mode.charAt(0).toUpperCase() + mode.slice(1)} Encounter`;
            expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
        });

        it('closes when the close button is clicked but not when the backdrop is clicked', () => {
            const { container } = render(<EncounterModal {...createProps()} />);
            fireEvent.click(container.querySelector('.encounter-modal-overlay'));
            expect(mockOnClose).not.toHaveBeenCalled();
            expect(container.querySelector('.encounter-modal')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Close' }));
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('does not close when clicking content inside the modal', () => {
            render(<EncounterModal {...createProps()} />);
            fireEvent.click(screen.getByRole('heading', { name: 'Save Encounter' }));
            expect(mockOnClose).not.toHaveBeenCalled();
        });
    });

    describe('Save mode', () => {
        it('renders the name input and save button', () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            expect(screen.getByLabelText('Encounter Name')).toHaveAttribute('placeholder', 'e.g., Goblin Ambush');
            expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
        });

        it('trims, saves, resets the input, and closes the modal on save', async () => {
            const onSave = vi.fn(() => Promise.resolve());
            render(<EncounterModal {...createProps({ mode: 'save', onSave })} />);
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: '  Goblin Ambush  ' } });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Save' }));
            });
            expect(onSave).toHaveBeenCalledWith('Goblin Ambush');
            await waitFor(() => {
                expect(input).toHaveValue('');
                expect(mockOnClose).toHaveBeenCalled();
            });
        });

        it('saves when Enter is pressed and does not save for other keys', async () => {
            const onSave = vi.fn(() => Promise.resolve());
            render(<EncounterModal {...createProps({ mode: 'save', onSave })} />);
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: 'Enter Save' } });
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(onSave).toHaveBeenCalledWith('Enter Save');
            onSave.mockClear();
            fireEvent.change(input, { target: { value: 'Test' } });
            fireEvent.keyDown(input, { key: 'a' });
            expect(onSave).not.toHaveBeenCalled();
        });

        it.each(['', '   '])('does not save and shows an error when the name is "%s"', (value) => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value } });
            fireEvent.click(screen.getByRole('button', { name: 'Save' }));
            expect(screen.getByText('Encounter name is required')).toBeInTheDocument();
            expect(mockOnSave).not.toHaveBeenCalled();
            expect(mockOnClose).not.toHaveBeenCalled();
        });
    });

    describe('Load mode', () => {
        it('shows a loading message while encounters are being fetched', () => {
            render(<EncounterModal {...createProps({ mode: 'load', loading: true })} />);
            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        it('shows an empty state when no encounters have been saved', () => {
            render(<EncounterModal {...createProps({ mode: 'load' })} />);
            expect(screen.getByText('No saved encounters yet.')).toBeInTheDocument();
        });

        it('lists encounters sorted by effective XP ascending', () => {
            const encounters = [
                encounter('high-xp', { effectiveXP: 500 }),
                encounter('low-xp', { effectiveXP: 100 }),
                encounter('no-xp'),
                encounter('first-100', { effectiveXP: 100 }),
                encounter('first-50', { effectiveXP: 50 }),
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            const listItems = screen.getAllByRole('listitem');
            const names = listItems.map((li) => li.querySelector('.encounter-list-name').textContent);
            expect(names).toEqual(['no-xp', 'first-50', 'low-xp', 'first-100', 'high-xp']);
        });

        it('shows the formatted XP label when effectiveXP is present', () => {
            const encounters = [encounter('goblin-ambush', { effectiveXP: 1500 })];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            expect(screen.getByText(`${(1500).toLocaleString()} effective XP`)).toBeInTheDocument();
        });

        it('hides the XP label when effectiveXP is null or missing', () => {
            const encounters = [encounter('null-xp', { effectiveXP: null }), encounter('missing-xp')];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            expect(screen.queryByText(/effective XP/)).not.toBeInTheDocument();
        });

        it('renders the description as markdown only when one is present', () => {
            const encounters = [
                encounter('with-desc', { description: 'Goblins near the road' }),
                encounter('no-desc'),
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            expect(screen.getAllByTestId('markdown-preview')).toHaveLength(1);
            expect(screen.getByTestId('markdown-preview')).toHaveTextContent('Goblins near the road');
        });

        it('calls onLoad with the selected encounter name when load is clicked', () => {
            const encounters = [encounter('goblin-ambush'), encounter('dragon-lair')];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            fireEvent.click(screen.getByRole('button', { name: 'Load dragon-lair' }));
            expect(mockOnLoad).toHaveBeenCalledTimes(1);
            expect(mockOnLoad).toHaveBeenCalledWith('dragon-lair');
        });

        it('calls onDelete after confirmation using the formatted name in the prompt', async () => {
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
            render(<EncounterModal {...createProps({ mode: 'load', encounters: [encounter('goblin-ambush')] })} />);
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Delete goblin-ambush' }));
            });
            expect(confirmSpy).toHaveBeenCalledWith('Delete "goblin-ambush"?');
            expect(mockOnDelete).toHaveBeenCalledWith('goblin-ambush');
        });

        it('does not delete when confirmation is cancelled', () => {
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
            render(<EncounterModal {...createProps({ mode: 'load', encounters: [encounter('goblin-ambush')] })} />);
            fireEvent.click(screen.getByRole('button', { name: 'Delete goblin-ambush' }));
            expect(confirmSpy).toHaveBeenCalled();
            expect(mockOnDelete).not.toHaveBeenCalled();
        });
    });

    describe('Rename mode', () => {
        it('renders the new name input and rename button', () => {
            render(<EncounterModal {...createProps({ mode: 'rename', renameTarget: { name: 'old-name' } })} />);
            expect(screen.getByLabelText('New Name')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
        });

        it('pre-fills the new name input when renameTarget is provided', () => {
            render(<EncounterModal {...createProps({ mode: 'rename', renameTarget: { name: 'old-name' } })} />);
            expect(screen.getByLabelText('New Name')).toHaveValue('old-name');
        });

        it('does not rename and shows an error when the new name is empty', () => {
            render(<EncounterModal {...createProps({ mode: 'rename', renameTarget: { name: 'old-name' } })} />);
            const input = screen.getByLabelText('New Name');
            fireEvent.change(input, { target: { value: '   ' } });
            fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
            expect(screen.getByText('New name is required')).toBeInTheDocument();
            expect(mockOnRename).not.toHaveBeenCalled();
        });

        it('calls onRename with the old and new names and resets the input', async () => {
            render(<EncounterModal {...createProps({ mode: 'rename', renameTarget: { name: 'old-name' } })} />);
            const input = screen.getByLabelText('New Name');
            fireEvent.change(input, { target: { value: 'New Name' } });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
            });
            await waitFor(() => {
                expect(mockOnRename).toHaveBeenCalledWith('old-name', 'New Name');
                expect(input).toHaveValue('');
            });
        });

        it('renames when Enter is pressed in the input', async () => {
            render(<EncounterModal {...createProps({ mode: 'rename', renameTarget: { name: 'old-name' } })} />);
            const input = screen.getByLabelText('New Name');
            fireEvent.change(input, { target: { value: 'Enter Rename' } });
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(mockOnRename).toHaveBeenCalledWith('old-name', 'Enter Rename');
        });
    });
});
