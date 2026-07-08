// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settlements from './Settlements.jsx';

const settlementMockReturn = {
  items: [],
  loading: false,
  loadItems: () => {},
  saveItems: async () => {},
  deleteItem: async () => {},
};

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: () => ({ ...settlementMockReturn }),
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

describe('Settlements - delete confirmation and behavior', () => {
  const mockUseSettlements = {
    items: [],
    loading: false,
    saveItems: async () => {},
    deleteItem: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    Object.assign(settlementMockReturn, mockUseSettlements);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows delete button only when editing an existing settlement', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('shows delete button when editing an existing settlement', () => {
    Object.assign(settlementMockReturn, {
      ...mockUseSettlements,
      items: [
        { name: 'Old Town', size: 'village', population: '', tags: '', services: [], description: '', atmosphere: '', government: '', notableNPCs: [], rumors: [], notes: '', threat: '' },
      ],
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
    fireEvent.click(settlementItem);
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('does not delete when user cancels confirmation dialog', () => {
    global.window.confirm = vi.fn(() => false);
    Object.assign(settlementMockReturn, {
      ...mockUseSettlements,
      items: [
        { name: 'Keep Me', size: 'village', population: '', tags: '', services: [], description: '', atmosphere: '', government: '', notableNPCs: [], rumors: [], notes: '', threat: '' },
      ],
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
    fireEvent.click(settlementItem);
    const deleteBtn = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteBtn);
    expect(mockUseSettlements.deleteItem).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
  });

  it('deletes when user confirms confirmation dialog', async () => {
    global.window.confirm = vi.fn(() => true);
    mockUseSettlements.deleteItem.mockResolvedValue({});
    Object.assign(settlementMockReturn, {
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
      expect(mockUseSettlements.deleteItem).toHaveBeenCalledWith('Delete Me');
    });
    expect(screen.queryByRole('heading', { name: 'Edit Settlement' })).not.toBeInTheDocument();
  });

  it('shows deleting state text during delete', async () => {
    global.window.confirm = vi.fn(() => true);
    Object.assign(settlementMockReturn, {
      ...mockUseSettlements,
      items: [
        { name: 'Deleting...', size: 'village', population: '', tags: '', services: [], description: '', atmosphere: '', government: '', notableNPCs: [], rumors: [], notes: '', threat: '' },
      ],
    });
    mockUseSettlements.deleteItem = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
    fireEvent.click(settlementItem);
    const deleteBtn = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteBtn);
    expect(screen.getByText('Deleting…')).toBeInTheDocument();
  });

  it('shows cancel button in modal footer', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('closes modal when cancel button is clicked', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole('heading', { name: 'New Settlement' })).not.toBeInTheDocument();
  });

  it('shows close button (X) in modal header', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('closes modal when close button (X) is clicked', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('heading', { name: 'New Settlement' })).not.toBeInTheDocument();
  });

  it('shows loading spinner when loading settlements', () => {
    Object.assign(settlementMockReturn, {
      items: [],
      loading: true,
      loadItems: () => {},
      saveItems: async () => {},
      deleteItem: async () => {},
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    expect(screen.getByText(/loading settlements/i)).toBeInTheDocument();
    expect(screen.queryByText(/no settlements yet/i)).not.toBeInTheDocument();
  });

  it('shows empty state when no settlements and no filters', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    expect(screen.getByText(/no settlements yet/i)).toBeInTheDocument();
  });

  it('shows no results message when filters yield no matches', () => {
    Object.assign(settlementMockReturn, {
      ...mockUseSettlements,
      items: [
        { name: 'Fireport', size: 'town', population: '', tags: '', services: [], description: 'A town of fire' },
      ],
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const searchInput = screen.getByLabelText('Search settlements');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    expect(screen.getByText(/no settlements found matching your filters/i)).toBeInTheDocument();
  });
});
