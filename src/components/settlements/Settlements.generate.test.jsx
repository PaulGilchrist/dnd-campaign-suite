// @improved-by-ai
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
    loading: false,    saveItems: async () => {},
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

  it('passes existing settlements to the generator', async () => {
    const { generateSettlement } = await import('../../services/campaign/settlementGenerator.js');
    vi.mocked(generateSettlement).mockResolvedValue({
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
    });
    Object.assign(settlementMockReturn, {
      ...mockUseSettlements,
      items: [{ name: 'Existing Town' }],
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const genBtn = screen.getByRole('button', { name: /generate settlement/i });
    fireEvent.click(genBtn);
    await waitFor(() => {
      expect(generateSettlement).toHaveBeenCalledWith([{ name: 'Existing Town' }]);
    });
  });

  it('handles generation error gracefully', async () => {
    const { generateSettlement } = await import('../../services/campaign/settlementGenerator.js');
    vi.mocked(generateSettlement).mockRejectedValue(new Error('Generation failed'));
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const genBtn = screen.getByRole('button', { name: /generate settlement/i });
    fireEvent.click(genBtn);
    await waitFor(() => {
      expect(generateSettlement).toHaveBeenCalled();
    });
    expect(screen.queryByRole('heading', { name: 'New Settlement' })).not.toBeInTheDocument();
  });

  it('re-enables generate button after generation completes', async () => {
    const { generateSettlement } = await import('../../services/campaign/settlementGenerator.js');
    vi.mocked(generateSettlement).mockResolvedValue({
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
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const genBtn = screen.getByRole('button', { name: /generate settlement/i });
    fireEvent.click(genBtn);
    await waitFor(() => {
      expect(genBtn).toBeDisabled();
    });
    await waitFor(() => {
      expect(genBtn).not.toBeDisabled();
    });
  });
});
