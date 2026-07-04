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


describe('Settlements - accessibility and keyboard', () => {
  const mockUseSettlements = {
    items: [
      { name: 'Fireport', size: 'town', population: '1,500 souls', tags: 'coastal', services: [], description: 'A town of fire' },
    ],
    loading: false,
    saveItems: async () => {},
    deleteItem: async () => {},
  };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    // Override the module mock by reassigning the module
    Object.assign(settlementMockReturn, mockUseSettlements);
  });

  it('opens edit modal when settlement item is activated with Enter', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
    fireEvent.keyDown(settlementItem, { key: 'Enter' });
    expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
  });

  it('sets aria-label on settlement list items', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
    expect(settlementItem).toHaveAttribute('aria-label', 'Edit settlement: Fireport');
  });

  it('sets aria-label on search input', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const searchInput = screen.getByLabelText('Search settlements');
    expect(searchInput).toHaveAttribute('aria-label', 'Search settlements');
  });

  it('sets aria-label on clear search button', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const searchInput = screen.getByLabelText('Search settlements');
    fireEvent.change(searchInput, { target: { value: 'fire' } });
    const clearBtn = screen.getByLabelText('Clear search');
    expect(clearBtn).toHaveAttribute('aria-label', 'Clear search');
  });

  it('sets aria-label on modal close button', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const closeBtn = screen.getByLabelText('Close');
    expect(closeBtn).toHaveAttribute('aria-label', 'Close');
  });
});
