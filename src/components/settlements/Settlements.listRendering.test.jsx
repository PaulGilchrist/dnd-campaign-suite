// List rendering details only: size badges, population, service counts, tags,
// and description previews. Intentionally NOT duplicated here (covered in
// sibling files):
//   - size-only filtering (a filter excludes non-matching settlements)
//       -> Settlements.filtering.test.jsx
//   - loading / empty / no-results states, modal open/close, generate flow
//       -> Settlements.modalActions.test.jsx
//   - list item keyboard handling and accessible names
//       -> Settlements.accessibility.test.jsx
//   - row-level form CRUD and save/delete flows
//       -> Settlements.crudOperations / serviceNPCRumor / saveDelete.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

const renderSettlements = () =>
  render(<Settlements campaignName="test" onBack={() => {}} />);

// Scope every query to the specific settlement list item so regex-based
// button-name queries don't collide with other buttons on the page.
const withinSettlement = (name) => {
  const item = screen.getByRole('button', { name: new RegExp(`edit settlement: ${name}`, 'i') });
  return {
    item,
    getByText: (text) => within(item).getByText(text),
    queryByText: (text) => within(item).queryByText(text),
    getByTitle: (title) => within(item).getByTitle(title),
    queryByTitle: (title) => within(item).queryByTitle(title),
    getByClass: (cls) => item.querySelector(`.${cls}`),
    queryByClass: (cls) => item.querySelector(`.${cls}`),
  };
};

describe('Settlements - list rendering details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settlementMockStore.items = [];
    settlementMockStore.loading = false;
    settlementMockStore.loadItems.mockResolvedValue(undefined);
    // The component fetches settlement-descriptions.json on mount; no test here
    // changes the size select, so the response body is irrelevant.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Size badges', () => {
    it.each([
      { name: 'Fireport', size: 'town', icon: 'fa-hotel' },
      { name: 'Iceholm', size: 'village', icon: 'fa-house-chimney' },
      { name: 'Goldhaven', size: 'city', icon: 'fa-city' },
      { name: 'Capital City', size: 'metropolis', icon: 'fa-landmark-dome' },
    ])('renders a $size badge ($name) with the $icon icon', ({ name, size, icon }) => {
      settlementMockStore.items = [makeSettlement(name, { size })];
      renderSettlements();

      const badge = withinSettlement(name).getByTitle(size);
      expect(badge).toHaveTextContent(size);
      expect(badge.querySelector('i')).toHaveClass('fa-solid', icon);
    });

    it('does not render a size badge for a settlement without a size', () => {
      settlementMockStore.items = [makeSettlement('Mysterious Hollow', { size: '' })];
      renderSettlements();

      expect(withinSettlement('Mysterious Hollow').queryByTitle('')).toBeNull();
      expect(withinSettlement('Mysterious Hollow').getByClass('settlements-size-badge')).toBeNull();
    });
  });

  describe('List metadata', () => {
    it('shows the population inside each settlement list item', () => {
      settlementMockStore.items = [
        makeSettlement('Fireport', { population: '1,500 souls' }),
        makeSettlement('Goldhaven', { population: '25,000 souls' }),
      ];
      renderSettlements();

      expect(withinSettlement('Fireport').getByText('1,500 souls')).toBeInTheDocument();
      expect(withinSettlement('Goldhaven').getByText('25,000 souls')).toBeInTheDocument();
    });

    it('hides the population row when both population and size are empty', () => {
      settlementMockStore.items = [makeSettlement('Empty Hollow', { population: '', size: '' })];
      renderSettlements();

      expect(withinSettlement('Empty Hollow').getByClass('settlements-list-subtitle')).toBeNull();
    });

    it('shows the service count with correct pluralization', () => {
      const inn = { type: 'inn', name: 'The Rusty Anchor', description: 'A fine inn' };
      const smithy = { type: 'blacksmith', name: 'Ironworks', description: 'Quality steel' };
      settlementMockStore.items = [
        makeSettlement('Fireport', { services: [inn, smithy] }),
        makeSettlement('Goldhaven', { services: [inn] }),
      ];
      renderSettlements();

      expect(withinSettlement('Fireport').getByText('2 services')).toBeInTheDocument();
      expect(withinSettlement('Goldhaven').getByText('1 service')).toBeInTheDocument();
    });

    it('shows the tags for settlements that have them', () => {
      settlementMockStore.items = [
        makeSettlement('Fireport', { tags: 'coastal, trade' }),
        makeSettlement('Goldhaven', { tags: 'trade hub' }),
      ];
      renderSettlements();

      expect(withinSettlement('Fireport').getByText('coastal, trade')).toBeInTheDocument();
      expect(withinSettlement('Goldhaven').getByText('trade hub')).toBeInTheDocument();
    });

    it('does not render a service count when a settlement has no services', () => {
      settlementMockStore.items = [makeSettlement('Quiet Hollow', { services: [] })];
      renderSettlements();

      expect(withinSettlement('Quiet Hollow').getByClass('settlements-list-services')).toBeNull();
    });

    it('does not render a tags row when a settlement has no tags', () => {
      settlementMockStore.items = [makeSettlement('Quiet Hollow', { tags: '' })];
      renderSettlements();

      expect(withinSettlement('Quiet Hollow').getByClass('settlements-list-tags')).toBeNull();
    });
  });

  describe('Description previews', () => {
    it('truncates a description longer than 120 characters to 120 characters plus an ellipsis', () => {
      const longDescription = 'The town of Fireport sits at the mouth of a volcanic gorge, its streets paved with ash and cinder. Blacksmiths hammer through the night while ships unload raw ore beneath plumes of smoke.';
      settlementMockStore.items = [makeSettlement('Fireport', { description: longDescription })];
      renderSettlements();

      const preview = withinSettlement('Fireport').getByText(longDescription.slice(0, 120) + '\u2026');
      expect(preview).toHaveClass('settlements-list-preview');
    });

    it('shows a description of 120 characters or fewer in full', () => {
      const shortDescription = 'A short description under 120 chars';
      settlementMockStore.items = [makeSettlement('ShortDesc', { description: shortDescription })];
      renderSettlements();

      expect(withinSettlement('ShortDesc').getByText(shortDescription)).toBeInTheDocument();
    });

    it('treats a 120-character description as short but truncates a 121-character one', () => {
      const exactly120 = 'a'.repeat(120);
      const over120 = 'b'.repeat(121);
      settlementMockStore.items = [
        makeSettlement('Exact Town', { description: exactly120 }),
        makeSettlement('Over Town', { description: over120 }),
      ];
      renderSettlements();

      expect(withinSettlement('Exact Town').getByText(exactly120)).toBeInTheDocument();
      expect(withinSettlement('Over Town').getByText('b'.repeat(120) + '\u2026')).toHaveClass('settlements-list-preview');
    });

    it('does not render a description preview when the description is empty', () => {
      settlementMockStore.items = [makeSettlement('Quiet Hollow', { description: '' })];
      renderSettlements();

      expect(withinSettlement('Quiet Hollow').getByClass('settlements-list-preview')).toBeNull();
    });

    it('renders a description preview when the description is whitespace-only (truthy)', () => {
      settlementMockStore.items = [makeSettlement('Space Town', { description: '   ' })];
      renderSettlements();

      expect(withinSettlement('Space Town').getByClass('settlements-list-preview')).toBeInTheDocument();
    });
  });


});
