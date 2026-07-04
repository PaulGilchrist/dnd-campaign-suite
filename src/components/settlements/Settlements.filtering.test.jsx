// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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


describe('Settlements - filtering', () => {
  const mockUseSettlements = {
    items: [
      { name: 'Fireport', size: 'town', population: '', tags: 'coastal', services: [], description: 'A town of fire' },
      { name: 'Iceholm', size: 'village', population: '', tags: 'frozen', services: [], description: 'A cold village' },
      { name: 'Goldhaven', size: 'city', population: '', tags: 'trade', services: [], description: 'A wealthy city' },
    ],
    loading: false,
    saveItems: async () => {},
    deleteItem: async () => {},
  };

  beforeEach(() => {
    // Override module mock
    Object.assign(settlementMockReturn, mockUseSettlements);
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

  it('filters by name case-insensitively', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const searchInput = screen.getByLabelText('Search settlements');
    fireEvent.change(searchInput, { target: { value: 'fire' } });
    expect(screen.getByText('Fireport')).toBeInTheDocument();
    expect(screen.queryByText('Iceholm')).not.toBeInTheDocument();
    expect(screen.queryByText('Goldhaven')).not.toBeInTheDocument();
  });

  it('filters by tags case-insensitively', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const searchInput = screen.getByLabelText('Search settlements');
    fireEvent.change(searchInput, { target: { value: 'COASTAL' } });
    expect(screen.getByText('Fireport')).toBeInTheDocument();
  });

  it('combines search and size filter', () => {
    Object.assign(settlementMockReturn, {
      ...mockUseSettlements,
      items: [
        { name: 'Fireport', size: 'town', population: '', tags: '', services: [], description: 'A town of fire' },
        { name: 'Fire Village', size: 'village', population: '', tags: '', services: [], description: 'A village of fire' },
        { name: 'Iceholm', size: 'village', population: '', tags: '', services: [], description: 'A cold village' },
      ],
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const searchInput = screen.getByLabelText('Search settlements');
    fireEvent.change(searchInput, { target: { value: 'fire' } });
    const villageBtns = screen.getAllByRole('button', { name: /village/i });
    const sizeFilterBtn = villageBtns.find(btn => btn.classList.contains('settlements-size-btn'));
    fireEvent.click(sizeFilterBtn);
    expect(screen.getByText('Fire Village')).toBeInTheDocument();
    expect(screen.queryByText('Fireport')).not.toBeInTheDocument();
    expect(screen.queryByText('Iceholm')).not.toBeInTheDocument();
  });

  it('shows all settlements when search is cleared after filtering', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const searchInput = screen.getByLabelText('Search settlements');
    fireEvent.change(searchInput, { target: { value: 'fire' } });
    expect(screen.getByText('Fireport')).toBeInTheDocument();
    expect(screen.queryByText('Iceholm')).not.toBeInTheDocument();
    const clearBtn = screen.getByLabelText('Clear search');
    fireEvent.click(clearBtn);
    expect(screen.getByText('Fireport')).toBeInTheDocument();
    expect(screen.getByText('Iceholm')).toBeInTheDocument();
    expect(screen.getByText('Goldhaven')).toBeInTheDocument();
  });

  it('shows all settlements when size filter is cleared after filtering', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const villageBtn = screen.getByRole('button', { name: /village/i });
    fireEvent.click(villageBtn);
    expect(screen.getByText('Iceholm')).toBeInTheDocument();
    expect(screen.queryByText('Fireport')).not.toBeInTheDocument();
    fireEvent.click(villageBtn);
    expect(screen.getByText('Fireport')).toBeInTheDocument();
    expect(screen.getByText('Iceholm')).toBeInTheDocument();
    expect(screen.getByText('Goldhaven')).toBeInTheDocument();
  });

  it('shows no results message when both search and size filter yield no matches', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const searchInput = screen.getByLabelText('Search settlements');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    const villageBtn = screen.getByRole('button', { name: /village/i });
    fireEvent.click(villageBtn);
    expect(screen.getByText(/no settlements found matching your filters/i)).toBeInTheDocument();
  });
});
