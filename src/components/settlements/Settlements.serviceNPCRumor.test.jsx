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


describe('Settlements - service, NPC, rumor management', () => {
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

  it('allows adding multiple services', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addServiceBtn = screen.getByRole('button', { name: /add service/i });
    fireEvent.click(addServiceBtn);
    fireEvent.click(addServiceBtn);
    expect(screen.getAllByRole('button', { name: /remove service/i }).length).toBe(2);
  });

  it('allows adding multiple NPCs', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addNpcBtn = screen.getByRole('button', { name: /add npc/i });
    fireEvent.click(addNpcBtn);
    fireEvent.click(addNpcBtn);
    expect(screen.getAllByRole('button', { name: /remove npc/i }).length).toBe(2);
  });

  it('allows adding multiple rumors', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const addRumorBtn = screen.getByRole('button', { name: /add rumor/i });
    fireEvent.click(addRumorBtn);
    fireEvent.click(addRumorBtn);
    expect(screen.getAllByRole('button', { name: /remove rumor/i }).length).toBe(2);
  });
});
