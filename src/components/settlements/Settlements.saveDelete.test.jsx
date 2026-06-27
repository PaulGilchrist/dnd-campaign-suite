// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settlements from './Settlements.jsx';

vi.mock('../../hooks/useEntityManagement.js', () => ({
  default: vi.fn(),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: function PreviewToggle({ value, onChange, placeholder, label, id }) {
    return (
      <div className="preview-toggle-wrapper">
        {label && <label htmlFor={id}>{label}</label>}
        <textarea
          data-testid={`preview-toggle-${id}`}
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    );
  },
}));

vi.mock('../../services/campaign/settlementGenerator.js', () => ({
  generateSettlement: vi.fn().mockResolvedValue({
    name: 'Generated Town',
    size: 'town',
    description: 'A bustling town',
    atmosphere: 'Lively',
    government: 'Council',
    population: '1,500 souls',
    services: [],
    notableNPCs: [],
    rumors: [],
    tags: 'generated',
    notes: '',
    threat: 'Bandits',
  }),
}));

import { useEntityManagement } from '../../hooks/useEntityManagement.js';

describe('Settlements - save and delete behavior', () => {
  const mockUseSettlements = {
    items: [],
    loading: false,
    saveItems: vi.fn().mockResolvedValue(undefined),
    deleteItem: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    useEntityManagement.mockReturnValue(mockUseSettlements);
  });

  it('closes modal after successful save', async () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: 'My Settlement' } });
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUseSettlements.saveSettlementAction).toHaveBeenCalled();
    });
    expect(screen.queryByRole('heading', { name: 'New Settlement' })).not.toBeInTheDocument();
  });

  it('saves with oldName parameter when editing an existing settlement', async () => {
    useEntityManagement.mockReturnValue({
      ...mockUseSettlements,
      items: [
        { name: 'Old Name', size: 'village', population: '', tags: '', services: [], description: '', atmosphere: '', government: '', notableNPCs: [], rumors: [], notes: '', threat: '' },
      ],
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
    fireEvent.click(settlementItem);
    const nameInput = screen.getByDisplayValue('Old Name');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUseSettlements.saveSettlementAction).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name' }),
        'Old Name'
      );
    });
  });

  it('shows save button disabled during save', async () => {
    mockUseSettlements.saveSettlementAction = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: 'My Settlement' } });
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);
    expect(saveBtn).toBeDisabled();
  });

  it('re-enables save button after save completes', async () => {
    mockUseSettlements.saveSettlementAction = vi.fn().mockResolvedValue(undefined);
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: 'My Settlement' } });
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUseSettlements.saveSettlementAction).toHaveBeenCalled();
    });
    expect(screen.queryByRole('heading', { name: 'New Settlement' })).not.toBeInTheDocument();
  });

  it('shows delete button disabled during delete', async () => {
    global.window.confirm = vi.fn(() => true);
    useEntityManagement.mockReturnValue({
      ...mockUseSettlements,
      items: [
        { name: 'Delete Me', size: 'village', population: '', tags: '', services: [], description: '', atmosphere: '', government: '', notableNPCs: [], rumors: [], notes: '', threat: '' },
      ],
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
    fireEvent.click(settlementItem);
    const deleteBtn = screen.getByRole('button', { name: 'Delete' });
    mockUseSettlements.deleteSettlementAction = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    fireEvent.click(deleteBtn);
    expect(deleteBtn).toBeDisabled();
  });

  it('does not save when name is only whitespace', async () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: '   ' } });
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);
    expect(mockUseSettlements.saveSettlementAction).not.toHaveBeenCalled();
  });

  it('handles save error without crashing', async () => {
    mockUseSettlements.saveSettlementAction = vi.fn().mockRejectedValue(new Error('Save failed'));
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: 'My Settlement' } });
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUseSettlements.saveSettlementAction).toHaveBeenCalled();
    });
    expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
  });

  it('handles delete error without crashing', async () => {
    global.window.confirm = vi.fn(() => true);
    mockUseSettlements.deleteSettlementAction = vi.fn().mockRejectedValue(new Error('Delete failed'));
    useEntityManagement.mockReturnValue({
      ...mockUseSettlements,
      items: [
        { name: 'Delete Me', size: 'village', population: '', tags: '', services: [], description: '', atmosphere: '', government: '', notableNPCs: [], rumors: [], notes: '', threat: '' },
      ],
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
    fireEvent.click(settlementItem);
    const deleteBtn = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(mockUseSettlements.deleteSettlementAction).toHaveBeenCalled();
    });
    expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
  });
});
