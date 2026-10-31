// @maintained-by-ai: 2026-10-14
// Search/size filtering behavior only. Intentionally NOT duplicated here
// (covered in sibling files):
//   - search control aria names, keyboard handling, clear-search button, and
//     "Filter:" title hints -> Settlements.accessibility.test.jsx
//   - size badge and list-item metadata rendering
//     -> Settlements.listRendering.test.jsx
//   - loading/empty states, search-clear restore, modal open/close
//     -> Settlements.modalActions.test.jsx
//   - save/delete and generate flows
//     -> Settlements.crudOperations / .saveDelete / .generate.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settlements from './Settlements.jsx';

// Module-level mock store captured by the vi.mock factory. Tests overwrite
// `items` before rendering so the component reads fresh state. Only the
// fields the component consumes for filtering are provided.
const settlementMockStore = {
  items: [],
  loading: false,
  loadItems: vi.fn(),
};

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: () => settlementMockStore,
}));

const makeSettlement = (name, overrides = {}) => ({
  name,
  size: 'village',
  tags: '',
  description: '',
  ...overrides,
});

const TOWNS = [
  makeSettlement('Fireport', { size: 'town' }),
  makeSettlement('Iceholm', { size: 'village' }),
  makeSettlement('Goldhaven', { size: 'city' }),
];

// Size filter buttons are the only elements carrying a `Filter:` tooltip
// (size badges in the list use a bare lowercase size title), so this query
// is exact and unambiguous — matching button names would collide with the
// aria-label of settlement list items (e.g. "Edit settlement: Fireport").
const getSizeFilterButton = (sizeLabel) => screen.getByTitle(`Filter: ${sizeLabel}`);

const queryListItem = (name) =>
  screen.queryByRole('button', { name: new RegExp(`edit settlement: ${name}`, 'i') });

const expectListItems = (visible, hidden = []) => {
  visible.forEach((name) => expect(queryListItem(name)).toBeInTheDocument());
  hidden.forEach((name) => expect(queryListItem(name)).not.toBeInTheDocument());
};

const expectNoResults = () => {
  expect(screen.getByText(/no settlements found matching your filters/i)).toBeInTheDocument();
  expect(screen.queryByText(/no settlements yet/i)).not.toBeInTheDocument();
};

const renderSettlements = () =>
  render(<Settlements campaignName="test" />);

const searchSettlements = (query) =>
  fireEvent.change(screen.getByLabelText('Search settlements'), { target: { value: query } });

describe('Settlements - filtering (behavioral)', () => {
  beforeEach(() => {
    settlementMockStore.items = [];
    settlementMockStore.loading = false;
    settlementMockStore.loadItems.mockResolvedValue(undefined);
    // The component fetches settlement-descriptions.json on mount; filtering
    // never reads its contents, so the response body is irrelevant.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Search filtering', () => {
    beforeEach(() => {
      settlementMockStore.items = TOWNS;
    });

    it.each([
      { action: 'filters by name case-insensitively', query: 'fire', visible: ['Fireport'], hidden: ['Iceholm', 'Goldhaven'] },
      { action: 'treats a whitespace-only query as empty and shows every settlement', query: '   ', visible: ['Fireport', 'Iceholm', 'Goldhaven'] },
    ])('$action', ({ query, visible, hidden }) => {
      renderSettlements();
      searchSettlements(query);
      expectListItems(visible, hidden);
    });

    it('matches search terms against tags and description, not just name', () => {
      settlementMockStore.items = [
        makeSettlement('Fireport', { tags: 'coastal', description: 'A town of fire' }),
        makeSettlement('Iceholm', { tags: 'frozen', description: 'A cold village on a glacier' }),
      ];
      renderSettlements();

      searchSettlements('coastal');
      expectListItems(['Fireport'], ['Iceholm']);

      searchSettlements('glacier');
      expectListItems(['Iceholm'], ['Fireport']);
    });
  });

  describe('Size filter', () => {
    beforeEach(() => {
      settlementMockStore.items = TOWNS;
    });

    it.each([
      { action: 'toggles off and restores the full list', clicks: ['Village', 'Village'], visible: ['Fireport', 'Iceholm', 'Goldhaven'] },
      { action: 'switches to a different size and shows only that size', clicks: ['Town', 'City'], visible: ['Goldhaven'], hidden: ['Fireport', 'Iceholm'] },
    ])('size filter: $action', ({ clicks, visible, hidden }) => {
      renderSettlements();
      clicks.forEach((size) => fireEvent.click(getSizeFilterButton(size)));
      expectListItems(visible, hidden);
    });

    it.each([
      { action: 'a size filter alone', apply: () => fireEvent.click(getSizeFilterButton('Metropolis')) },
      { action: 'a search alone', apply: () => searchSettlements('nonexistent') },
    ])('shows the no-results message when $action excludes every settlement', ({ apply }) => {
      renderSettlements();
      apply();
      expectNoResults();
    });
  });

  describe('Combined search and size filters', () => {
    it('intersects both filters and re-widens to the search matches when the size filter is cleared', () => {
      settlementMockStore.items = [
        makeSettlement('Fireport', { size: 'town' }),
        makeSettlement('Fire Village', { size: 'village' }),
        makeSettlement('Iceholm', { size: 'village' }),
      ];
      renderSettlements();

      searchSettlements('fire');
      expectListItems(['Fireport', 'Fire Village'], ['Iceholm']);

      fireEvent.click(getSizeFilterButton('Village'));
      expectListItems(['Fire Village'], ['Fireport', 'Iceholm']);

      fireEvent.click(getSizeFilterButton('Village'));
      expectListItems(['Fireport', 'Fire Village'], ['Iceholm']);
    });
  });
});
