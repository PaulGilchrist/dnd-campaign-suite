/* @cleaned-by-ai */
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

        it('closes when close button is clicked', () => {
            render(<EncounterModal {...createProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Close/i }));
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('closes when backdrop is clicked but not when modal content is clicked', () => {
            render(<EncounterModal {...createProps()} />);

            const overlay = document.querySelector('.encounter-modal-overlay');
            fireEvent.click(overlay);
            expect(mockOnClose).toHaveBeenCalledTimes(1);

            mockOnClose.mockClear();
            render(<EncounterModal {...createProps()} />);

            const modal = document.querySelector('.encounter-modal');
            fireEvent.click(modal);
            expect(mockOnClose).not.toHaveBeenCalled();
        });
    });

    describe('Save mode', () => {
        it('renders encounter name input with placeholder and save button', () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            expect(screen.getByLabelText('Encounter Name')).toBeInTheDocument();
            expect(screen.getByLabelText('Encounter Name')).toHaveAttribute('placeholder', 'e.g., Goblin Ambush');
            expect(screen.getByText('Save')).toBeInTheDocument();
        });

        it('calls onSave with trimmed name when save is clicked and closes modal', async () => {
            const onSave = vi.fn(() => Promise.resolve());
            render(<EncounterModal {...createProps({ mode: 'save', onSave })} />);
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: '  Goblin Ambush  ' } });
            await act(async () => {
                fireEvent.click(screen.getByText('Save'));
            });
            expect(onSave).toHaveBeenCalledWith('Goblin Ambush');
            await waitFor(() => {
                expect(mockOnClose).toHaveBeenCalled();
            });
        });

        it('clears name and closes after save completes', async () => {
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

        it('shows error when name is empty', () => {
            render(<EncounterModal {...createProps({ mode: 'save' })} />);
            fireEvent.click(screen.getByText('Save'));
            expect(screen.getByText('Encounter name is required')).toBeInTheDocument();
        });
    });

    describe('Load mode', () => {
        it('shows loading state and empty state', () => {
            render(<EncounterModal {...createProps({ mode: 'load', loading: true })} />);
            expect(screen.getByText('Loading...')).toBeInTheDocument();

            render(<EncounterModal {...createProps({ mode: 'load' })} />);
            expect(screen.getByText('No saved encounters yet.')).toBeInTheDocument();
        });

        it('renders encounters sorted by effectiveXP ascending', () => {
            const encounters = [
                { name: 'high-xp', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 500 },
                { name: 'low-xp', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 100 },
                { name: 'no-xp', savedAt: '2024-01-01T00:00:00Z' },
                { name: 'first-100', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 100 },
                { name: 'first-50', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 50 },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            const names = screen.getAllByRole('listitem').map(li => li.querySelector('.encounter-list-name')?.textContent);
            expect(names).toEqual(['no-xp', 'first-50', 'low-xp', 'first-100', 'high-xp']);
        });

        it('hides XP span when effectiveXP is null or undefined', () => {
            const encounters = [
                { name: 'null-xp', savedAt: '2024-01-01T00:00:00Z', effectiveXP: null },
                { name: 'undefined-xp', savedAt: '2024-01-01T00:00:00Z' },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            expect(screen.queryByText(/effective XP/)).not.toBeInTheDocument();
        });

        it('shows effective XP with locale formatting when available', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z', effectiveXP: 1500 },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            expect(screen.getByText(/1,500 effective XP/)).toBeInTheDocument();
        });

        it('shows description with markdown preview and hides it when absent', () => {
            const encounters = [
                { name: 'with-desc', savedAt: '2024-01-01T00:00:00Z', description: 'Goblins near the road' },
                { name: 'no-desc', savedAt: '2024-01-01T00:00:00Z' },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            expect(screen.getByTestId('markdown-preview')).toHaveTextContent('Goblins near the road');
        });

        it('calls onLoad when load button is clicked', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z' },
            ];
            render(<EncounterModal {...createProps({ mode: 'load', encounters })} />);
            fireEvent.click(screen.getByRole('button', { name: /Load/ }));
            expect(mockOnLoad).toHaveBeenCalledWith('goblin-ambush');
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
    });

    describe('Rename mode', () => {
        it('renders rename input with label and rename button', () => {
            render(<EncounterModal {...createProps({ mode: 'rename' })} />);
            expect(screen.getByLabelText('New Name')).toBeInTheDocument();
            expect(screen.getByText('Rename')).toBeInTheDocument();
        });

        it('shows error when new name is empty', () => {
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
    });
});
