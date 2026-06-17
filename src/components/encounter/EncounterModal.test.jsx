import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('EncounterModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when isOpen is false', () => {
        const { container } = render(<EncounterModal isOpen={false} onClose={mockOnClose} mode="save" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders Save Encounter mode title', () => {
        render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="save" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
        expect(screen.getByText('Save Encounter')).toBeInTheDocument();
    });

    it('renders Load Encounter mode title', () => {
        render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="load" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
        expect(screen.getByText('Load Encounter')).toBeInTheDocument();
    });

    it('renders Rename Encounter mode title', () => {
        render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="rename" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
        expect(screen.getByText('Rename Encounter')).toBeInTheDocument();
    });

    it('renders close button', () => {
        render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="save" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
        const closeBtn = document.querySelector('.encounter-modal-close');
        expect(closeBtn).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="save" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
        const closeBtn = document.querySelector('.encounter-modal-close');
        fireEvent.click(closeBtn);
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop is clicked', () => {
        render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="save" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
        const overlay = document.querySelector('.encounter-modal-overlay');
        fireEvent.click(overlay);
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('does not close when modal content is clicked', () => {
        render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="save" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
        const modal = document.querySelector('.encounter-modal');
        fireEvent.click(modal);
        expect(mockOnClose).not.toHaveBeenCalled();
    });

    describe('Save mode', () => {
        it('renders encounter name input', () => {
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="save" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
            expect(screen.getByLabelText('Encounter Name')).toBeInTheDocument();
        });

        it('renders save button', () => {
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="save" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
            expect(screen.getByText('Save')).toBeInTheDocument();
        });

        it('calls onSave with trimmed name when save is clicked', async () => {
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="save" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: '  Goblin Ambush  ' } });
            fireEvent.click(screen.getByText('Save'));
            expect(mockOnSave).toHaveBeenCalledWith('Goblin Ambush');
        });

        it('shows error when name is empty', () => {
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="save" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
            fireEvent.click(screen.getByText('Save'));
            expect(screen.getByText('Encounter name is required')).toBeInTheDocument();
        });

        it('clears error when name is entered', () => {
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="save" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
            fireEvent.click(screen.getByText('Save'));
            expect(screen.getByText('Encounter name is required')).toBeInTheDocument();
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: 'New Encounter' } });
            fireEvent.click(screen.getByText('Save'));
            expect(screen.queryByText('Encounter name is required')).not.toBeInTheDocument();
        });

        it('calls onClose after save', async () => {
            const onSave = vi.fn(() => Promise.resolve());
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="save" onSave={onSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: 'Test Encounter' } });
            fireEvent.click(screen.getByText('Save'));
            await Promise.resolve();
            expect(mockOnClose).toHaveBeenCalled();
        });

        it('triggers save on Enter key', () => {
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="save" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
            const input = screen.getByLabelText('Encounter Name');
            fireEvent.change(input, { target: { value: 'Test Encounter' } });
            fireEvent.keyDown(input, { key: 'Enter' });
            expect(mockOnSave).toHaveBeenCalledWith('Test Encounter');
        });

        it('auto-focuses the name input', () => {
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="save" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
            const input = screen.getByLabelText('Encounter Name');
            expect(document.activeElement).toBe(input);
        });
    });

    describe('Load mode', () => {
        it('shows loading state', () => {
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="load" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} loading={true} />);
            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        it('shows empty state when no encounters', () => {
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="load" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
            expect(screen.getByText('No saved encounters yet.')).toBeInTheDocument();
        });

        it('renders encounter list when encounters exist', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z', description: 'Goblins near the road' },
            ];
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="load" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={encounters} />);
            expect(screen.getByText('goblin-ambush')).toBeInTheDocument();
        });

        it('shows encounter date', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T12:00:00Z' },
            ];
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="load" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={encounters} />);
            const listItems = screen.getAllByRole('listitem');
            expect(listItems[0]).toBeInTheDocument();
        });

        it('shows description with markdown preview', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z', description: 'Goblins near the road' },
            ];
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="load" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={encounters} />);
            expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
        });

        it('calls onLoad when load button is clicked', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z' },
            ];
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="load" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={encounters} />);
            fireEvent.click(screen.getByRole('button', { name: /Load/ }));
            expect(mockOnLoad).toHaveBeenCalledWith('goblin-ambush');
        });

        it('renders rename and delete buttons for each encounter', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z' },
            ];
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="load" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={encounters} />);
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(2);
        });

        it('renders load icon button', () => {
            const encounters = [
                { name: 'goblin-ambush', savedAt: '2024-01-01T00:00:00Z' },
            ];
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="load" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={encounters} />);
            const loadBtn = screen.getByRole('button', { name: /Load/ });
            expect(loadBtn).toBeInTheDocument();
        });
    });

    describe('Rename mode', () => {
        it('renders rename input', () => {
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="rename" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
            expect(screen.getByLabelText('New Name')).toBeInTheDocument();
        });

        it('renders rename button', () => {
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="rename" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
            expect(screen.getByText('Rename')).toBeInTheDocument();
        });

        it('shows error when new name is empty', () => {
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="rename" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
            fireEvent.click(screen.getByText('Rename'));
            expect(screen.getByText('New name is required')).toBeInTheDocument();
        });

        it('auto-focuses the rename input', () => {
            render(<EncounterModal isOpen={true} onClose={mockOnClose} mode="rename" onSave={mockOnSave} onLoad={mockOnLoad} onDelete={mockOnDelete} onRename={mockOnRename} encounters={[]} />);
            const input = screen.getByLabelText('New Name');
            expect(document.activeElement).toBe(input);
        });
    });
});
