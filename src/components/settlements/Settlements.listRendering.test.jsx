// @cleaned-by-ai
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
          aria-label={label || ''}
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

describe('Settlements - list rendering details', () => {
  const mockUseSettlements = {
    items: [
      {
        name: 'Fireport',
        size: 'town',
        population: '1,500 souls',
        tags: 'coastal, trade',
        services: [{ type: 'inn', name: 'The Rusty Anchor', description: 'A fine inn' }, { type: 'blacksmith', name: 'Ironworks', description: 'Quality steel' }],
        description: 'A town of fire and smoke. The streets are lined with brick buildings and the air smells of coal.',
      },
      {
        name: 'Iceholm',
        size: 'village',
        population: '',
        tags: '',
        services: [],
        description: 'A cold village',
      },
      {
        name: 'Goldhaven',
        size: 'city',
        population: '25,000 souls',
        tags: 'trade hub',
        services: [{ type: 'magic_shop', name: 'Arcane Emporium', description: 'Rare spells and potions' }],
        description: 'A wealthy city of merchants and nobles. Golden spires tower over the harbor.',
      },
    ],
    loading: false,
    saveItems: async () => {},
    deleteItem: async () => {},
  };

  beforeEach(() => {
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

  it('shows size badge with icon for each settlement', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const townBadge = screen.getByTitle('town');
    expect(townBadge).toBeInTheDocument();
    expect(townBadge.querySelector('i')).toHaveClass('fa-solid');
  });

  it('shows population in the list subtitle', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    expect(screen.getByText('1,500 souls')).toBeInTheDocument();
    expect(screen.getByText('25,000 souls')).toBeInTheDocument();
  });

  it('shows service count in the list', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    expect(screen.getByText('2 services')).toBeInTheDocument();
    expect(screen.getByText('1 service')).toBeInTheDocument();
  });

  it('shows tags in the list', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    expect(screen.getByText('coastal, trade')).toBeInTheDocument();
    expect(screen.getByText('trade hub')).toBeInTheDocument();
  });

  it('truncates long descriptions at 120 characters in the list preview', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const fireport = screen.getByText(/Fireport/);
    const listItems = fireport.closest('li');
    const preview = listItems.querySelector('.settlements-list-preview');
    expect(preview).toBeInTheDocument();
    const textContent = preview.textContent;
    // 120 chars + the HTML entity character = ~123 visual chars
    expect(textContent.length).toBeLessThanOrEqual(123);
  });

  it('shows full description if under 120 characters', () => {
    Object.assign(settlementMockReturn, {
      ...mockUseSettlements,
      items: [
        {
          name: 'ShortDesc',
          size: 'village',
          population: '100 souls',
          tags: '',
          services: [],
          description: 'A short description under 120 chars',
        },
      ],
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const shortDesc = screen.getByText(/ShortDesc/);
    const listItems = shortDesc.closest('li');
    const preview = listItems.querySelector('.settlements-list-preview');
    expect(preview).toBeInTheDocument();
    expect(preview.textContent).toBe('A short description under 120 chars');
  });

  it('hides description preview when there is no description', () => {
    Object.assign(settlementMockReturn, {
      ...mockUseSettlements,
      items: [
        {
          name: 'NoDesc',
          size: 'village',
          population: '100 souls',
          tags: '',
          services: [],
          description: '',
        },
      ],
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const noDesc = screen.getByText(/NoDesc/);
    const listItems = noDesc.closest('li');
    const preview = listItems.querySelector('.settlements-list-preview');
    expect(preview).not.toBeInTheDocument();
  });

  it('hides service count when there are no services', () => {
    Object.assign(settlementMockReturn, {
      ...mockUseSettlements,
      items: [
        {
          name: 'NoServices',
          size: 'village',
          population: '100 souls',
          tags: '',
          services: [],
          description: 'A village with no services',
        },
      ],
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    expect(screen.queryByText(/0 services?/)).not.toBeInTheDocument();
  });

  it('hides tags when there are no tags', () => {
    Object.assign(settlementMockReturn, {
      ...mockUseSettlements,
      items: [
        {
          name: 'NoTags',
          size: 'village',
          population: '100 souls',
          tags: '',
          services: [],
          description: 'A peaceful hamlet',
        },
      ],
    });
    render(<Settlements campaignName="test" onBack={() => {}} />);
    expect(screen.getByText('NoTags')).toBeInTheDocument();
    // The tags span uses the settlements-list-tags class
    const tagsSpans = document.querySelectorAll('.settlements-list-tags');
    expect(tagsSpans.length).toBe(0);
  });

  it('shows all four size filter buttons', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    expect(screen.getByRole('button', { name: /village/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /town/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /city/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /metropolis/i })).toBeInTheDocument();
  });

  it('toggles size filter active state', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const villageBtns = screen.getAllByRole('button', { name: /village/i });
    const sizeFilterBtn = villageBtns.find(btn => btn.classList.contains('settlements-size-btn'));
    expect(sizeFilterBtn).not.toHaveClass('settlements-size-btn-active');
    fireEvent.click(sizeFilterBtn);
    expect(sizeFilterBtn).toHaveClass('settlements-size-btn-active');
    fireEvent.click(sizeFilterBtn);
    expect(sizeFilterBtn).not.toHaveClass('settlements-size-btn-active');
  });

  it('toggles size filter to show only matching settlements', () => {
    render(<Settlements campaignName="test" onBack={() => {}} />);
    const villageBtns = screen.getAllByRole('button', { name: /village/i });
    const sizeFilterBtn = villageBtns.find(btn => btn.classList.contains('settlements-size-btn'));
    fireEvent.click(sizeFilterBtn);
    expect(screen.getByText('Iceholm')).toBeInTheDocument();
    expect(screen.queryByText('Fireport')).not.toBeInTheDocument();
    expect(screen.queryByText('Goldhaven')).not.toBeInTheDocument();
  });
});
