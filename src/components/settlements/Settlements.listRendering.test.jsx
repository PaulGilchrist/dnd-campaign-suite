// @maintained-by-ai 2026-11-26
// List rendering details only: size badges, name, population, service counts,
// tags, and description previews. Intentionally NOT duplicated here (covered in
// sibling files):
//   - size-only filtering -> Settlements.filtering.test.jsx
//   - loading / empty / no-results states, modal open/close -> Settlements.modalActions.test.jsx
//   - generate flow -> Settlements.generate.test.jsx
//   - list item keyboard handling and accessible names -> Settlements.accessibility.test.jsx
//   - row-level form CRUD and save/delete flows
//       -> Settlements.crudOperations / serviceNPCRumor / saveDelete.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Settlements from './Settlements.jsx';

// Module-level mock store captured by the vi.mock factory. Tests set `items`
// before rendering; shape matches what Settlements.jsx destructures from the
// hook (the modal/generate paths never run in this lane).
const settlementMockStore = {
  items: [],
  loading: false,
  loadItems: vi.fn(),
  deleteItem: vi.fn(),
};

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: () => settlementMockStore,
}));

const makeSettlement = (name, overrides = {}) => ({
  name,
  size: '',
  population: '',
  tags: '',
  services: [],
  description: '',
  ...overrides,
});

const renderSettlements = (...items) => {
  settlementMockStore.items = items;
  render(<Settlements campaignName="test" />);
};

// Scope every query to one settlement's list item so text/title/class queries
// don't collide with other rows or the size-filter buttons in the header.
const withinSettlement = (name) => {
  const item = screen.getByRole('button', { name: new RegExp(`edit settlement: ${name}`, 'i') });
  return {
    getByText: (text) => within(item).getByText(text),
    getByTitle: (title) => within(item).getByTitle(title),
    q: (selector) => item.querySelector(selector),
  };
};

describe('Settlements - list rendering details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settlementMockStore.items = [];
    settlementMockStore.loading = false;
    settlementMockStore.loadItems.mockResolvedValue(undefined);
    // The component fetches settlement-descriptions.json on mount; this lane
    // never changes the size select, so the response body is irrelevant.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the name and a size badge with the mapped icon for every size', () => {
    const sizes = [
      { name: 'Iceholm', size: 'village', icon: 'fa-house-chimney' },
      { name: 'Fireport', size: 'town', icon: 'fa-hotel' },
      { name: 'Goldhaven', size: 'city', icon: 'fa-city' },
      { name: 'Capital City', size: 'metropolis', icon: 'fa-landmark-dome' },
    ];
    renderSettlements(...sizes.map(({ name, size }) => makeSettlement(name, { size })));

    for (const { name, size, icon } of sizes) {
      const badge = withinSettlement(name).getByTitle(size);
      expect(badge).toHaveTextContent(size);
      expect(badge.querySelector('i')).toHaveClass('fa-solid', icon);
    }
  });

  it('renders population, service count with pluralization, and tags', () => {
    const inn = { type: 'inn', name: 'The Rusty Anchor', description: 'A fine inn' };
    const smithy = { type: 'blacksmith', name: 'Ironworks', description: 'Quality steel' };
    renderSettlements(
      makeSettlement('Fireport', {
        size: 'town',
        population: '1,500 souls',
        tags: 'coastal, trade',
        services: [inn, smithy],
      }),
      makeSettlement('Goldhaven', {
        size: 'city',
        population: '25,000 souls',
        tags: 'trade hub',
        services: [inn],
      }),
    );

    expect(withinSettlement('Fireport').getByText('1,500 souls')).toBeInTheDocument();
    expect(withinSettlement('Fireport').getByText('2 services')).toBeInTheDocument();
    expect(withinSettlement('Fireport').getByText('coastal, trade')).toBeInTheDocument();
    expect(withinSettlement('Goldhaven').getByText('25,000 souls')).toBeInTheDocument();
    expect(withinSettlement('Goldhaven').getByText('1 service')).toBeInTheDocument();
    expect(withinSettlement('Goldhaven').getByText('trade hub')).toBeInTheDocument();
  });

  it('omits the size badge, subtitle, services, tags, and preview rows when all are empty', () => {
    renderSettlements(makeSettlement('Empty Hollow'));

    const hollow = withinSettlement('Empty Hollow');
    expect(hollow.getByText('Empty Hollow')).toBeInTheDocument();
    expect(hollow.q('.settlements-size-badge')).toBeNull();
    expect(hollow.q('.settlements-list-subtitle')).toBeNull();
    expect(hollow.q('.settlements-list-services')).toBeNull();
    expect(hollow.q('.settlements-list-tags')).toBeNull();
    expect(hollow.q('.settlements-list-preview')).toBeNull();
  });

  it('shows descriptions of 120 characters or fewer in full and truncates longer ones', () => {
    const long = 'The town of Fireport sits at the mouth of a volcanic gorge, its streets paved with ash and cinder. Blacksmiths hammer through the night while ships unload raw ore beneath plumes of smoke.';
    renderSettlements(
      makeSettlement('ShortDesc', { description: 'A short description under 120 chars' }),
      makeSettlement('Exact Town', { description: 'a'.repeat(120) }),
      makeSettlement('Over Town', { description: 'b'.repeat(121) }),
      makeSettlement('Gorgetown', { description: long }),
    );

    const cases = [
      { name: 'ShortDesc', description: 'A short description under 120 chars', truncated: false },
      { name: 'Exact Town', description: 'a'.repeat(120), truncated: false },
      { name: 'Over Town', description: 'b'.repeat(121), truncated: true },
      { name: 'Gorgetown', description: long, truncated: true },
    ];
    for (const { name, description, truncated } of cases) {
      const expected = truncated ? description.slice(0, 120) + '\u2026' : description;
      expect(withinSettlement(name).getByText(expected)).toHaveClass('settlements-list-preview');
    }
  });
});
