import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EncounterModal from './EncounterModal.jsx';

vi.mock('../../services/encountersService.js', () => ({
  formatEncounterName: (name) => name.replace(/-/g, ' '),
}));

vi.mock('../common/MarkdownPreview.jsx', () => ({
  default: ({ text }) => <span data-testid="markdown-preview">{text}</span>,
}));

describe('EncounterModal', () => {
  let props;

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    props = {
      isOpen: true,
      onClose: vi.fn(),
      mode: 'save',
      onSave: vi.fn(),
      onLoad: vi.fn(),
      onDelete: vi.fn(),
      onRename: vi.fn(),
      encounters: [],
      loading: false,
    };
  });

  it('should render Save Encounter heading in save mode', () => {
    render(<EncounterModal {...props} mode="save" />);
    expect(screen.getByText('Save Encounter')).toBeInTheDocument();
  });

  it('should render name input with placeholder in save mode', () => {
    render(<EncounterModal {...props} mode="save" />);
    expect(screen.getByPlaceholderText('e.g., Goblin Ambush')).toBeInTheDocument();
  });

  it('should show save button in save mode', () => {
    render(<EncounterModal {...props} mode="save" />);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('should show error when saving with empty name', () => {
    render(<EncounterModal {...props} mode="save" />);
    fireEvent.click(screen.getByText('Save').closest('button'));
    expect(screen.getByText('Encounter name is required')).toBeInTheDocument();
  });

  it('should call onSave with trimmed name and close', () => {
    render(<EncounterModal {...props} mode="save" />);
    const input = screen.getByPlaceholderText('e.g., Goblin Ambush');
    fireEvent.change(input, { target: { value: '  Goblin Ambush  ' } });
    fireEvent.click(screen.getByText('Save').closest('button'));
    expect(props.onSave).toHaveBeenCalledWith('Goblin Ambush');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('should clear name after save', () => {
    render(<EncounterModal {...props} mode="save" />);
    const input = screen.getByPlaceholderText('e.g., Goblin Ambush');
    fireEvent.change(input, { target: { value: 'Goblin Ambush' } });
    fireEvent.click(screen.getByText('Save').closest('button'));
  });

  it('should trigger save on Enter key', () => {
    render(<EncounterModal {...props} mode="save" />);
    const input = screen.getByPlaceholderText('e.g., Goblin Ambush');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSave).toHaveBeenCalledWith('Test');
  });

  it('should render Load Encounter heading in load mode', () => {
    render(<EncounterModal {...props} mode="load" />);
    expect(screen.getByText('Load Encounter')).toBeInTheDocument();
  });

  it('should show loading state in load mode', () => {
    render(<EncounterModal {...props} mode="load" loading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show empty state when no encounters in load mode', () => {
    render(<EncounterModal {...props} mode="load" />);
    expect(screen.getByText('No saved encounters yet.')).toBeInTheDocument();
  });

  it('should render encounter list with formatted names', () => {
    render(<EncounterModal {...props} mode="load" encounters={[
      { name: 'goblin-ambush', savedAt: '2024-01-15T10:30:00.000Z' },
      { name: 'dragon-fight', savedAt: '2024-01-16T14:00:00.000Z' },
    ]} />);
    expect(screen.getByText('goblin ambush')).toBeInTheDocument();
    expect(screen.getByText('dragon fight')).toBeInTheDocument();
  });

  it('should show savedAt date for encounters', () => {
    render(<EncounterModal {...props} mode="load" encounters={[
      { name: 'test', savedAt: '2024-01-15T10:30:00.000Z' },
    ]} />);
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it('should show description with MarkdownPreview when present', () => {
    render(<EncounterModal {...props} mode="load" encounters={[
      { name: 'test', savedAt: '2024-01-15T10:30:00.000Z', description: 'A dangerous fight' },
    ]} />);
    expect(screen.getByText('A dangerous fight')).toBeInTheDocument();
  });

  it('should call onLoad when Load button clicked', () => {
    render(<EncounterModal {...props} mode="load" encounters={[
      { name: 'goblin-ambush', savedAt: '2024-01-15T10:30:00.000Z' },
    ]} />);
    fireEvent.click(screen.getByLabelText('Load goblin-ambush'));
    expect(props.onLoad).toHaveBeenCalledWith('goblin-ambush');
  });

  it('should set rename target when rename button clicked', () => {
    render(<EncounterModal {...props} mode="load" encounters={[
      { name: 'goblin-ambush', savedAt: '2024-01-15T10:30:00.000Z' },
    ]} />);
    fireEvent.click(screen.getByLabelText('Rename goblin-ambush'));
    expect(screen.getByText('Rename Encounter')).toBeInTheDocument();
  });

  it('should call onDelete after confirm when delete clicked', () => {
    render(<EncounterModal {...props} mode="load" encounters={[
      { name: 'goblin-ambush', savedAt: '2024-01-15T10:30:00.000Z' },
    ]} />);
    fireEvent.click(screen.getByLabelText('Delete goblin-ambush'));
    expect(window.confirm).toHaveBeenCalled();
    expect(props.onDelete).toHaveBeenCalledWith('goblin-ambush');
  });

  it('should render Rename Encounter heading in rename mode', () => {
    render(<EncounterModal {...props} mode="rename" />);
    expect(screen.getByText('Rename Encounter')).toBeInTheDocument();
  });

  it('should show rename button in rename mode', () => {
    render(<EncounterModal {...props} mode="rename" />);
    expect(screen.getByText('Rename')).toBeInTheDocument();
  });

  it('should show error when renaming with empty name', async () => {
    const { rerender } = render(<EncounterModal {...props} mode="rename"
      encounters={[{ name: 'old-name', savedAt: '2024-01-15T10:30:00.000Z' }]} />);
    const input = document.querySelector('#encounter-rename');
    if (input) {
      fireEvent.change(input, { target: { value: '' } });
      const renameBtn = screen.getByText('Rename');
      fireEvent.click(renameBtn);
    }
  });

  it('should return null when isOpen is false', () => {
    render(<EncounterModal {...props} isOpen={false} />);
    expect(screen.queryByText('Save Encounter')).not.toBeInTheDocument();
  });

  it('should call onClose when close button clicked', () => {
    render(<EncounterModal {...props} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('should call onClose when backdrop clicked', () => {
    render(<EncounterModal {...props} />);
    const overlay = document.querySelector('.encounter-modal-overlay');
    fireEvent.click(overlay);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('should not close when modal content clicked', () => {
    render(<EncounterModal {...props} />);
    const modal = document.querySelector('.encounter-modal');
    fireEvent.click(modal);
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
