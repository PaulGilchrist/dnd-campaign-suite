import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Settlements from './Settlements.jsx';

// Module-level mock store captured by vi.mock closure.
const settlementMockStore = {
  items: [],
  loading: false,
  loadItems: vi.fn(),
  saveItems: vi.fn(),
  deleteItem: vi.fn(),
};

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: vi.fn(() => settlementMockStore),
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

const campaignName = 'test-campaign';

// Full description data for all sizes. Math.random is pinned to 0 in every test,
// so `pick` always selects index 0, making expected values exact and deterministic.
const descriptionsData = {
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
};

const descriptionsDataPartial = {
  village: {
    descriptions: ['A quiet village'],
    // no atmospheres, governments, or threats
  },
  town: {
    descriptions: ['A bustling town'],
    atmospheres: ['Lively'],
    governments: ['Mayor'],
    // no threats
  },
  city: {
    // empty object — size key exists but no data
  },
  metropolis: {
    descriptions: ['A vast metropolis'],
    atmospheres: ['Diverse'],
    governments: ['Duke'],
    threats: ['Political intrigue'],
    features: ['A massive wall'],
  },
};

const SIZE_CASES = [
  { size: 'village', population: '50-100 souls', description: 'A quiet village', atmosphere: 'Peaceful', government: 'Village council', threat: 'Wild animals' },
  { size: 'town', population: '800-1,500 souls', description: 'A bustling town', atmosphere: 'Lively', government: 'Mayor', threat: 'Bandits' },
  { size: 'city', population: '5,000-12,000 souls', description: 'A great city', atmosphere: 'Cosmopolitan', government: 'City council', threat: 'Crime' },
  { size: 'metropolis', population: '50,000-100,000 souls', description: 'A vast metropolis', atmosphere: 'Diverse', government: 'Duke', threat: 'Political intrigue' },
];

const THREAT_PLACEHOLDER = /current dangers or tensions/i;

const renderSettlements = () => render(<Settlements campaignName={campaignName} onBack={() => {}} />);
const openNewSettlementModal = () => {
  fireEvent.click(screen.getByRole('button', { name: /new settlement/i }));
};

// Flush the pending descriptions fetch so descDataRef is populated before
// the size select changes (the ref is only read on size change).
const flushDescriptionsFetch = () => act(async () => {});

describe('Settlements - form fields (behavioral)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settlementMockStore.items = [];
    settlementMockStore.loading = false;
    settlementMockStore.loadItems.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Size auto-population', () => {
    it.each(SIZE_CASES)(
      'auto-populates population, description, atmosphere, government, and threat for $size',
      async ({ size, population, description, atmosphere, government, threat }) => {
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(descriptionsData),
        });
        renderSettlements();
        await flushDescriptionsFetch();
        openNewSettlementModal();

        fireEvent.change(screen.getByRole('combobox', { name: /size/i }), { target: { value: size } });

        expect(screen.getByLabelText('Population')).toHaveValue(population);
        expect(screen.getByPlaceholderText(/describe what the settlement looks/i)).toHaveValue(description);
        expect(screen.getByPlaceholderText(/mood and ambiance/i)).toHaveValue(atmosphere);
        expect(screen.getByPlaceholderText(/how is this settlement governed/i)).toHaveValue(government);
        expect(screen.getByPlaceholderText(/current dangers or tensions/i)).toHaveValue(threat);

        randomSpy.mockRestore();
        fetchSpy.mockRestore();
      },
    );

    it('preserves a user-typed name when the size is changed', async () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(descriptionsData),
      });
      renderSettlements();
      await flushDescriptionsFetch();
      openNewSettlementModal();

      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'My Village' } });
      fireEvent.change(screen.getByRole('combobox', { name: /size/i }), { target: { value: 'city' } });

      expect(screen.getByLabelText(/name/i)).toHaveValue('My Village');
      expect(screen.getByLabelText('Population')).toHaveValue('5,000-12,000 souls');

      randomSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    it('replaces previously auto-populated values when the size is changed again', async () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(descriptionsData),
      });
      renderSettlements();
      await flushDescriptionsFetch();
      openNewSettlementModal();

      const sizeSelect = screen.getByRole('combobox', { name: /size/i });
      fireEvent.change(sizeSelect, { target: { value: 'village' } });
      expect(screen.getByPlaceholderText(/describe what the settlement looks/i)).toHaveValue('A quiet village');

      fireEvent.change(sizeSelect, { target: { value: 'metropolis' } });
      expect(screen.getByPlaceholderText(/describe what the settlement looks/i)).toHaveValue('A vast metropolis');
      expect(screen.getByLabelText('Population')).toHaveValue('50,000-100,000 souls');

      randomSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    it('reveals the threat field once a size change auto-populates a threat', async () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(descriptionsData),
      });
      renderSettlements();
      await flushDescriptionsFetch();
      openNewSettlementModal();

      expect(screen.queryByPlaceholderText(THREAT_PLACEHOLDER)).not.toBeInTheDocument();

      fireEvent.change(screen.getByRole('combobox', { name: /size/i }), { target: { value: 'city' } });

      expect(screen.getByPlaceholderText(THREAT_PLACEHOLDER)).toHaveValue('Crime');

      randomSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    it('still fills population from built-in ranges when description data is not available', async () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      renderSettlements();
      await flushDescriptionsFetch();
      openNewSettlementModal();

      fireEvent.change(screen.getByRole('combobox', { name: /size/i }), { target: { value: 'town' } });

      expect(screen.getByLabelText('Population')).toHaveValue('800-1,500 souls');
      expect(screen.getByPlaceholderText(/describe what the settlement looks/i)).toHaveValue('');
      expect(screen.queryByPlaceholderText(THREAT_PLACEHOLDER)).not.toBeInTheDocument();

      randomSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    it.each([
      { size: 'town', expected: { description: 'A bustling town', atmosphere: 'Lively', government: 'Mayor', threatVisible: false } },
      { size: 'village', expected: { description: 'A quiet village', atmosphere: '', government: '', threatVisible: false } },
      { size: 'city', expected: { description: '', atmosphere: '', government: '', threatVisible: false } },
    ])(
      'partial description data: auto-populates available fields but leaves missing ones empty for $size',
      async ({ size, expected }) => {
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(descriptionsDataPartial),
        });
        renderSettlements();
        await flushDescriptionsFetch();
        openNewSettlementModal();

        fireEvent.change(screen.getByRole('combobox', { name: /size/i }), { target: { value: size } });

        expect(screen.getByLabelText('Population')).toHaveValue(
          size === 'town' ? '800-1,500 souls' : size === 'village' ? '50-100 souls' : '5,000-12,000 souls'
        );
        expect(screen.getByPlaceholderText(/describe what the settlement looks/i)).toHaveValue(expected.description);
        expect(screen.getByPlaceholderText(/mood and ambiance/i)).toHaveValue(expected.atmosphere);
        expect(screen.getByPlaceholderText(/how is this settlement governed/i)).toHaveValue(expected.government);

        if (expected.threatVisible) {
          expect(screen.getByPlaceholderText(THREAT_PLACEHOLDER)).toBeInTheDocument();
        } else {
          expect(screen.queryByPlaceholderText(THREAT_PLACEHOLDER)).not.toBeInTheDocument();
        }

        randomSpy.mockRestore();
        fetchSpy.mockRestore();
      },
    );

    it('re-fills all fields including population when the size is changed to the same value', async () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(descriptionsData),
      });
      renderSettlements();
      await flushDescriptionsFetch();
      openNewSettlementModal();

      const sizeSelect = screen.getByRole('combobox', { name: /size/i });
      // Set to village first
      fireEvent.change(sizeSelect, { target: { value: 'village' } });
      expect(screen.getByPlaceholderText(/describe what the settlement looks/i)).toHaveValue('A quiet village');

      // Change to the same value — should re-trigger auto-population
      fireEvent.change(sizeSelect, { target: { value: 'village' } });
      expect(screen.getByPlaceholderText(/describe what the settlement looks/i)).toHaveValue('A quiet village');
      expect(screen.getByLabelText('Population')).toHaveValue('50-100 souls');

      randomSpy.mockRestore();
      fetchSpy.mockRestore();
    });

  });

  describe('Name field validation', () => {
    it('disables save when the name is empty', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(descriptionsData),
      });
      renderSettlements();
      openNewSettlementModal();

      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();

      fetchSpy.mockRestore();
    });

    it('enables save when the name has content', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(descriptionsData),
      });
      renderSettlements();
      openNewSettlementModal();

      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'My Settlement' } });

      expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();

      fetchSpy.mockRestore();
    });

  });

});
