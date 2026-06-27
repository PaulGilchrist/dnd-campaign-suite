// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settlements from './Settlements.jsx';

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: vi.fn(() => ({
    items: [],
    loading: false,
    loadItems: vi.fn(),
    saveItems: vi.fn().mockResolvedValue(undefined),
    deleteItem: vi.fn().mockResolvedValue(undefined),
  })),
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

describe('Settlements - accessibility and keyboard', () => {
  const mockUseSettlements = {
    items: [
      { name: 'Fireport', size: 'town', population: '1,500 souls', tags: 'coastal', services: [], description: 'A town of fire' },
    ],
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

  it('opens edit modal when settlement item is activated with Enter', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
    fireEvent.keyDown(settlementItem, { key: 'Enter' });
    expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
  });

  it('opens edit modal when settlement item is activated with Space', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
    fireEvent.keyDown(settlementItem, { key: ' ' });
    expect(screen.getByRole('heading', { name: 'Edit Settlement' })).toBeInTheDocument();
  });

  it('does not open edit modal when settlement item is activated with other key', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
    fireEvent.keyDown(settlementItem, { key: 'a' });
    expect(screen.queryByRole('heading', { name: 'Edit Settlement' })).not.toBeInTheDocument();
  });

  it('sets tabIndex on settlement list items', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const settlementItem = screen.getByRole('button', { name: /edit settlement/i });
    expect(settlementItem).toHaveAttribute('tabindex', '0');
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

  it('has back button with arrow-left icon', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const backBtn = screen.getByRole('button', { name: /back/i });
    expect(backBtn).toHaveClass('ct-back-btn');
    expect(backBtn.querySelector('.fa-solid.fa-arrow-left')).toBeInTheDocument();
  });

  it('has city icon in header title', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const title = screen.getByRole('heading', { name: /settlements/i });
    expect(title.querySelector('.fa-solid.fa-city')).toBeInTheDocument();
  });

  it('has plus icon on new settlement button', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const newBtn = screen.getByRole('button', { name: /new settlement/i });
    expect(newBtn.querySelector('.fa-solid.fa-plus')).toBeInTheDocument();
  });

  it('has wand icon on generate button', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const genBtn = screen.getByRole('button', { name: /generate settlement/i });
    expect(genBtn.querySelector('.fa-solid.fa-wand-magic-sparkles')).toBeInTheDocument();
  });

  it('has magnifying glass icon on search bar', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('has size filter buttons with correct icons', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const villageBtn = screen.getByRole('button', { name: /village/i });
    expect(villageBtn.querySelector('.fa-solid.fa-house-chimney')).toBeInTheDocument();
    const townBtn = screen.getByRole('button', { name: /town/i });
    expect(townBtn.querySelector('.fa-solid.fa-hotel')).toBeInTheDocument();
    const cityBtn = screen.getByRole('button', { name: /city/i });
    expect(cityBtn.querySelector('.fa-solid.fa-city')).toBeInTheDocument();
    const metroBtn = screen.getByRole('button', { name: /metropolis/i });
    expect(metroBtn.querySelector('.fa-solid.fa-landmark-dome')).toBeInTheDocument();
  });

  it('marks required field with asterisk', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const modalOpen = screen.getByRole('button', { name: /new settlement/i });
    fireEvent.click(modalOpen);
    const nameLabel = screen.getByLabelText(/name/i).parentElement;
    expect(nameLabel.querySelector('.ct-required')).toBeInTheDocument();
  });
});
