// Filtering behavior only. Intentionally NOT duplicated here (covered in
// sibling files):
//   - size filter buttons render / active-state CSS toggle
//                        -> Settlements.listRendering.test.jsx
//   - search matching nothing shows the filters message
//                        -> Settlements.modalActions.test.jsx
//   - clear-search button presence and behavior
//                        -> Settlements.accessibility.test.jsx
//   - size filter button title hints (accessibility)
//                        -> Settlements.accessibility.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settlements from './Settlements.jsx';

// Module-level mock store captured by the vi.mock factory. Tests mutate its
// `items` field before rendering so the component reads fresh state.
const settlementMockStore = {
  items: [],
  loading: false,
  loadItems: vi.fn(),
  saveItems: vi.fn(),
  deleteItem: vi.fn(),
};

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: () => settlementMockStore,
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
  generateSettlement: vi.fn(),
}));

const makeSettlement = (name, overrides = {}) => ({
  name,
  size: 'village',
  population: '',
  tags: '',
  services: [],
  description: '',
  atmosphere: '',
  government: '',
  notableNPCs: [],
  rumors: [],
  notes: '',
  threat: '',
  ...overrides,
});

// Size filter buttons are the only elements carrying a `Filter:` tooltip
// (the size badges in the list use a bare lowercase size title). This query is
// exact and unambiguous, unlike matching button names, which collide with the
// aria-label of settlement list items (e.g. "Edit settlement: Fire Village").
const getSizeFilterButton = (sizeLabel) => screen.getByTitle(`Filter: ${sizeLabel}`);

const getSettlementListItem = (name) =>
  screen.getByRole('button', { name: new RegExp(`edit settlement: ${name}`, 'i') });

const renderSettlements = (campaignName = 'test') =>
  render(<Settlements campaignName={campaignName} onBack={() => {}} />);

const searchSettlements = (query) => {
  fireEvent.change(screen.getByLabelText('Search settlements'), { target: { value: query } });
};

describe('Settlements - filtering (behavioral)', () => {
  beforeEach(() => {
    settlementMockStore.items = [];
    settlementMockStore.loading = false;
    settlementMockStore.loadItems.mockResolvedValue(undefined);
    // The component fetches settlement-descriptions.json on mount; no test here
    // changes a size select, so the response body is irrelevant.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Search filtering', () => {
    const settlements = [
      makeSettlement('Fireport', { size: 'town' }),
      makeSettlement('Iceholm', { size: 'village' }),
      makeSettlement('Goldhaven', { size: 'city' }),
    ];

    it('filters by name case-insensitively', () => {
      settlementMockStore.items = settlements;
      renderSettlements();
      searchSettlements('fire');

      expect(getSettlementListItem('Fireport')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit settlement: iceholm/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit settlement: goldhaven/i })).not.toBeInTheDocument();
    });

    it('matches search terms against tags and description, not just name', () => {
      settlementMockStore.items = [
        makeSettlement('Fireport', { tags: 'coastal', description: 'A town of fire' }),
        makeSettlement('Iceholm', { tags: 'frozen', description: 'A cold village on a glacier' }),
      ];
      renderSettlements();

      searchSettlements('coastal');
      expect(getSettlementListItem('Fireport')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit settlement: iceholm/i })).not.toBeInTheDocument();

      searchSettlements('glacier');
      expect(getSettlementListItem('Iceholm')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit settlement: fireport/i })).not.toBeInTheDocument();
    });

    it('treats a whitespace-only query as empty and shows every settlement', () => {
      settlementMockStore.items = settlements;
      renderSettlements();
      searchSettlements('   ');

      expect(getSettlementListItem('Fireport')).toBeInTheDocument();
      expect(getSettlementListItem('Iceholm')).toBeInTheDocument();
      expect(getSettlementListItem('Goldhaven')).toBeInTheDocument();
    });


  });

  describe('Size filter', () => {
    it.each([
      { action: 'toggles off and restores the full list', clicks: ['Village', 'Village'], visible: ['Fireport', 'Iceholm', 'Goldhaven'], hidden: [] },
      { action: 'switches to a different size and shows only that size', clicks: ['Town', 'City'], visible: ['Goldhaven'], hidden: ['Fireport', 'Iceholm'] },
    ])('size filter: $action', ({ clicks, visible, hidden }) => {
      settlementMockStore.items = [
        makeSettlement('Fireport', { size: 'town' }),
        makeSettlement('Iceholm', { size: 'village' }),
        makeSettlement('Goldhaven', { size: 'city' }),
      ];
      renderSettlements();

      clicks.forEach((size) => fireEvent.click(getSizeFilterButton(size)));

      visible.forEach((name) => expect(getSettlementListItem(name)).toBeInTheDocument());
      hidden.forEach((name) => expect(screen.queryByRole('button', { name: new RegExp(`edit settlement: ${name}`, 'i') })).not.toBeInTheDocument());
    });

    it('shows the no-results message when a size filter alone excludes every settlement', () => {
      settlementMockStore.items = [
        makeSettlement('Fireport', { size: 'town' }),
        makeSettlement('Iceholm', { size: 'village' }),
        makeSettlement('Goldhaven', { size: 'city' }),
      ];
      renderSettlements();

      fireEvent.click(getSizeFilterButton('Metropolis'));

      expect(screen.getByText(/no settlements found matching your filters/i)).toBeInTheDocument();
      expect(screen.queryByText(/no settlements yet/i)).not.toBeInTheDocument();
    });
  });

  describe('Combined search and size filters', () => {
    it('shows only the settlements that match both the search query and the size filter', () => {
      settlementMockStore.items = [
        makeSettlement('Fireport', { size: 'town' }),
        makeSettlement('Fire Village', { size: 'village' }),
        makeSettlement('Iceholm', { size: 'village' }),
      ];
      renderSettlements();
      searchSettlements('fire');

      fireEvent.click(getSizeFilterButton('Village'));

      expect(getSettlementListItem('Fire Village')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit settlement: fireport/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit settlement: iceholm/i })).not.toBeInTheDocument();
    });

    it('restores the full list when the size filter is cleared while a search is active', () => {
      settlementMockStore.items = [
        makeSettlement('Fireport', { size: 'town' }),
        makeSettlement('Fire Village', { size: 'village' }),
        makeSettlement('Iceholm', { size: 'village' }),
      ];
      renderSettlements();
      searchSettlements('fire');

      fireEvent.click(getSizeFilterButton('Village'));
      expect(getSettlementListItem('Fire Village')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit settlement: fireport/i })).not.toBeInTheDocument();

      fireEvent.click(getSizeFilterButton('Village'));
      expect(getSettlementListItem('Fireport')).toBeInTheDocument();
      expect(getSettlementListItem('Fire Village')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit settlement: iceholm/i })).not.toBeInTheDocument();
    });

    it('shows the no-results message when a size filter alone excludes every settlement', () => {
      settlementMockStore.items = [
        makeSettlement('Fireport', { size: 'town' }),
        makeSettlement('Iceholm', { size: 'village' }),
        makeSettlement('Goldhaven', { size: 'city' }),
      ];
      renderSettlements();

      fireEvent.click(getSizeFilterButton('Metropolis'));

      expect(screen.getByText(/no settlements found matching your filters/i)).toBeInTheDocument();
      expect(screen.queryByText(/no settlements yet/i)).not.toBeInTheDocument();
    });

    it('shows the no-results message when a search alone excludes every settlement', () => {
      settlementMockStore.items = [
        makeSettlement('Fireport', { size: 'town' }),
        makeSettlement('Iceholm', { size: 'village' }),
        makeSettlement('Goldhaven', { size: 'city' }),
      ];
      renderSettlements();

      searchSettlements('nonexistent');

      expect(screen.getByText(/no settlements found matching your filters/i)).toBeInTheDocument();
      expect(screen.queryByText(/no settlements yet/i)).not.toBeInTheDocument();
    });
  });
});
