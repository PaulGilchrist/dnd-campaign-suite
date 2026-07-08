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


describe('Settlements - generate settlement', () => {
  const mockUseSettlements = {
    items: [],
    loading: false,
    saveItems: async () => {},
    deleteItem: async () => {},
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
    // Override module mock
    Object.assign(settlementMockReturn, mockUseSettlements);
  });

  it('opens the new settlement modal with generated data', async () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const genBtn = screen.getByRole('button', { name: /generate settlement/i });
    fireEvent.click(genBtn);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'New Settlement' })).toBeInTheDocument();
    });
  });

  it('logs error and does not open modal when generation fails', async () => {
    vi.mocked(await import('../../services/campaign/settlementGenerator.js')).generateSettlement = vi.fn().mockRejectedValue(new Error('Generation failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const genBtn = screen.getByRole('button', { name: /generate settlement/i });
    fireEvent.click(genBtn);
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to generate settlement:', expect.any(Error));
    });
    expect(screen.queryByRole('heading', { name: 'New Settlement' })).not.toBeInTheDocument();
  });
});
