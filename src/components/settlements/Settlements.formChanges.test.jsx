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


describe('Settlements - form field changes', () => {
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
      json: () => Promise.resolve({
        village: {
          descriptions: ['A quiet village', 'A small farming village'],
          atmospheres: ['Peaceful', 'Rustic'],
          governments: ['Village council'],
          threats: ['Wild animals'],
          features: ['A small pond'],
        },
        town: {
          descriptions: ['A bustling town'],
          atmospheres: ['Lively'],
          governments: ['Mayor'],
          threats: ['Bandits'],
          features: ['A market square'],
        },
        city: {
          descriptions: ['A great city'],
          atmospheres: ['Cosmopolitan'],
          governments: ['City council'],
          threats: ['Crime'],
          features: ['A grand plaza'],
        },
        metropolis: {
          descriptions: ['A vast metropolis'],
          atmospheres: ['Diverse'],
          governments: ['Duke'],
          threats: ['Political intrigue'],
          features: ['A massive wall'],
        },
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    // Override module mock
    Object.assign(settlementMockReturn, mockUseSettlements);
  });

  it('populates fields with defaults when size changes', async () => {
    globalThis.Math.random = () => 0.5;
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const sizeSelect = screen.getByRole('combobox', { name: /size/i });
    fireEvent.change(sizeSelect, { target: { value: 'town' } });
    const popInput = screen.getByPlaceholderText(/souls/i);
    expect(popInput.value).toContain('souls');
  });

  it('shows threat preview toggle only when threat is non-empty', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    expect(screen.queryByText(/threats/i)).not.toBeInTheDocument();
  });

  it('shows threat preview toggle when editing a settlement with threat', () => {
    Object.assign(settlementMockReturn, {
      ...mockUseSettlements,
      items: [
        { name: 'Threat Town', size: 'village', population: '', tags: '', services: [], description: '', atmosphere: '', government: '', notableNPCs: [], rumors: [], notes: '', threat: 'Bandits' },
      ],
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
    fireEvent.click(settlementItem);
    expect(screen.getByText(/threats/i)).toBeInTheDocument();
  });
});
