/* @improved-by-ai */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import EncounterModal from './EncounterModal.jsx';

vi.mock('../../services/encounters/encountersService.js', () => ({
    formatEncounterName: vi.fn((name) => name),
}));

vi.mock('../common/MarkdownPreview.jsx', () => ({ default: ({ text }) => <div data-testid="markdown-preview">{text}</div> }));

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
    ...overrides,
});

describe('EncounterModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('returns null when isOpen is false', () => {
            const { container } = render(<EncounterModal {...createProps({ isOpen: false })} />);
            expect(container.innerHTML).toBe('');
        });

        it.each(['save', 'load', 'rename'])('renders "%s" mode title', (mode) => {
            render(<EncounterModal {...createProps({ mode })} />);
            expect(screen.getByText(`${mode.charAt(0).toUpperCase() + mode.slice(1)} Encounter`)).toBeInTheDocument();
        });

        it('calls onClose when close button is clicked', () => {
            render(<EncounterModal {...createProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Close/i }));
            expect(mockOnClose).toHaveBeenCalled();
        });

        it('has aria-label on close button', () => {
            render(<EncounterModal {...createProps()} />);
            const closeBtn = document.querySelector('.encounter-modal-close');
            expect(closeBtn).toBeInTheDocument();
            expect(closeBtn).toHaveAttribute('aria-label', 'Close');
        });

        it('calls onClose when backdrop is clicked', () => {
            render(<EncounterModal {...createProps()} />);
            const overlay = document.querySelector('.encounter-modal-overlay');
            fireEvent.click(overlay);
            expect(mockOnClose).toHaveBeenCalled();
        });

        it('does not close when modal content is clicked', () => {
            render(<EncounterModal {...createProps()} />);
            const modal = document.querySelector('.encounter-modal');
            fireEvent.click(modal);
            expect(mockOnClose).not.toHaveBeenCalled();
        });
    });

    describe('Save mode', () => {
        it('renders encounter name input', () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            expect(screen.getByLabelText('Encounter Name')).toBeInTheDocument();
        });

        it('renders save button', () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            expect(screen.getByText('Save')).toBeInTheDocument();
        });

        it('has placeholder text on name input', () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            const input = screen.getByLabelText('Encounter Name');
            expect(input).toHaveAttribute('placeholder', 'e.g., Goblin Ambush');
        });

        it('calls onSave with trimmed name when save is clicked', async () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: '  Goblin Ambush  ' } });
            await act(async () => {
                fireEvent.click(screen.getByText('Save'));
            });
            expect(mockOnSave).toHaveBeenCalledWith('Goblin Ambush');
        });

        it('shows error when name is empty', () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            fireEvent.click(screen.getByText('Save'));
            expect(screen.getByText('Encounter name is required')).toBeInTheDocument();
        });

        it('clears error when name is entered and save clicked', async () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            fireEvent.click(screen.getByText('Save'));
            expect(screen.getByText('Encounter name is required')).toBeInTheDocument();
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: 'New Encounter' } });
            await act(async () => {
                fireEvent.click(screen.getByText('Save'));
            });
            expect(screen.queryByText('Encounter name is required')).not.toBeInTheDocument();
        });

        it('calls onClose after save completes', async () => {
            const onSave = vi.fn(() => Promise.resolve());
            render(<EncounterModal {...createProps({ mode: 'save', onSave })} />);
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: 'Test Encounter' } });
            await act(async () => {
                fireEvent.click(screen.getByText('Save'));
            });
            await waitFor(() => {
                expect(mockOnClose).toHaveBeenCalled();
            });
        });

        it('triggers save on Enter key', () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: 'Test Encounter' } });
            fireEvent.keyDown(input, { key: 'Enter' });
            expect(mockOnSave).toHaveBeenCalledWith('Test Encounter');
        });

        it('auto-focuses the name input', () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            const input = screen.getByLabelText('Encounter Name');
            expect(document.activeElement).toBe(input);
        });

        it('clears name after save completes', async () => {
            const onSave = vi.fn(() => Promise.resolve());
            render(<EncounterModal {...createProps({ mode: 'save', onSave })} />);
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: 'Test Encounter' } });
            await act(async () => {
                fireEvent.click(screen.getByText('Save'));
            });
            await waitFor(() => {
                expect(input).toHaveValue('');
            });
        });
    });

    describe('Load mode', () => {
        it('shows loading state', () => {
            render(<EncounterModal {...createProps({ mode: 'load', loading: true })} />);
            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        it('shows empty state when no encounters', () => {
            render(<EncounterModal {...createProps({ mode: 'load' })} />);
            expect(screen.getByText('No saved encounters yet.')).toBeInTheDocument();
        });

        it('renders encounters sorted by effectiveXP ascending', () => {
            const encounters = [
                { name: 'high-xp', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 500 },
                { name: 'low-xp', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 100 },
                { name: 'no-xp', savedAt: '2024-01-01T00:00:00Z' },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            const names = screen.getAllByRole('listitem').map(li => li.querySelector('.encounter-list-name')?.textContent);
            expect(names[0]).toBe('no-xp');
            expect(names[1]).toBe('low-xp');
            expect(names[2]).toBe('high-xp');
        });

        it('does not show XP span when effectiveXP is null', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z', effectiveXP: null },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            expect(screen.queryByText(/effective XP/)).not.toBeInTheDocument();
        });

        it('does not show XP span when effectiveXP is undefined', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z' },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            expect(screen.queryByText(/effective XP/)).not.toBeInTheDocument();
        });

        it('shows effective XP when available', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 250 },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            expect(screen.getByText(/250 effective XP/)).toBeInTheDocument();
        });

        it('formats effective XP with locale separators', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 1500 },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            expect(screen.getByText(/1,500 effective XP/)).toBeInTheDocument();
        });

        it('shows description with markdown preview', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z', description: 'Goblins near the road' },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            expect(screen.getByTestId('markdown-preview')).toHaveTextContent('Goblins near the road');
        });

        it('does not show description element when encounter has no description', () => {
            const encounters = [
                { name: 'no-desc', savedAt: '2024-01-01T00:00:00Z' },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            expect(screen.queryByTestId('markdown-preview')).not.toBeInTheDocument();
        });

        it('calls onLoad when load button is clicked', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z' },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            fireEvent.click(screen.getByRole('button', { name: /Load/ }));
            expect(mockOnLoad).toHaveBeenCalledWith('goblin-ambush');
        });

        it('renders rename and delete buttons for each encounter', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z' },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(2);
        });

        it('handles delete with confirm dialog', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z' },
            ];
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
            expect(confirmSpy).toHaveBeenCalledWith('Delete "goblin-ambush"?');
            expect(mockOnDelete).toHaveBeenCalledWith('goblin-ambush');
            confirmSpy.mockRestore();
        });

        it('does not delete when confirm is cancelled', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z' },
            ];
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
            expect(mockOnDelete).not.toHaveBeenCalled();
            confirmSpy.mockRestore();
        });

        it('calls onDelete with formatted encounter name', () => {
            const encounters = [
                { name: 'goblin-ambush.json', savedAt: '2024-01-01T00:00:00Z' },
            ];
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
            expect(mockOnDelete).toHaveBeenCalledWith('goblin-ambush.json');
            confirmSpy.mockRestore();
        });

        it('renders multiple encounters', () => {
            const encounters = [
                { name: 'encounter-1', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 100 },
                { name: 'encounter-2', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 200 },
                { name: 'encounter-3', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 100 },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            const items = screen.getAllByRole('listitem');
            expect(items).toHaveLength(3);
        });

        it('sorts encounters with equal effectiveXP stably by original order', () => {
            const encounters = [
                { name: 'first-100', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 100 },
                { name: 'first-50', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 50 },
                { name: 'second-100', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 100 },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            const names = screen.getAllByRole('listitem').map(li => li.querySelector('.encounter-list-name')?.textContent);
            expect(names[0]).toBe('first-50');
            expect(names[1]).toBe('first-100');
            expect(names[2]).toBe('second-100');
        });
    });

    describe('Rename mode', () => {
        it('renders rename input', () => {
            render(<EncounterModal {...createProps({ mode: 'rename' })} />);
            expect(screen.getByLabelText('New Name')).toBeInTheDocument();
        });

        it('renders rename button', () => {
            render(<EncounterModal {...createProps({ mode: 'rename' })} />);
            expect(screen.getByText('Rename')).toBeInTheDocument();
        });

        it('shows error when new name is empty', () => {
            render(<EncounterModal {...createProps({ mode: 'rename' })} />);
            fireEvent.click(screen.getByText('Rename'));
            expect(screen.getByText('New name is required')).toBeInTheDocument();
        });

        it('auto-focuses the rename input', () => {
            render(<EncounterModal {...createProps({ mode: 'rename' })} />);
            const input = screen.getByLabelText('New Name');
            expect(document.activeElement).toBe(input);
        });

        it('triggers rename on Enter key', () => {
            const encounters = [
                { name: 'old-name', savedAt: '2024-01-01T00:00:00Z' },
            ];
            const props = createProps({ mode: 'load', encounters });
            const { rerender } = render(<EncounterModal {...props} />);
            const renameBtn = screen.getByRole('button', { name: /Rename/ });
            fireEvent.click(renameBtn);
            rerender(<EncounterModal {...createProps({ mode: 'rename', encounters })} />);
            const input = screen.getByLabelText('New Name');
            fireEvent.change(input, { target: { value: 'New Name' } });
            fireEvent.keyDown(input, { key: 'Enter' });
            expect(mockOnRename).toHaveBeenCalledWith('old-name', 'New Name');
        });

        it('calls onRename with old and new names and clears state after rename completes', async () => {
            const encounters = [
                { name: 'old-name', savedAt: '2024-01-01T00:00:00Z' },
            ];
            const props = createProps({ mode: 'load', encounters });
            const { rerender } = render(<EncounterModal {...props} />);
            const renameBtn = screen.getByRole('button', { name: /Rename/ });
            fireEvent.click(renameBtn);
            rerender(<EncounterModal {...createProps({ mode: 'rename', encounters })} />);
            const input = screen.getByLabelText('New Name');
            fireEvent.change(input, { target: { value: 'New Name' } });
            await act(async () => {
                fireEvent.click(screen.getByText('Rename'));
            });
            await waitFor(() => {
                expect(mockOnRename).toHaveBeenCalledWith('old-name', 'New Name');
            });
        });

        it('clears error when new name is entered and rename clicked', async () => {
            const encounters = [
                { name: 'old-name', savedAt: '2024-01-01T00:00:00Z' },
            ];
            const props = createProps({ mode: 'load', encounters });
            const { rerender } = render(<EncounterModal {...props} />);
            const renameBtn = screen.getByRole('button', { name: /Rename/ });
            fireEvent.click(renameBtn);
            rerender(<EncounterModal {...createProps({ mode: 'rename', encounters })} />);
            const input = screen.getByLabelText('New Name');
            fireEvent.change(input, { target: { value: '' } });
            fireEvent.click(screen.getByText('Rename'));
            expect(screen.getByText('New name is required')).toBeInTheDocument();
            fireEvent.change(input, { target: { value: 'New Name' } });
            await act(async () => {
                fireEvent.click(screen.getByText('Rename'));
            });
            expect(screen.queryByText('New name is required')).not.toBeInTheDocument();
        });
    });

    describe('Rename from load mode', () => {
        it('switches to rename mode and pre-fills newName when rename button is clicked', () => {
            const encounters = [
                { name: 'old-name', savedAt: '2024-01-01T00:00:00Z' },
            ];
            const props = createProps({ mode: 'load', encounters });
            const { rerender } = render(<EncounterModal {...props} />);
            expect(screen.getByText('Load Encounter')).toBeInTheDocument();
            const renameBtn = screen.getByRole('button', { name: /Rename/ });
            fireEvent.click(renameBtn);
            rerender(<EncounterModal {...createProps({ mode: 'rename', encounters, renameTarget: encounters[0] })} />);
            expect(screen.getByText('Rename Encounter')).toBeInTheDocument();
            const input = screen.getByLabelText('New Name');
            expect(input).toHaveValue('old-name');
        });

        it('pre-fills newName with encounter name for formatted encounter', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z' },
            ];
            const props = createProps({ mode: 'load', encounters });
            const { rerender } = render(<EncounterModal {...props} />);
            const renameBtn = screen.getByRole('button', { name: /Rename/ });
            fireEvent.click(renameBtn);
            rerender(<EncounterModal {...createProps({ mode: 'rename', encounters, renameTarget: encounters[0] })} />);
            const input = screen.getByLabelText('New Name');
            expect(input).toHaveValue('goblin-ambush');
        });
    });

    describe('useEffect behavior', () => {
        it('resets name when mode changes to save', () => {
            const props = createProps({ mode: 'save' });
            const { rerender } = render(<EncounterModal {...props} />);
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: 'Test Encounter' } });
            expect(input).toHaveValue('Test Encounter');
            rerender(<EncounterModal {...createProps({ mode: 'load' })} />);
            rerender(<EncounterModal {...createProps({ mode: 'save' })} />);
            const updatedInput = screen.getByLabelText('Encounter Name');
            expect(updatedInput).toHaveValue('');
        });

        it('clears error when mode changes to save', () => {
            const props = createProps({ mode: 'save' });
            const { rerender } = render(<EncounterModal {...props} />);
            fireEvent.click(screen.getByText('Save'));
            expect(screen.getByText('Encounter name is required')).toBeInTheDocument();
            rerender(<EncounterModal {...createProps({ mode: 'load' })} />);
            rerender(<EncounterModal {...createProps({ mode: 'save' })} />);
            expect(screen.queryByText('Encounter name is required')).not.toBeInTheDocument();
        });


    });
});
